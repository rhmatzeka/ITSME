import Phaser from 'phaser';
import { DEPTH, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

type Arah = 'down' | 'left' | 'right' | 'up';
const URUT_ARAH: Arah[] = ['down', 'left', 'right', 'up'];

/** Di atas tirai malam, bersama cahaya lampu jalan — lihat Suasana.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/** Ukuran tekstur sorot: panjang kerucutnya, dan lebar bukaannya dalam radian. */
const SOROT = { panjang: 64, tinggi: 44, buka: 0.42 };
/** Jumlah sinar yang menyapu kerucut untuk mencari tembok — lihat `pangkas()`. */
const SINAR = 13;

/**
 * Cara memegang senter per arah hadap, dalam piksel frame 32×32 (pojok kiri
 * atas = 0,0). Dibaca dari blonde_man.png, yang jadi dasar semua warga:
 *
 * - menghadap bawah: tangan kanan menggantung di x 20-21 baris 26-27; senter
 *   tegak di bawah genggamannya, lensanya menunjuk ke tanah di depan kaki;
 * - menghadap samping: lengan yang tampak menggantung di tengah badan
 *   (x 16-17 hadap kiri, x 14-15 hadap kanan) baris 25-27; senternya
 *   mendatar setinggi pinggang, menjorok ke depan badan;
 * - menghadap atas: senternya di depan badan, jadi tertutup punggung.
 *
 * `genggam` = piksel tangan yang digambar ulang DI ATAS gagang senter —
 * itu yang membuatnya terbaca digenggam, bukan melayang di depan badan.
 * `alat` = pusat gambar senter, `lensa` = ujung tempat sorotnya keluar.
 *
 * Versi pertama menaruh senter di satu titik per arah tanpa tangan, dan
 * kilau lensanya 16 px — di sisi samping titik itu jatuh di depan dagu dan
 * kilaunya menutupi separuh wajah.
 */
const PEGANG: Record<
  Arah,
  { genggam: [number, number][]; alat: [number, number]; lensa: [number, number]; sudut: number; belakang?: boolean }
> = {
  down: { genggam: [[20, 27], [21, 27]], alat: [21, 29.5], lensa: [21, 32], sudut: 90 },
  left: { genggam: [[16, 25], [17, 25], [16, 26], [17, 26]], alat: [14, 26], lensa: [11, 26], sudut: 180 },
  right: { genggam: [[14, 25], [15, 25], [14, 26], [15, 26]], alat: [17, 26], lensa: [20, 26], sudut: 0 },
  up: { genggam: [], alat: [21, 21.5], lensa: [21, 19], sudut: -90, belakang: true },
};

/** Warna kulit pemegang senter, dibaca sekali per lembar dari tangannya sendiri. */
const KULIT = new Map<string, number>();

interface Pemegang {
  s: Phaser.GameObjects.Sprite;
  arah: () => Arah;
  aktif: () => boolean;
  sorot: Phaser.GameObjects.Image;
  /** Bentuk sorot yang sudah dipotong tembok, dipakai sebagai mask. */
  bentuk: Phaser.GameObjects.Graphics | null;
  mask: Phaser.Display.Masks.GeometryMask | null;
  /** Tangan + arah saat bentuknya terakhir dihitung; sama = tidak dihitung ulang. */
  kunci: string;
  kilau: Phaser.GameObjects.Image;
  alat: Phaser.GameObjects.Image;
  /** Piksel-piksel tangan yang menggenggam gagangnya. */
  tangan: Phaser.GameObjects.Graphics;
}

/** Arah hadap dari nomor frame, untuk lembar 4 kolom × (diam, jalan) seperti blonde_man.png. */
export function arahDariFrame(s: Phaser.GameObjects.Sprite): Arah {
  const n = Number(s.frame.name);
  return Number.isFinite(n) ? URUT_ARAH[Math.floor(n / 4) % 4] : 'down';
}

/**
 * Senter di malam hari: tiap warga dan pemain mengeluarkan senter begitu
 * langitnya gelap. Senternya kelihatan di tangan, sorotnya jatuh ke tanah di
 * depan mereka mengikuti arah hadap — jadi di malam hari tiap orang yang
 * berjalan membawa lingkaran terangnya sendiri, dan pemain bisa melihat ke
 * mana warga lain sedang menghadap dari jauh.
 *
 * Kecerahannya ikut `gelap()` (0 siang, 1 malam): senja memunculkannya
 * pelan-pelan, bukan menyalakannya mendadak.
 *
 * Sorotnya digambar SEKEDALAMAN pemegangnya, bukan di atas segalanya. Versi
 * pertama ditaruh di atas tirai malam bersama cahaya lampu jalan, dan
 * kerucut yang terang itu menembus rumah: warga di belakang rumah yang
 * menghadap ke bawah menyinari atap dan dinding di depannya dari balik
 * tembok. Sekedalaman pemegangnya, atap dan tembok yang lebih ke selatan
 * menutup sorotnya seperti menutup orangnya sendiri. Yang tetap di atas
 * tirai cuma kilau kecil di kaca senternya — sumber cahayanya kelihatan
 * menyala, cahayanya tidak tembus tembok.
 *
 * Kedalaman saja tidak cukup untuk tembok yang berdiri di SAMPING pemegangnya.
 * Tanggul tegak di tepi lapangan Projects diurut per baris, jadi baris-baris
 * yang sejajar atau lebih utara dari pemegangnya tergambar di bawah sorot —
 * orang yang menghadap ke tanggul itu menyinari rumput di seberangnya. Karena
 * itu tiap kerucut juga dipotong di tempat sinarnya menabrak benda padat
 * (`penghalang`), lihat `pangkas()`.
 */
export class Senter {
  private daftar: Pemegang[] = [];
  /** Titik poligon sorot, dipakai ulang tiap hitungan — tangan + satu per sinar. */
  private titik = Array.from({ length: SINAR + 1 }, () => new Phaser.Math.Vector2());

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    /** Titik dunia yang menahan cahaya; tanpanya sorot tidak dipotong. */
    private penghalang?: (x: number, y: number) => boolean
  ) {
    this.buatTekstur();
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    if (!tx.exists('senter_sorot')) {
      // kerucut cahaya mengarah ke kanan, pangkalnya di tepi kiri tengah
      const { panjang: W, tinggi: H, buka } = SOROT;
      const kanvas = tx.createCanvas('senter_sorot', W, H)!;
      const ctx = kanvas.getContext();
      const img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dy = y + 0.5 - H / 2;
          const jarak = Math.hypot(x, dy);
          const sudut = Math.abs(Math.atan2(dy, x + 2));
          if (sudut > buka || jarak > W) continue;
          // lebih pekat dari cahaya lampu: sorot ini digambar di bawah tirai malam
          const a = Math.min(1, 1.25 * Math.pow(1 - jarak / W, 0.8) * Math.pow(1 - sudut / buka, 0.6));
          const i = (y * W + x) * 4;
          img.data[i] = 255;
          img.data[i + 1] = 238;
          img.data[i + 2] = 186;
          img.data[i + 3] = Math.round(a * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
      kanvas.refresh();
    }
    if (!tx.exists('senter_kilau')) {
      // kilau lensa: kecil dan putih — cukup untuk terlihat menyala, tidak
      // sampai menyiram wajah pemegangnya
      const k = tx.createCanvas('senter_kilau', 8, 8)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
      g.addColorStop(0, 'rgba(255,255,240,1)');
      g.addColorStop(0.35, 'rgba(255,250,215,0.55)');
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 8);
      k.refresh();
    }
    if (!tx.exists('lentera_cahaya')) {
      const k = tx.createCanvas('lentera_cahaya', 64, 64)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,220,140,0.9)');
      g.addColorStop(0.35, 'rgba(255,190,90,0.35)');
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      k.refresh();
    }
    // lentera minyak: 0 padam (siang), 1-2 api menyala bergoyang
    const lentera = (api: string) => [
      '..kkk..',
      '.k...k.',
      '..kkk..',
      '.kkkkk.',
      api.slice(0, 7),
      api.slice(7, 14),
      api.slice(14, 21),
      '.kkkkk.',
      'kbbbbbk',
      '.kkkkk.',
    ];
    spritesheetTeks(
      this.scene,
      'lentera',
      [lentera('kgdddgkkgdddgkkgdddgk'), lentera('kgyYygkkgyYygkkgyyygk'), lentera('kgYyygkkgyYYgkkgyyygk')],
      { k: '#2a1a10', g: '#9fb7c7', d: '#5a6a78', y: '#ffb640', Y: '#fff2b0', b: '#8a5a2a' }
    );
    // senternya sendiri: badan abu-abu, kaca kuning menyala di ujung
    // senter: gagang abu dengan tombol merah, kepala yang melebar, kaca kuning
    spritesheetTeks(this.scene, 'senter_datar', [['kkkkkk', 'kgrgGY', 'kkkkkk']], {
      k: '#23232e',
      g: '#8a8f9c',
      G: '#b8bcc8',
      r: '#d8403a',
      Y: '#fff6c8',
    });
    spritesheetTeks(this.scene, 'senter_tegak', [['kgk', 'kgk', 'krk', 'kGk', 'kYk']], {
      k: '#23232e',
      g: '#8a8f9c',
      G: '#b8bcc8',
      r: '#d8403a',
      Y: '#fff6c8',
    });
  }

  /**
   * Beri seseorang senter. `arah` default dibaca dari nomor frame-nya;
   * `aktif` = false menyimpan senternya (pemain yang sedang tidur atau main HP).
   */
  pegang(s: Phaser.GameObjects.Sprite, arah: () => Arah = () => arahDariFrame(s), aktif: () => boolean = () => true) {
    const sorot = this.scene.add
      .image(0, 0, 'senter_sorot')
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const kilau = this.scene.add
      .image(0, 0, 'senter_kilau')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setVisible(false);
    const alat = this.scene.add.image(0, 0, 'senter_datar').setVisible(false);
    const tangan = this.scene.add.graphics().setVisible(false);
    // tidak masuk daftar tampilan: gunanya hanya sebagai bentuk mask
    const bentuk = this.penghalang ? this.scene.make.graphics({}, false) : null;
    const mask = bentuk ? bentuk.createGeometryMask() : null;
    this.daftar.push({ s, arah, aktif, sorot, bentuk, mask, kunci: '', kilau, alat, tangan });
  }

  /**
   * Lentera minyak yang ditaruh di tanah — untuk warga yang kedua tangannya
   * sibuk (petani yang mencangkul tidak mungkin memegang senter). Siang
   * padam; malam apinya menyala bergoyang dan cahayanya berdenyut pelan.
   *
   * `dasar` = garis pijak benda tempat lentera ditaruh (meja kios), kalau
   * bukan di tanah — supaya lentera terurut bersama bendanya.
   */
  lentera(x: number, kaki: number, dasar = kaki) {
    const s = this.scene;
    const l = s.add.sprite(x, kaki, 'lentera', 0).setOrigin(0.5, 1).setDepth(kedalaman(dasar) + 0.5);
    const cahaya = s.add
      .image(x, kaki - 5, 'lentera_cahaya')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setVisible(false);
    let t = Math.random() * 10;
    s.events.on('update', (_w: number, delta: number) => {
      t += delta / 1000;
      const g = this.gelap();
      const nyala = g > 0.08;
      cahaya.setVisible(nyala);
      if (!nyala) {
        if (l.frame.name !== '0') l.setFrame(0);
        return;
      }
      const denyut = 0.85 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.05;
      cahaya.setAlpha(Math.min(1, g) * 0.75 * denyut).setScale(0.95 + denyut * 0.1);
      const f = Math.sin(t * 6) > 0 ? 1 : 2;
      if (Number(l.frame.name) !== f) l.setFrame(f);
    });
  }

  /** Warna kulit sebuah lembar: piksel tangan kanan di frame diam-menghadap-bawah. */
  private kulit(key: string) {
    let w = KULIT.get(key);
    if (w === undefined) {
      const c = this.scene.textures.getPixel(20, 27, key, 0);
      w = c && c.alpha > 0 ? c.color : 0xe8b48a;
      KULIT.set(key, w);
    }
    return w;
  }

  private detak() {
    const g = this.gelap();
    for (const p of this.daftar) {
      const nyala = g > 0.08 && p.s.active && p.s.visible && p.aktif();
      p.sorot.setVisible(nyala);
      p.kilau.setVisible(nyala);
      p.alat.setVisible(nyala);
      p.tangan.setVisible(nyala);
      if (!nyala) continue;
      const arah = p.arah();
      const t = PEGANG[arah];
      // pojok kiri atas frame di dunia, apa pun origin dan skala sprite-nya
      const k = p.s.scaleX;
      const ox = p.s.x - p.s.originX * p.s.displayWidth;
      const oy = p.s.y - p.s.originY * p.s.displayHeight;
      const lx = ox + t.lensa[0] * k;
      const ly = oy + t.lensa[1] * k;
      // pangkal sorot yang paling terang dimulai sedikit di depan lensa,
      // supaya badan pemegangnya tidak ikut bersinar
      const rad = Phaser.Math.DegToRad(t.sudut);
      const sx = lx + Math.cos(rad) * 2;
      const sy = ly + Math.sin(rad) * 2;
      // sorot di bawah tirai: lebih pekat supaya tetap terbaca setelah digelapkan
      p.sorot
        .setPosition(sx, sy)
        .setAngle(t.sudut)
        .setAlpha(Math.min(1, g) * 0.95)
        // menghadap atas: sorotnya di balik badan pemegangnya, bukan menimpa kepalanya
        .setDepth(p.s.depth + (t.belakang ? -0.2 : 0.2));
      this.pangkas(p, Math.round(sx), Math.round(sy), t.sudut);
      p.kilau.setPosition(lx, ly).setAlpha(Math.min(1, g) * (t.belakang ? 0 : 0.65));
      const tegak = arah === 'down' || arah === 'up';
      const muncul = Math.min(1, g * 2);
      p.alat
        .setTexture(tegak ? 'senter_tegak' : 'senter_datar')
        .setFlipX(arah === 'left')
        .setFlipY(arah === 'up')
        .setScale(k)
        .setPosition(ox + t.alat[0] * k, oy + t.alat[1] * k)
        .setAlpha(muncul)
        .setDepth(p.s.depth + (t.belakang ? -0.1 : 0.1));
      // tangan di atas gagangnya
      p.tangan
        .clear()
        .fillStyle(this.kulit(p.s.texture.key), 1)
        .setAlpha(muncul)
        .setDepth(p.s.depth + 0.15);
      for (const [x, y] of t.genggam) p.tangan.fillRect(ox + x * k, oy + y * k, k, k);
    }
  }

  /**
   * Gambar ulang bentuk sorot yang tersisa setelah terpotong tembok.
   *
   * Kerucutnya disapu SINAR buah sinar dari tangan pemegangnya. Tiap sinar
   * maju per piksel sampai menabrak benda padat atau habis panjangnya, dan
   * ujung-ujungnya disambung jadi poligon. Tembok memotong seluruh kerucut di
   * tepinya; batu kecil hanya memotong satu-dua sinar, jadi yang terbentuk
   * bayangan sempit di belakangnya, bukan sorot yang mendadak memendek.
   *
   * Sinar berhenti beberapa piksel SETELAH titik tabraknya supaya kaki tembok
   * yang disorot ikut terang. Sinar paling luar dilebarkan sedikit melewati
   * bukaan kerucut, dan yang tidak menabrak apa pun dipanjangkan melewati
   * ujung tekstur, supaya mask tidak memangkas tepi kerucut yang lembut.
   *
   * Mask itu mahal di WebGL — tiap sorot bermask memaksa stencil dan memutus
   * batch gambar. Jadi mask hanya dipasang selama ada sinar yang benar-benar
   * menabrak; sorot di tanah lapang (hampir selalu) digambar polos. Sinarnya
   * pun hanya dihitung ulang saat tangan berpindah piksel atau arahnya ganti.
   */
  private pangkas(p: Pemegang, hx: number, hy: number, sudut: number) {
    const g = p.bentuk;
    if (!g || !this.penghalang) return;
    const kunci = `${hx},${hy},${sudut}`;
    if (kunci === p.kunci) return;
    p.kunci = kunci;
    const { panjang, buka } = SOROT;
    const dasar = Phaser.Math.DegToRad(sudut);
    const titik = this.titik;
    titik[0].set(hx, hy);
    let kena = false;
    for (let k = 0; k < SINAR; k++) {
      const a = dasar + (k / (SINAR - 1) - 0.5) * 2 * (buka + 0.06);
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let d = 2; // pangkal sinar di dalam genggaman, bukan di tembok yang dipeluk
      while (d < panjang && !this.penghalang(hx + dx * d, hy + dy * d)) d++;
      if (d < panjang) kena = true;
      d = d < panjang ? d + 3 : panjang + 8;
      titik[k + 1].set(hx + dx * d, hy + dy * d);
    }
    if (!kena) {
      if (p.sorot.mask) p.sorot.clearMask();
      return;
    }
    g.clear().fillStyle(0xffffff).fillPoints(titik, true);
    if (!p.sorot.mask) p.sorot.setMask(p.mask!);
  }
}
