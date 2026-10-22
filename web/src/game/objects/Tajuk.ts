import Phaser from 'phaser';
import { cuaca } from '../cuaca';

/**
 * Tile tajuk pohon (gid di atlas). Baris terbawah tajuk dan batangnya tidak
 * ada di sini: mereka diam, jadi pohonnya melengkung dari pangkal, bukan
 * bergeser utuh. Seberapa jauh tiap bagian ikut bergoyang tidak ditulis di
 * sini lagi, melainkan dihitung dari tingginya di atas pangkal (lihat `Pohon`).
 */
const TAJUK = new Set([
  // pohon rimbun berdahan (2×3)
  43, 44, 47, 48,
  // pohon ayunan ban (2×3)
  41, 42, 45, 46,
  // pohon bulat kecil (2×3)
  104, 105, 112, 113,
  // cemara (2×2)
  114, 115,
  // pohon besar (4×5)
  75, 76, 77, 78, 79, 80, 81, 82, 86, 87, 88, 89,
]);

/** Lapisan tilemap yang memuat tajuk (yang lain digambar per tile: lihat `gambar`). */
const LAPISAN = ['di atas map 1', 'aset kedua'];

/**
 * Tinggi satu irisan, px dunia. Tiap tile tajuk dipotong jadi irisan mendatar
 * setinggi ini dan tiap irisan digeser sendiri, jadi tajuknya melengkung
 * mulus. Dengan zoom 3, 2 px dunia = 6 px layar: beda geser antar irisan
 * yang bersebelahan jauh di bawah satu piksel layar, tidak ada tangga.
 */
const IRIS = 2;

/** Geser terjauh di pucuk, px dunia. */
const AYUN = 1.6;

interface Irisan {
  img: Phaser.GameObjects.Image;
  asal: number;
  /** 0 di pangkal tajuk, 1 di pucuknya. */
  tinggi: number;
}

interface Pohon {
  /** Titik tengahnya di dunia: menentukan kapan embusan angin sampai. */
  cx: number;
  /** Fase sendiri supaya pohon yang berdekatan tidak berayun kembar. */
  fase: number;
  /** Kekakuan: pohon kecil berayun lebih cepat daripada pohon besar. */
  laju: number;
  irisan: Irisan[];
  /** Posisi ayun yang dihaluskan (pegas), bukan langsung dari rumus. */
  x: number;
  v: number;
}

interface Petak {
  tx: number;
  ty: number;
  /** Membuat irisan untuk petak ini; dipanggil setelah pohonnya diketahui. */
  iris: (tinggi: (yDunia: number) => number) => Irisan[];
}

/**
 * Tajuk pohon yang melambai diterpa angin.
 *
 * Pohonnya tile peta. Dulu tiap tile tajuk digeser satu piksel penuh sepuluh
 * kali sedetik — di zoom 3 itu lompatan tiga piksel layar, dan baris atas
 * bergeser sementara baris di bawahnya belum, jadi tajuknya terlihat patah.
 *
 * Sekarang tiap tile tajuk diganti irisan-irisan tipis (lihat `IRIS`) dan
 * digeser tiap frame dengan nilai pecahan: makin tinggi irisannya, makin jauh
 * gesernya (lengkung kuadrat dari pangkal, seperti dahan yang lentur), jadi
 * seluruh tajuk melengkung sebagai satu benda. Anginnya datang bergelombang
 * dari barat ke timur (searah awan): saat embusan sampai, pohonnya condong ke
 * timur dan berayun lebih lebar, lalu kembali tegak saat tenang. Ayunnya
 * melewati pegas teredam, jadi tidak pernah menyentak. Saat gerimis
 * embusannya lebih kuat.
 */
export class Tajuk {
  private pohon: Pohon[] = [];

  constructor(
    private scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    /** Tile padat yang digambar satu per satu oleh WorldScene.gambarPadat(). */
    gambar: { img: Phaser.GameObjects.Image; gid: number }[]
  ) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const firstgid = map.tilesets[0].firstgid;
    const petak: Petak[] = [];

    for (const nama of LAPISAN) {
      const l = map.getLayer(nama);
      if (!l?.tilemapLayer) continue;
      const depth = l.tilemapLayer.depth;
      for (const baris of l.data) {
        for (const t of baris) {
          if (!t || t.index < 0 || !TAJUK.has(t.index - firstgid + 1)) continue;
          petak.push({
            tx: t.x,
            ty: t.y,
            iris: (tinggi) => {
              // tile aslinya disembunyikan; irisannya yang digambar, di kedalaman lapisannya
              t.visible = false;
              return this.potong(t.index - firstgid, t.pixelX + t.width / 2, t.pixelY, t.flipX, t.flipY, depth, tinggi);
            },
          });
        }
      }
    }
    for (const { img, gid } of gambar) {
      if (!TAJUK.has(gid)) continue;
      petak.push({
        tx: Math.floor(img.x / 16),
        ty: Math.floor(img.y / 16),
        iris: (tinggi) => {
          img.setVisible(false);
          return this.potong(gid - 1, img.x, img.y - 8, img.flipX, img.flipY, img.depth, tinggi);
        },
      });
    }
    if (!petak.length) return;

