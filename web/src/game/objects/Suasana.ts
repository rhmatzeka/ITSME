import Phaser from 'phaser';
import { AWAN, DEPTH, LAMPU, TILE, WAKTU } from '../config';

export type ModeWaktu = 'otomatis' | 'siang' | 'senja' | 'malam';

const KEDALAMAN = {
  tirai: DEPTH.above + 50,
  cahaya: DEPTH.above + 60,
  /**
   * Awan di atas SEMUA cahaya malam (lampu, jendela, layar monitor, api
   * unggun, senter — sampai DEPTH.above + 63). Dulu awan di bawah tirai malam
   * supaya ikut digelapkan, tapi akibatnya cahaya yang digambar di atas tirai
   * tembus menembus awan yang lewat. Sekarang gelapnya diberikan lewat tint
   * dengan warna tirai yang sama (lihat pakaiWarna), jadi tampaknya tetap
   * sama, dan cahaya di bawahnya tertutup awan seperti seharusnya.
   */
  awan: DEPTH.above + 65,
} as const;

/**
 * Titik-titik yang diterangi dari bawah (lingkaran penunjuk pintu dan kursi),
 * per scene. Penunjuk bisa dibuat sebelum Suasana, jadi disimpan di sini dan
 * dibaca setiap kali tirai digambar ulang.
 */
const LUBANG = new WeakMap<Phaser.Scene, { x: number; y: number }[]>();
/** Ukuran lubang cahaya di tirai, px dunia — sedikit lebih lebar dari riak terbesar. */
const LUBANG_W = 48;
const LUBANG_H = 22;

/**
 * Terangi satu titik di tanah dari tirai malam: di situ tirai dilubangi
 * lembut, jadi yang ada di bawahnya — lingkaran penunjuk, dan siapa pun yang
 * berdiri di atasnya — tampil dengan warna aslinya dan tetap tertutup oleh
 * karakter di depannya. (Cahaya ADD di atas tirai justru menimpa karakter.)
 */
export function lubangCahaya(scene: Phaser.Scene, x: number, y: number) {
  const daftar = LUBANG.get(scene) ?? [];
  daftar.push({ x, y });
  LUBANG.set(scene, daftar);
}

/** Palet awan: dua warna saja, seperti awan di langit game 8-bit. */
const WARNA_AWAN = {
  putih: [255, 255, 255],
  biru: [150, 208, 238],
} as const;

/** Resolusi tekstur cahaya relatif piksel dunia — lihat buatCahaya(). */
const HALUS = 4;

interface Lampu {
  genangan: Phaser.GameObjects.Image;
  inti: Phaser.GameObjects.Image;
  /** Denyut nyala api, 0.9..1, digerakkan tween. */
  denyut: number;
}

interface Kunang {
  img: Phaser.GameObjects.Image;
  /** Pendar lembut di sekeliling inti, ikut berdenyut. */
  pendar: Phaser.GameObjects.Image;
  besar: number;
  /** Titik jangkarnya; kunang-kunang berkeliaran di sekitar sini. */
  ax: number;
  ay: number;
  fase: number;
  laju: number;
  kedip: number;
}

/**
 * Tempat kunang-kunang berkumpul, px dunia: tepi sungai, sungai tegak di
 * barat, deretan pohon di selatan, dan kebun di barat laut.
 */
const SARANG_KUNANG = [
  // tepi utara & selatan sungai — BUKAN di atas airnya (y 377-404): di atas
  // biru, cahaya ADD berubah jadi titik biru pucat yang terbaca seperti
  // sesuatu yang berenang, bukan kunang-kunang
  { x0: 40, x1: 610, y0: 352, y1: 372, n: 14 },
  { x0: 40, x1: 610, y0: 410, y1: 428, n: 14 },
  { x0: 8, x1: 60, y0: 30, y1: 350, n: 9 },
  { x0: 30, x1: 610, y0: 462, y1: 515, n: 18 },
  { x0: 80, x1: 170, y0: 190, y1: 330, n: 10 },
];

interface Awan {
  img: Phaser.GameObjects.Image;
  /** Pusat jalur ketinggiannya, px dunia. */
  lajur: number;
  laju: number;
  /** Posisi sebenarnya (pecahan); yang digambar dikunci ke grid piksel layar. */
  x: number;
  y: number;
}