    // petak tajuk yang bersentuhan (lintas lapisan) = satu pohon
    const kunci = (x: number, y: number) => `${x},${y}`;
    const sisa = new Map<string, Petak[]>();
    for (const p of petak) {
      const k = kunci(p.tx, p.ty);
      sisa.set(k, [...(sisa.get(k) ?? []), p]);
    }
    while (sisa.size) {
      const [mulai] = sisa.keys();
      const antre = [mulai];
      const anggota: Petak[] = [];
      while (antre.length) {
        const k = antre.pop()!;
        const isi = sisa.get(k);
        if (!isi) continue;
        sisa.delete(k);
        anggota.push(...isi);
        const [x, y] = k.split(',').map(Number);
        antre.push(kunci(x - 1, y), kunci(x + 1, y), kunci(x, y - 1), kunci(x, y + 1));
      }
      this.tanam(anggota);
    }

    scene.events.on('update', this.tiup, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.tiup, this));
  }

  /** Satu pohon: pangkal tajuknya di tepi bawah petak terbawah, di situ gesernya nol. */
  private tanam(anggota: Petak[]) {
    const atas = Math.min(...anggota.map((p) => p.ty)) * 16;
    const pangkal = (Math.max(...anggota.map((p) => p.ty)) + 1) * 16;
    const kiri = Math.min(...anggota.map((p) => p.tx)) * 16;
    const kanan = (Math.max(...anggota.map((p) => p.tx)) + 1) * 16;
    // tajuk setinggi satu setengah petak atau lebih lentur penuh; yang lebih
    // pendek (cemara 2×2) tetap berayun, hanya sedikit lebih kaku
    const tinggi = (y: number) => Phaser.Math.Clamp((pangkal - y) / Math.max(pangkal - atas, 24), 0, 1);
    const irisan = anggota.flatMap((p) => p.iris(tinggi));
    const cx = (kiri + kanan) / 2;
    this.pohon.push({
      cx,
      fase: Math.sin(cx * 12.9898) * 43758.5453 % (Math.PI * 2),
      laju: 1.9 + 32 / (kanan - kiri),
      irisan,
      x: 0,
      v: 0,
    });
  }

  /** Potong satu tile tajuk jadi irisan mendatar; (cx, y) = tengah-atas tile-nya di dunia. */
  private potong(
    lokal: number,
    cx: number,
    y: number,
    flipX: boolean,
    flipY: boolean,
    depth: number,
    tinggi: (yDunia: number) => number
  ): Irisan[] {
    const tex = this.scene.textures.get('atlas');
    const kolom = 16;
    const langkah = 16 + 2;
    const sx = 1 + (lokal % kolom) * langkah;
    const sy = 1 + Math.floor(lokal / kolom) * langkah;
    const hasil: Irisan[] = [];
    for (let i = 0; i < 16 / IRIS; i++) {
      // tile yang dibalik tegak: irisan teratas di layar diambil dari bawah gambarnya
      const j = flipY ? 16 / IRIS - 1 - i : i;
      const nama = `tajuk${lokal}_${j}`;
      if (!tex.has(nama)) tex.add(nama, 0, sx, sy + j * IRIS, 16, IRIS);
      const yi = y + i * IRIS;
      const img = this.scene.add
        .image(cx, yi, 'atlas', nama)
        .setOrigin(0.5, 0)
        .setFlip(flipX, flipY)
        .setDepth(depth);
      hasil.push({ img, asal: cx, tinggi: tinggi(yi + IRIS / 2) });
    }
    return hasil;
  }

  private tiup(_t: number, dt: number) {
    const s = this.scene.time.now / 1000;
    const d = Math.min(dt, 50) / 1000;
    const kuat = 1 + cuaca.hujan * 0.6;
    const cam = this.scene.cameras.main.worldView;
    for (const p of this.pohon) {
      // embusan: gelombang lambat yang merambat ke timur; halus naik-turunnya
      // (sin kuadrat), dengan sisa semilir kecil di antara embusan
      const gel = Math.max(0, Math.sin(s * 0.45 - p.cx * 0.006));
      const embus = 0.3 + 0.7 * gel * gel;
      // angin mendorong ke timur, ayunannya bolak-balik di sekitar condong itu
      const ayun = Math.sin(s * p.laju + p.fase) * 0.55 + Math.sin(s * p.laju * 2.3 + p.fase * 1.7) * 0.15;
      const tuju = (0.45 * embus + ayun * embus) * kuat;
      // pegas teredam: ayunnya mengejar tujuan tanpa pernah menyentak
      p.v += ((tuju - p.x) * 28 - p.v * 7) * d;
      p.x += p.v * d;

      // pohon di luar layar tetap dihitung (supaya tidak meloncat saat
      // terlihat lagi), tapi irisannya tidak perlu dipindah
      if (p.cx < cam.x - 48 || p.cx > cam.right + 48) continue;
      const geser = p.x * AYUN;
      for (const r of p.irisan) r.img.x = r.asal + geser * r.tinggi * r.tinggi;
    }
  }
}