/**
 * Suasana desa: awan yang lewat, siang-malam, dan lampu jalan.
 *
 * Ketiganya satu kelas karena saling bergantung: lampu menyala persis sebanyak
 * langitnya gelap, dan awan ikut kebiruan di malam hari karena diwarnai
 * dengan warna tirai malam. Semuanya di atas dunia tapi di bawah efek petir, jadi
 * petir tetap menyilaukan di malam hari.
 */
export class Suasana {
  /**
   * Tirai malam: putih, dilubangi di titik-titik lubangCahaya(), lalu
   * diwarnai lewat tint. Isinya hanya digambar ulang kalau jumlah lubangnya
   * berubah — bukan tiap frame peralihan waktu (lihat gambarTirai).
   */
  private tirai: Phaser.GameObjects.RenderTexture;
  private warnaTirai = -1;
  private lubangTergambar = -1;
  private awan: Awan[] = [];
  private lampu: Lampu[] = [];
  private mode: ModeWaktu = 'otomatis';
  /** Warna tirai yang sedang tampil, 0..255 per kanal. */
  private warna = { r: 255, g: 255, b: 255 };
  private peralihan?: Phaser.Tweens.Tween;
  private malam = 0;
  private kunang: Kunang[] = [];
  /** Sudah gelap penuh pada pemeriksaan terakhir — untuk mendeteksi saat malam tiba. */
  private tadiGelap = false;
  /**
   * Dipanggil sekali tiap kali malam tiba menurut jam pengunjung. Tidak
   * dipanggil kalau malamnya dipilih sendiri di Setelan: orang yang baru
   * menekan "Night" tidak perlu diberi tahu bahwa sekarang malam.
   */
  onMalamTiba?: () => void;

  constructor(
    private scene: Phaser.Scene,
    private lebar: number,
    private tinggi: number
  ) {
    this.buatAwan();
    this.buatCahaya();

    /*
     * Tirai MULTIPLY selebar peta. Putih tidak mengubah apa pun, biru gelap
     * menggelapkan sambil mendinginkan warnanya — lebih mirip malam daripada
     * lapisan hitam transparan yang cuma membuat semuanya kusam. Berupa
     * RenderTexture supaya bisa dilubangi di bawah lingkaran penunjuk.
     */
    this.tirai = scene.add
      .renderTexture(0, 0, lebar, tinggi)
      .setOrigin(0)
      .setDepth(KEDALAMAN.tirai)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.pasangAwan();
    this.pasangLampu();
    this.pasangKunang();

    scene.events.on('update', this.detak, this);
    // jam asli terus berjalan: dicek ulang tiap setengah menit
    const jam = scene.time.addEvent({ delay: 30_000, loop: true, callback: () => this.terapkan(false) });
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.detak, this);
      jam.remove();
    });
  }

  /** Seberapa gelap desa sekarang: 0 siang, 1 malam — untuk senter warga. */
  get gelap() {
    return this.malam;
  }

  /** Desa sedang gelap penuh karena jam pengunjung (bukan pilihan di Setelan). */
  get malamMenurutJam() {
    return this.mode === 'otomatis' && this.malam >= 0.9;
  }

  /** Ganti pilihan waktu dari panel Setelan. */
  setMode(mode: ModeWaktu, langsung = false) {
    this.mode = mode;
    this.terapkan(!langsung);
  }

  /* ---------------- awan ---------------- */

  /**
   * Awan pixel art bergaya langit game 8-bit: pipih memanjang, tanpa garis
   * tepi, dua warna — putih di atas, biru muda di bawah — dengan tepi
   * bertangga kasar dan ekor tipis panjang di kedua ujungnya.
   *
   * Digambar per "blok" 2×2 piksel dunia. Profil atasnya gabungan beberapa
   * gundukan, lalu disamakan per deret 2-4 kolom supaya tepinya berupa anak
   * tangga lebar, bukan kurva halus. Batas putih-birunya ikut bertangga,
   * sehingga bagian biru menyembul naik di beberapa tempat.
   */
  private buatAwan() {
    const tx = this.scene.textures;
    const B = 2; // piksel dunia per blok
    for (let v = 0; v < AWAN.ragam; v++) {
      const key = `awan_${v}`;
      if (tx.exists(key)) continue;
      const acak = new Phaser.Math.RandomDataGenerator([`awan-langit-${v}`]);
      const kolom = [34, 44, 56, 28, 48][v % 5];
      const puncak = [8, 10, 12, 7, 9][v % 5];
      const perut = [2, 3, 3, 2, 3][v % 5];

      // deret kolom yang tingginya disamakan → anak tangga lebar
      const deret = (nilai: (x: number) => number) => {
        const hasil: number[] = [];
        let x = 0;
        while (x < kolom) {
          const lebar = acak.between(2, 4);
          const n = Math.round(nilai(Math.min(kolom - 1, x + (lebar >> 1))));
          for (let k = 0; k < lebar && x < kolom; k++, x++) hasil.push(n);
        }
        return hasil;
      };

      // gundukan tersebar merata di sepanjang awan, bukan menumpuk di tengah
      const nG = 3 + Math.round(kolom / 14);
      const gundukan = Array.from({ length: nG }, (_, i) => ({
        c: 0.18 + (0.64 * (i + acak.realInRange(0.2, 0.8))) / nG,
        s: acak.realInRange(0.1, 0.17),
        a: acak.realInRange(0.5, 1),
      }));
      const mengecil = (t: number) => Math.sin(Math.PI * t) ** 0.7;
      const atas = deret((x) => {
        const t = x / (kolom - 1);
        const g = Math.max(...gundukan.map((b) => b.a * Math.exp(-(((t - b.c) / b.s) ** 2))));
        return Math.max(1, g * puncak * mengecil(t) + acak.realInRange(-0.6, 0.6));
      });
      const bawah = deret((x) => {
        const t = x / (kolom - 1);
        return Math.max(0, perut * Math.sin(Math.PI * t) ** 1.6 + acak.realInRange(-0.7, 0.5));
      });
      // batas putih-biru: putih mendominasi, biru pita bawah yang ikut bertangga
      const batas = deret((x) => atas[x] * acak.realInRange(0.12, 0.35));

      const baris = puncak + perut + 1;
      const w = kolom * B;
      const h = baris * B;
      const alas = puncak; // baris blok tempat alas awan
      const kanvas = tx.createCanvas(key, w, h)!;
      const ctx = kanvas.getContext();
      const data = ctx.createImageData(w, h);
      const warnai = (bx: number, by: number, c: readonly number[], a: number) => {
        for (let y = by * B; y < by * B + B; y++) {
          for (let x = bx * B; x < bx * B + B; x++) {
            const i = (y * w + x) * 4;
            data.data[i] = c[0];
            data.data[i + 1] = c[1];
            data.data[i + 2] = c[2];
            data.data[i + 3] = a;
          }
        }
      };
      for (let x = 0; x < kolom; x++) {
        for (let y = alas - atas[x]; y <= alas + bawah[x]; y++) {
          const putih = y < alas - batas[x];
          warnai(x, y, putih ? WARNA_AWAN.putih : WARNA_AWAN.biru, putih ? 255 : 225);
        }
      }
      ctx.putImageData(data, 0, 0);
      kanvas.refresh();
    }
  }

  /** Jumlah awan dan jalurnya ikut lebar layar, sama seperti zoom kamera. */
  private jumlahLajur: number = AWAN.lajur.desktop;

  private pasangAwan() {
    const hp = this.scene.scale.width < 700;
    const jumlah = hp ? AWAN.jumlah.hp : AWAN.jumlah.desktop;
    this.jumlahLajur = hp ? AWAN.lajur.hp : AWAN.lajur.desktop;
    const nLajur = this.jumlahLajur;
    const tinggiLajur = this.tinggi / nLajur;
    const putaran = this.lebar + 200; // lebar peta + ruang masuk dari kiri
    // urutan x diacak per lajur supaya lajur yang berdekatan tidak berbaris miring
    const urut = Phaser.Utils.Array.Shuffle([...Array(nLajur).keys()]);
    for (let i = 0; i < jumlah; i++) {
      const lajur = i % nLajur;
      const ke = Math.floor(i / nLajur); // awan ke berapa di lajur ini
      const perLajur = Math.ceil(jumlah / nLajur);
      const img = this.scene.add
        .image(0, 0, `awan_${i % AWAN.ragam}`)
        .setOrigin(0.5)
        .setDepth(KEDALAMAN.awan)
        .setAlpha(AWAN.pekat);
      const a: Awan = {
        img,
        lajur: (lajur + 0.5) * tinggiLajur,
        laju: Phaser.Math.FloatBetween(AWAN.laju.min, AWAN.laju.max),
        x:
          (((urut[lajur] / nLajur + ke / perLajur + Phaser.Math.FloatBetween(0, 0.12)) % 1) * putaran) - 100,
        y: 0,
      };
      a.y = a.lajur + Phaser.Math.FloatBetween(-tinggiLajur * 0.3, tinggiLajur * 0.3);
      this.awan.push(a);
      this.tempatkan(a);
    }
  }

  /**
   * Posisi gambar dikunci ke kelipatan 1/zoom — grid piksel layar yang sama
   * dengan tile. Kalau dibiarkan pecahan sembarang, tiap piksel awan jatuh di
   * titik yang berbeda dari tile di bawahnya dan tepinya bergoyang lebar
   * 3-4 piksel bergantian: terbaca sebagai gerak yang tersendat. Dikunci,
   * awannya bergeser tepat satu piksel layar setiap langkah.
   */
  private tempatkan(a: Awan) {
    const z = this.scene.cameras.main.zoom;
    a.img.setPosition(Math.round(a.x * z) / z, Math.round(a.y * z) / z);
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    // penunjuk yang dibuat setelah tirai terakhir digambar: lubangi juga
    if (this.warnaTirai >= 0 && (LUBANG.get(this.scene)?.length ?? 0) !== this.lubangTergambar) this.lubangiTirai();
    this.gerakKunang(t);
    const tinggiLajur = this.tinggi / this.jumlahLajur;
    for (const a of this.awan) {
      a.x += a.laju * dt;
      const w = a.img.width;
      // lewat di kanan → masuk lagi dari kiri di lajurnya sendiri, bentuk baru
      if (a.x - w / 2 > this.lebar) {
        a.img.setTexture(`awan_${Phaser.Math.Between(0, AWAN.ragam - 1)}`);
        a.x = -a.img.width / 2 - Phaser.Math.Between(10, 140);
        a.y = a.lajur + Phaser.Math.FloatBetween(-tinggiLajur * 0.3, tinggiLajur * 0.3);
        a.laju = Phaser.Math.FloatBetween(AWAN.laju.min, AWAN.laju.max);
      }
      this.tempatkan(a);
    }
  }

  /* ---------------- kunang-kunang ---------------- */

  /**
   * Titik-titik cahaya kuning yang melayang, hanya saat malam.
   *
   * Tiap ekor berputar pelan mengelilingi titik jangkarnya dengan lintasan
   * yang tidak pernah persis sama (dua gelombang dengan periode berbeda),
   * dan berkedip dengan iramanya sendiri — kadang padam sebentar, seperti
   * kunang-kunang sungguhan. Digambar ADD di atas tirai malam supaya
   * benar-benar menyala, bukan ikut digelapkan.
   */
  private pasangKunang() {
    const tx = this.scene.textures;
    // inti: 2×2 piksel tajam, putih kekuningan
    if (!tx.exists('kunang_inti')) {
      const k = tx.createCanvas('kunang_inti', 2, 2)!;
      const c = k.getContext();
      c.fillStyle = '#fffbd0';
      c.fillRect(0, 0, 2, 2);
      k.refresh();
    }
    // pendar: gradien bulus halus (digambar HALUS× lebih rapat lalu
    // dikecilkan), kuning kehijauan seperti kunang-kunang sungguhan
    if (!tx.exists('kunang_pendar')) {
      const R = 11 * HALUS;
      const k = tx.createCanvas('kunang_pendar', R * 2, R * 2)!;
      const c = k.getContext();
      const gr = c.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, 'rgba(240, 255, 150, 1)');
      gr.addColorStop(0.2, 'rgba(220, 252, 120, 0.7)');
      gr.addColorStop(0.5, 'rgba(180, 235, 90, 0.25)');
      gr.addColorStop(1, 'rgba(150, 220, 60, 0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, R * 2, R * 2);
      k.refresh();
    }
    for (const sarang of SARANG_KUNANG) {
      for (let i = 0; i < sarang.n; i++) {
        const ax = Phaser.Math.Between(sarang.x0, sarang.x1);
        const ay = Phaser.Math.Between(sarang.y0, sarang.y1);
        const besar = Phaser.Math.FloatBetween(0.7, 1.15);
        const pendar = this.scene.add
          .image(ax, ay, 'kunang_pendar')
          .setScale(besar / HALUS)
          .setDepth(KEDALAMAN.cahaya + 2)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0);
        const img = this.scene.add
          .image(ax, ay, 'kunang_inti')
          .setDepth(KEDALAMAN.cahaya + 3)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0);
        this.kunang.push({
          img,
          pendar,
          besar,
          ax,
          ay,
          fase: Math.random() * Math.PI * 2,
          laju: Phaser.Math.FloatBetween(0.3, 0.6),
          kedip: Phaser.Math.FloatBetween(1.1, 2.2),
        });
      }
    }
  }

  private gerakKunang(t: number) {
    if (this.malam <= 0.02) {
      for (const k of this.kunang) {
        if (k.img.visible) {
          k.img.setVisible(false);
          k.pendar.setVisible(false);
        }
      }
      return;
    }
    const s = t / 1000;
    const z = this.scene.cameras.main.zoom;
    for (const k of this.kunang) {
      const f = k.fase + s * k.laju;
      const x = k.ax + Math.sin(f) * 12 + Math.sin(f * 2.3) * 4;
      const y = k.ay + Math.cos(f * 0.8) * 6 - Math.sin(f * 1.7) * 3;
      // denyut: menyala, meredup, sesekali padam sebentar
      const n = Math.sin(s * k.kedip + k.fase * 3);
      const nyala = this.malam * Phaser.Math.Clamp(0.4 + n * 0.8, 0, 1);
      // inti dikunci ke grid piksel layar supaya tetap tajam
      k.img.setVisible(true).setPosition(Math.round(x * z) / z, Math.round(y * z) / z).setAlpha(nyala);
      k.pendar
        .setVisible(true)
        .setPosition(x + 1, y + 1)
        .setAlpha(Math.min(1, nyala * 1.1))
        .setScale((k.besar * (0.85 + nyala * 0.3)) / HALUS);
    }
  }

  /* ---------------- lampu ---------------- */

  /**
   * Cahaya lampu: genangan lonjong di tanah dan titik terang di lenteranya.
   *
   * Genangannya elips, bukan lingkaran — kameranya menatap tanah dari atas
   * dengan sudut, jadi lingkaran cahaya di tanah terlihat pipih. Gradiennya
   * halus dan digambar 4× lebih rapat dari piksel dunia (lalu dikecilkan),
   * sehingga di layar tidak ada pita-pita cincin yang terbaca seperti papan
   * sasaran.
   */
  private buatCahaya() {
    const tx = this.scene.textures;
    const gradasi = (key: string, rx: number, ry: number, puncak: number, warna: string) => {
      if (tx.exists(key)) return;
      const w = rx * 2 * HALUS;
      const h = ry * 2 * HALUS;
      const kanvas = tx.createCanvas(key, w, h)!;
      const ctx = kanvas.getContext();
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, ry / rx);
      const r = rx * HALUS;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${warna}, ${puncak})`);
      g.addColorStop(0.35, `rgba(${warna}, ${puncak * 0.62})`);
      g.addColorStop(0.7, `rgba(${warna}, ${puncak * 0.2})`);
      g.addColorStop(1, `rgba(${warna}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      kanvas.refresh();
    };
    // lubang di tirai: tengahnya hampir terang penuh, tepinya memudar
    if (!this.scene.textures.exists('lubang_cahaya')) {
      const k = this.scene.textures.createCanvas('lubang_cahaya', LUBANG_W, LUBANG_H)!;
      const ctx = k.getContext();
      ctx.save();
      ctx.translate(LUBANG_W / 2, LUBANG_H / 2);
      ctx.scale(1, LUBANG_H / LUBANG_W);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, LUBANG_W / 2);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      g.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, LUBANG_W / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      k.refresh();
    }
    const { rx, ry } = LAMPU.genangan;
    gradasi('lampu_genangan', rx, ry, 0.42, '255, 190, 105');
    gradasi('lampu_inti', 6, 6, 0.85, '255, 226, 150');
  }

  private pasangLampu() {
    for (const [tx, ty] of LAMPU.tiang) {
      const x = tx * TILE + LAMPU.lentera.x;
      const y = ty * TILE + LAMPU.lentera.y;
      const genangan = this.scene.add
        .image(x, y + LAMPU.genangan.turun, 'lampu_genangan')
        .setScale(1 / HALUS)
        .setDepth(KEDALAMAN.cahaya)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      const inti = this.scene.add
        .image(x, y, 'lampu_inti')
        .setScale(1 / HALUS)
        .setDepth(KEDALAMAN.cahaya + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.lampu.push({ genangan, inti, denyut: 1 });
    }
    // Nyala api: berdenyut pelan, tiap lampu dengan iramanya sendiri — bukan
    // kedip acak per frame yang terlihat seperti lampu rusak.
    this.lampu.forEach((l, i) => {
      this.scene.tweens.add({
        targets: l,
        denyut: { from: 0.9, to: 1 },
        duration: 900 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => this.nyalakan(l),
      });
    });
  }

  private nyalakan(l: Lampu) {
    const d = l.denyut;
    l.genangan.setAlpha(this.malam * d);
    l.inti.setAlpha(this.malam * (0.8 + (d - 0.9) * 2));
  }

  /* ---------------- siang-malam ---------------- */

  private jamSekarang() {
    if (this.mode !== 'otomatis') return WAKTU.preset[this.mode];
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  private warnaUntuk(jam: number) {
    const t = WAKTU.titik;
    for (let i = 0; i < t.length - 1; i++) {
      const [j0, c0] = t[i];
      const [j1, c1] = t[i + 1];
      if (jam >= j0 && jam <= j1) {
        const f = j1 === j0 ? 0 : (jam - j0) / (j1 - j0);
        const a = Phaser.Display.Color.IntegerToRGB(c0);
        const b = Phaser.Display.Color.IntegerToRGB(c1);
        return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f };
      }
    }
    return { r: 255, g: 255, b: 255 };
  }

  /** Seberapa "malam" sebuah warna: 0 siang, 1 semalam-malamnya. */
  private kegelapan(w: { r: number; g: number; b: number }) {
    const lum = (c: { r: number; g: number; b: number }) => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    const malam = Phaser.Display.Color.IntegerToRGB(WAKTU.titik[0][1]);
    return Phaser.Math.Clamp((1 - lum(w)) / (1 - lum(malam)), 0, 1);
  }

  private terapkan(beralih: boolean) {
    const tujuan = this.warnaUntuk(this.jamSekarang());
    this.peralihan?.stop();
    if (!beralih) {
      this.warna = tujuan;
      this.pakaiWarna();
      return;
    }
    const dari = { ...this.warna };
    this.peralihan = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: WAKTU.peralihan,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 1;
        this.warna = {
          r: dari.r + (tujuan.r - dari.r) * f,
          g: dari.g + (tujuan.g - dari.g) * f,
          b: dari.b + (tujuan.b - dari.b) * f,
        };
        this.pakaiWarna();
      },
    });
  }

  private pakaiWarna() {
    const { r, g, b } = this.warna;
    const warna = Phaser.Display.Color.GetColor(Math.round(r), Math.round(g), Math.round(b));
    this.gambarTirai(warna);
    // awan di atas tirai: digelapkan dengan warna yang sama, seperti MULTIPLY tirai
    for (const a of this.awan) a.img.setTint(warna);
    this.malam = this.kegelapan(this.warna);
    for (const l of this.lampu) this.nyalakan(l);
    // ambang berjarak (0,9 masuk, 0,5 keluar) supaya tidak berkedip di batas
    if (this.malam >= 0.9 && !this.tadiGelap) {
      this.tadiGelap = true;
      if (this.mode === 'otomatis') this.onMalamTiba?.();
    } else if (this.malam < 0.5) {
      this.tadiGelap = false;
    }
  }

  /**
   * Warnai tirai. Isinya putih dengan lubang-lubang lembut, dan warnanya
   * datang dari tint: dengan MULTIPLY hasilnya persis sama dengan mengisi
   * tirai berwarna lalu melubanginya — piksel berlubang yang tersisa alfa a
   * menjadi warna × a + putih × (1 − a) — tapi mengganti tint tidak menyentuh
   * isi teksturnya sama sekali.
   *
   * Dulu tiap frame peralihan waktu (1,4 detik) tirai selebar peta dikosongkan,
   * diisi, lalu dilubangi satu per satu. Di GPU ponsel tiap gambar ke tekstur
   * berarti berpindah framebuffer, dan itulah yang membuat desa (juga tombol
   * Setelan) tersendat setelah waktu diganti.
   *
   * Siang hari tirainya disembunyikan: putih × apa pun tidak mengubah apa pun,
   * jadi tidak perlu dilukis selebar layar tiap frame.
   */
  private gambarTirai(warna: number) {
    if (this.lubangTergambar < 0) this.lubangiTirai();
    this.warnaTirai = warna;
    this.tirai.setVisible(warna !== 0xffffff).setTint(warna);
  }

  /** Isi tirai dengan putih lalu lubangi di tiap titik lubangCahaya(). */
  private lubangiTirai() {
    const lubang = LUBANG.get(this.scene) ?? [];
    this.lubangTergambar = lubang.length;
    this.tirai.clear().fill(0xffffff);
    for (const { x, y } of lubang) this.tirai.erase('lubang_cahaya', Math.round(x - LUBANG_W / 2), Math.round(y - LUBANG_H / 2));
  }
}
