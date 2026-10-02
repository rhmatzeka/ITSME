import Phaser from 'phaser';
import { gerimis, kecipak, tikHujan } from '../bunyi';
import { DEPTH, PLAYER, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { spritesheetTeks } from './piksel';
import { arahDariFrame } from './Senter';
import type { Suasana } from './Suasana';

/** Di bawah tirai malam (DEPTH.above + 50): ikut gelap dan ikut mendung. */
const KEDALAMAN = DEPTH.above + 40;

/** Lama tiap babak hujan, ms. */
const BABAK = {
  /** Awan berkumpul sebelum tetes pertama. */
  mendung: 6000,
  /** Gerimis menderas / mereda. */
  peralihan: 9000,
  /** Gerimis penuh: [min, maks]. */
  deras: [45000, 80000],
  /** Hujan pertama sejak desa dibuka: [min, maks]. */
  pertama: [100000, 170000],
  /** Jeda di antara dua hujan: [min, maks], dan peluang hujan jadi turun. */
  jeda: [300000, 540000],
  peluang: 0.6,
} as const;

/** Laju jatuh tetes, px dunia per detik — miring ke timur, searah awan. */
const JATUH = { y: [190, 240], x: 38 };

/** Tempat genangan, px dunia: calon di jalan tanah dan jalan batu — disaring lagi saat dimuat. */
const CALON_GENANGAN = [
  [150, 204], [250, 206], [330, 200], [200, 106], [300, 104], [420, 102],
  [376, 300], [376, 250], [128, 300], [128, 350], [548, 250], [495, 318],
  [520, 140], [230, 484], [60, 470], [420, 480], [560, 110], [100, 204],
] as const;

/** Pilihan cuaca di panel Setelan. */
export type ModeCuaca = 'otomatis' | 'cerah' | 'gerimis';

interface Tetes {
  img: Phaser.GameObjects.Image;
  /** Posisi relatif ke pojok kiri atas kamera, px dunia. */
  x: number;
  y: number;
  vy: number;
  /** Di ketinggian layar mana tetes ini menyentuh tanah. */
  jatuh: number;
}

interface Genangan {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

/**
 * Gerimis yang sesekali turun di desa.
 *
 * Satu hujan berjalan dalam babak: langit mendung dulu (awan menebal dan
 * kelabu, desa meredup), tetes pertama turun dan makin rapat, gerimis
 * bertahan satu dua menit, lalu reda dan langit cerah lagi. Tanahnya basah
 * lebih lama dari hujannya: genangan muncul di jalan tanah selama gerimis
 * dan baru surut pelan-pelan sesudahnya.
 *
 * Tetesnya tidak disebar di seluruh peta, cuma di layar: tiap tetes
 * menyimpan posisinya relatif ke kamera, jadi berapa pun luas desanya yang
 * digerakkan tetap segelintir. Tetes yang sampai di tanah memercik, dan
 * yang jatuh di genangan membuat riak.
 *
 * Yang lain membaca `cuaca`: anak-anak berteduh, kodok bersahutan di siang
 * bolong, kupu-kupu hinggap, warga yang berjalan membuka payung — dipasang
 * di sini lewat `payungi()`.
 */
export class Hujan {
  private tetes: Tetes[] = [];
  private cipratan: Phaser.GameObjects.Sprite[] = [];
  private riak: Phaser.GameObjects.Sprite[] = [];
  private genangan: Genangan[] = [];
  private payung: {
    s: Phaser.GameObjects.Sprite;
    /** Kubah payungnya. */
    p: Phaser.GameObjects.Image;
    /** Gambar pengganti karakternya selama berpayung — lihat buatLembarPayung(). */
    t: Phaser.GameObjects.Image;
    /** Lembar asal karakternya; di lembar lain (pose khusus) penggantinya tidak dipakai. */
    sumber: string;
    /** Baris puncak kepala per arah hadap. */
    atas: number[];
    /** Karakter aslinya sedang tidak digambar (dipotong habis). */
    diganti: boolean;
  }[] = [];
  /** Derasnya gerimis dan tebalnya mendung sekarang, dan ke mana keduanya menuju. */
  private kuat = 0;
  private awan = 0;
  private tujuanKuat = 0;
  private tujuanAwan = 0;
  private sedang = false;
  private jedaRiak = 0;
  private jedaTik = 0;
  private jedaKecipak = 0;

  constructor(
    private scene: Phaser.Scene,
    private suasana: Suasana | undefined,
    /** Apakah titik ini jalan tanah/batu yang bisa digenangi. */
    tanah: (x: number, y: number) => boolean,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    this.buatTekstur();
    const hp = scene.scale.width < 700;
    for (let i = 0; i < (hp ? 40 : 70); i++) {
      const img = scene.add.image(0, 0, 'tetes_hujan').setOrigin(0, 0).setDepth(KEDALAMAN).setAlpha(0.8).setVisible(false);
      this.tetes.push({ img, x: 0, y: 0, vy: 0, jatuh: 0 });
      this.lahirkan(this.tetes[i], true);
    }
    for (let i = 0; i < 14; i++) {
      this.cipratan.push(scene.add.sprite(0, 0, 'cipratan', 0).setDepth(KEDALAMAN - 1).setAlpha(0.7).setVisible(false));
    }
    for (let i = 0; i < 8; i++) {
      this.riak.push(scene.add.sprite(0, 0, 'riak', 0).setDepth(DEPTH.below + 0.8).setAlpha(0.8).setVisible(false));
    }
    for (const [x, y] of CALON_GENANGAN) {
      // seluruh genangan (14×5) harus di atas jalan, bukan menjulur ke rumput
      const ok = [
        [0, 0], [-6, 0], [6, 0], [-3, -2], [3, 2],
      ].every(([dx, dy]) => tanah(x + dx, y + dy));
      if (!ok) continue;
      const img = scene.add
        .image(x, y, 'genangan_hujan', Phaser.Math.Between(0, 1))
        .setDepth(DEPTH.below + 0.7)
        .setAlpha(0)
        .setVisible(false);
      this.genangan.push({ img, x, y });
    }

    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.detak, this);
      gerimis.setel(0);
    });
    this.jadwalkan(Phaser.Math.Between(BABAK.pertama[0], BABAK.pertama[1]));
  }

  private buatTekstur() {
    const s = this.scene;
    // tetes 2×4: garis miring, ujung bawahnya lebih terang
    spritesheetTeks(s, 'tetes_hujan', [['a.', 'a.', '.b', '.b']], { a: 'rgba(214,230,255,0.75)', b: '#f0f6ff' });
    spritesheetTeks(
      s,
      'cipratan',
      [
        ['.....', '..w..', '.....'],
        ['.w.w.', '.....', '.....'],
        ['w...w', '.....', '.....'],
      ],
      { w: '#e8f2ff' }
    );
    // riak di genangan: elips yang melebar lalu hilang
    spritesheetTeks(
      s,
      'riak',
      [
        ['.......', '..www..', '.......'],
        ['.wwwww.', 'w.....w', '.wwwww.'],
      ],
      { w: 'rgba(220,236,255,0.8)' }
    );
    // genangan 14×5 dua bentuk: biru kelabu memantulkan langit, tepinya lebih gelap
    spritesheetTeks(
      s,
      'genangan_hujan',
      [
        ['...dddddd.....', '.ddmmllmmddd..', 'dmmmmmmmlllmdd', '.ddmllmmmmmdd.', '...ddddddd....'],
        ['....dddddddd..', '..ddmllmmmmdd.', '.dmmmmmmmlllmd', 'ddmmllmmmmmdd.', '.ddddddd......'],
      ],
      { d: 'rgba(96,112,140,0.75)', m: 'rgba(118,150,196,0.9)', l: 'rgba(214,232,252,0.95)' }
    );
    /*
     * Payung: kubahnya satu tekstur per warna (21×10, dilihat agak dari atas:
     * pucuk, empat bilah dari terang ke gelap, tepi bergelombang). Gagang dan
     * lengan yang menggenggamnya dibuat per lembar karakter di
     * buatPegangan(), karena ikut arah hadap, warna kulit, dan warna bajunya.
     */
    const kubah = [
      '..........k..........',
      '.......kkkhkkk.......',
      '.....kkhaahbbbkk.....',
      '...kkhaaaahbbbbckk...',
      '..khaaaaaahbbbbbcck..',
      '.khaaaaaaahbbbbbbcck.',
      '.kaaaaaaaakbbbbbbbck.',
      'kaaaaaaaaakbbbbbbbcck',
      'kaakkaaaakkkbbbbkkcck',
      '.kk..kkkk...kkkk..kk.',
    ];
    for (const [nama, h, a, b, c] of PAYUNG) {
      spritesheetTeks(s, nama, [kubah], { h, a, b, c, k: '#2a2420' });
    }
    if (!s.anims.exists('cipratan')) {
      s.anims.create({ key: 'cipratan', frames: s.anims.generateFrameNumbers('cipratan', {}), frameRate: 14, hideOnComplete: true });
      s.anims.create({ key: 'riak', frames: s.anims.generateFrameNumbers('riak', {}), frameRate: 6, hideOnComplete: true });
    }
  }

  /** Warga yang berjalan membuka payung saat gerimis. */
  payungi(orang: Phaser.GameObjects.Sprite[]) {
    orang.forEach((s, i) => {
      const sumber = s.texture.key;
      const lembar = this.buatLembarPayung(sumber);
      const p = this.scene.add.image(0, 0, PAYUNG[i % PAYUNG.length][0]).setOrigin(0).setVisible(false);
      const t = this.scene.add.image(0, 0, lembar.key, 0).setOrigin(0).setVisible(false);
      this.payung.push({ s, p, t, sumber, atas: lembar.atas, diganti: false });
    });
  }

  /**
   * Lembar sprite "berjalan sambil memegang payung" untuk satu lembar
   * karakter, dengan tata letak frame yang sama (4 kolom × 8 baris). Selama
   * gerimis karakter aslinya tidak digambar (lihat aturPayung) dan frame
   * dari lembar inilah yang tampil di tempatnya.
   *
   * Tiap frame disusun dari frame diam arah itu — badan atas tidak ikut
   * berayun — dengan kaki dari frame jalannya, lalu lengan pemegangnya
   * digambar ulang: tangan yang menggantung dihapus, diganti lengan
   * terangkat dengan kepalan menggenggam gagang. Jadi yang bergerak cuma
   * kaki; tangan satunya diam di samping badan.
   *
   * Dua versi sebelumnya menumpuk gambar di atas karakter aslinya. Itu tidak
   * bisa menghapus apa pun: lengan aslinya tetap berayun di bawah tumpukan,
   * sehingga terlihat tiga tangan, atau dua tangan yang sama-sama bergerak
   * padahal satunya memegang payung.
   *
   * Mengembalikan juga baris puncak kepala tiap arah, tempat kubahnya ditaruh.
   */
  private buatLembarPayung(sumber: string) {
    const key = `payung_lembar_${sumber}`;
    const tx = this.scene.textures;
    const S = 32;
    const KOLOM = 4;
    const BARIS = 8;
    const src = tx.get(sumber).getSourceImage() as CanvasImageSource;
    const baca = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    baca.canvas.width = S * KOLOM;
    baca.canvas.height = S * BARIS;
    baca.drawImage(src, 0, 0, S * KOLOM, S * BARIS, 0, 0, S * KOLOM, S * BARIS);
    const data = baca.getImageData(0, 0, S * KOLOM, S * BARIS).data;
    /** Piksel (x, y) di frame `f`: [r, g, b] atau null kalau kosong. */
    const px = (x: number, y: number, f: number) => {
      const i = ((Math.floor(f / KOLOM) * S + y) * S * KOLOM + (f % KOLOM) * S + x) * 4;
      return data[i + 3] ? [data[i], data[i + 1], data[i + 2]] : null;
    };
    const atas = URUT_PAYUNG.map((_, arah) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (px(x, y, arah * KOLOM)) return y;
      return 13;
    });
    if (tx.exists(key)) return { key, atas };

    const kulit = px(20, 27, 0) ?? [232, 180, 138];
    const sepertiKulit = (c: number[]) => Math.abs(c[0] - kulit[0]) + Math.abs(c[1] - kulit[1]) + Math.abs(c[2] - kulit[2]) < 70;
    const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
    // warna baju per arah: yang terbanyak di badan frame diam (bukan kulit, bukan garis tepi)
    const baju = URUT_PAYUNG.map((_, arah) => {
      const hitung = new Map<string, number>();
      for (let y = 24; y <= 27; y++) {
        for (let x = 12; x <= 19; x++) {
          const c = px(x, y, arah * KOLOM);
          if (!c || sepertiKulit(c) || c[0] + c[1] + c[2] <= 230) continue;
          hitung.set(rgb(c), (hitung.get(rgb(c)) ?? 0) + 1);
        }
      }
      return [...hitung].sort((a, b) => b[1] - a[1])[0]?.[0] ?? rgb(kulit);
    });

    const kanvas = tx.createCanvas(key, S * KOLOM, S * BARIS)!;
    const ctx = kanvas.getContext();
    const KAKI = 29; // baris pertama kaki: di atasnya badan, yang diambil dari frame diam
    for (let f = 0; f < KOLOM * BARIS; f++) {
      const baris = Math.floor(f / KOLOM);
      const arah = baris % 4;
      const a = PEGANG_PAYUNG[URUT_PAYUNG[arah]];
      const ox = (f % KOLOM) * S;
      const oy = baris * S;
      // badan atas dari frame diam arah itu; kaki dari frame jalannya sendiri
      ctx.drawImage(src, 0, arah * S, S, KAKI, ox, oy, S, KAKI);
      const kaki = baris >= 4 ? f : arah * KOLOM;
      ctx.drawImage(src, (kaki % KOLOM) * S, Math.floor(kaki / KOLOM) * S + KAKI, S, S - KAKI, ox, oy + KAKI, S, S - KAKI);

      const titik = (x: number, y: number, w: string) => {
        ctx.fillStyle = w;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      };
      if (a.hapus) ctx.clearRect(ox + a.hapus[0], oy + a.hapus[1], a.hapus[2] - a.hapus[0] + 1, a.hapus[3] - a.hapus[1] + 1);
      for (const [x, y] of a.baju) titik(x, y, baju[arah]);
      for (const [x, y] of a.tinta) titik(x, y, '#45293f');
      for (const [x, y] of a.kulit) titik(x, y, rgb(kulit));
      // gagang: dari tengah kubah turun ke kepalan, lurus atau miring
      const y0 = atas[arah] - 2;
      const [gx, gy] = a.gagang;
      for (let y = y0; y <= gy; y++) titik(Math.round(a.kubah + ((gx - a.kubah) * (y - y0)) / (gy - y0)), y, GAGANG);
      kanvas.add(f, 0, ox, oy, S, S);
    }
    kanvas.refresh();
    return { key, atas };
  }

  /** Pilihan cuaca di Setelan — lihat setMode(). */
  private mode: ModeCuaca = 'otomatis';
  /** Babak yang sedang menunggu giliran: tetes pertama, reda, atau hujan berikutnya. */
  private jadwal: Phaser.Time.TimerEvent[] = [];

  /**
   * Pilihan cuaca dari panel Setelan: `otomatis` = gerimis sesekali menurut
   * jadwal, `cerah` = tidak pernah hujan (yang sedang turun mereda),
   * `gerimis` = hujan terus sampai pilihannya diganti.
   */
  setMode(mode: ModeCuaca) {
    this.mode = mode;
    this.batalkan();
    if (mode === 'gerimis') {
      if (this.sedang) this.tujuanKuat = this.tujuanAwan = 1;
      else this.mulai(Infinity);
    } else if (mode === 'cerah') {
      if (this.sedang) this.redakan();
    } else if (this.sedang) {
      // dari "gerimis terus" kembali ke sesekali: yang sedang turun dibiarkan sebentar lagi
      this.tunda(Phaser.Math.Between(20000, 40000), () => this.redakan());
    } else {
      this.jadwalkan(Phaser.Math.Between(BABAK.jeda[0], BABAK.jeda[1]) / 3);
    }
  }

  /** Mulai gerimis sekarang juga — dipakai jadwal, dan bisa dipanggil dari konsol untuk dites. */
  mulai(lama = Phaser.Math.Between(BABAK.deras[0], BABAK.deras[1])) {
    if (this.sedang) return;
    this.sedang = true;
    this.tujuanAwan = 1;
    this.tunda(BABAK.mendung, () => (this.tujuanKuat = 1));
    if (Number.isFinite(lama)) this.tunda(BABAK.mendung + BABAK.peralihan + lama, () => this.redakan());
  }

  /** Hentikan gerimis: tetesnya menipis, lalu awannya menyingkir. */
  redakan() {
    if (!this.sedang) return;
    this.batalkan();
    this.tujuanKuat = 0;
    this.tunda(BABAK.peralihan * 0.7, () => {
      this.tujuanAwan = 0;
      this.sedang = false;
      if (this.mode === 'otomatis') this.jadwalkan(Phaser.Math.Between(BABAK.jeda[0], BABAK.jeda[1]));
    });
  }

  private jadwalkan(ms: number) {
    this.tunda(ms, () => {
      if (this.mode !== 'otomatis') return;
      if (Math.random() < BABAK.peluang) this.mulai();
      else this.jadwalkan(Phaser.Math.Between(BABAK.jeda[0], BABAK.jeda[1]));
    });
  }

  private tunda(ms: number, f: () => void) {
    const e = this.scene.time.delayedCall(ms, () => {
      this.jadwal = this.jadwal.filter((j) => j !== e);
      f();
    });
    this.jadwal.push(e);
  }

  private batalkan() {
    for (const e of this.jadwal) e.remove();
    this.jadwal = [];
  }

  /** Tetes baru di puncak layar (atau di mana saja, saat pertama dibuat). */
  private lahirkan(t: Tetes, sebar = false) {
    const v = this.scene.cameras.main.worldView;
    const w = v.width || 400;
    const h = v.height || 300;
    t.x = Phaser.Math.FloatBetween(-40, w);
    t.y = sebar ? Phaser.Math.FloatBetween(0, h) : Phaser.Math.FloatBetween(-24, -4);
    t.vy = Phaser.Math.FloatBetween(JATUH.y[0], JATUH.y[1]);
    t.jatuh = Phaser.Math.FloatBetween(h * 0.25, h + 4);
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    // derasnya berubah perlahan, bukan melompat
    this.kuat = Phaser.Math.Linear(this.kuat, this.tujuanKuat, Math.min(1, dt / (BABAK.peralihan / 3000)));
    if (Math.abs(this.kuat - this.tujuanKuat) < 0.005) this.kuat = this.tujuanKuat;
    this.awan = Phaser.Math.Linear(this.awan, this.tujuanAwan, Math.min(1, dt / (BABAK.mendung / 3000)));
    if (Math.abs(this.awan - this.tujuanAwan) < 0.005) this.awan = this.tujuanAwan;
    cuaca.hujan = this.kuat;
    // tanah basah menyusul hujannya dalam ±20 detik, keringnya ±70 detik
    cuaca.basah = this.kuat > 0.3 ? Math.min(1, cuaca.basah + dt / 20) : Math.max(0, cuaca.basah - dt / 70);
    this.suasana?.setMendung(this.awan);
    gerimis.setel(0.16 * this.kuat);

    this.gerakTetes(dt);
    this.aturGenangan(t, delta);
    this.aturPayung();
    if (this.kuat > 0.2 && (this.jedaTik -= delta) <= 0) {
      // tetes besar sesekali mengetuk atap dan daun di dekat pemain
      this.jedaTik = Phaser.Math.Between(90, 420) / this.kuat;
      const p = this.pemain();
      if (p) tikHujan(p.x + Phaser.Math.Between(-80, 80), p.y + Phaser.Math.Between(-60, 60));
    }
  }

  private gerakTetes(dt: number) {
    const aktif = Math.round(this.tetes.length * this.kuat);
    if (!aktif && !this.tetes[0].img.visible) return;
    const kam = this.scene.cameras.main;
    const v = kam.worldView;
    const z = kam.zoom;
    this.tetes.forEach((d, i) => {
      if (i >= aktif) {
        d.img.setVisible(false);
        return;
      }
      d.y += d.vy * dt;
      d.x += JATUH.x * dt;
      if (d.y >= d.jatuh) {
        if (Math.random() < 0.45) this.percik(v.x + d.x, v.y + d.y);
        this.lahirkan(d);
      }
      // dikunci ke grid piksel layar, seperti awan
      d.img.setVisible(true).setPosition(Math.round((v.x + d.x) * z) / z, Math.round((v.y + d.y) * z) / z);
    });
  }

  private percik(x: number, y: number) {
    const c = this.cipratan.find((s) => !s.visible);
    if (!c) return;
    c.setPosition(Math.round(x), Math.round(y)).setVisible(true).play('cipratan');
  }

  private aturGenangan(t: number, delta: number) {
    const b = cuaca.basah;
    const v = this.scene.cameras.main.worldView;
    for (const g of this.genangan) {
      // melebar selagi basah, menyusut saat surut
      g.img.setVisible(b > 0.02).setAlpha(Math.min(1, b * 1.3)).setScale(0.55 + 0.45 * b, 0.7 + 0.3 * b);
    }
    if (b < 0.2) return;
    // riak dari tetes yang jatuh di genangan yang kelihatan
    if (this.kuat > 0.15 && (this.jedaRiak -= delta) <= 0) {
      this.jedaRiak = 160 / this.kuat;
      const tampak = this.genangan.filter((g) => v.contains(g.x, g.y));
      const r = this.riak.find((s) => !s.visible);
      if (tampak.length && r) {
        const g = Phaser.Utils.Array.GetRandom(tampak);
        r.setPosition(g.x + Phaser.Math.Between(-4, 4), g.y + Phaser.Math.Between(-1, 1)).setVisible(true).play('riak');
      }
    }
    // pemain yang menginjak genangan: cipratan di kakinya, "kecipak"
    const p = this.pemain();
    const body = p?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!p || !body || (this.jedaKecipak -= delta) > 0) return;
    if (Math.hypot(body.velocity.x, body.velocity.y) < 10) return;
    const kx = p.x;
    const ky = p.y + PLAYER.baseY;
    const kena = this.genangan.find((g) => Math.abs(g.x - kx) < 7 * (0.55 + 0.45 * b) && Math.abs(g.y - ky) < 3);
    if (!kena) return;
    this.jedaKecipak = 260;
    this.percik(kx - 3, ky);
    this.percik(kx + 3, ky);
    kecipak(kx, ky);
  }

  private aturPayung() {
    const buka = Phaser.Math.Clamp((this.kuat - 0.1) * 4, 0, 1);
    for (const o of this.payung) {
      const { s, p, t, atas } = o;
      // lembar penggantinya cuma cocok untuk frame lembar asal (diam dan jalan)
      const f = Number(s.frame.name);
      const cocok = s.texture.key === o.sumber && Number.isInteger(f) && f >= 0 && f < 32;
      const tampil = buka > 0 && s.visible && s.alpha > 0;
      const ganti = tampil && cocok;
      /*
       * Karakter aslinya tetap "terlihat" bagi semua yang lain (senter,
       * gelembung, klik) tapi tidak digambar: bingkai potongnya dikosongkan,
       * dan frame berpayung digambar persis di tempatnya.
       */
      if (ganti !== o.diganti) {
        o.diganti = ganti;
        if (ganti) s.setCrop(0, 0, 0, 0);
        else s.setCrop();
      }
      t.setVisible(ganti);
      p.setVisible(tampil);
      if (!tampil) continue;
      /*
       * Semua ukuran dalam piksel frame 32×32 karakternya, dikali skalanya.
       * Kubahnya (10 baris) melayang satu baris di atas puncak kepala, jadi
       * gagangnya kelihatan di sela itu.
       */
      const k = s.scaleY;
      const ox = s.x - s.originX * s.displayWidth;
      const oy = s.y - s.originY * s.displayHeight;
      const arah = URUT_PAYUNG.indexOf(arahDariFrame(s));
      const a = PEGANG_PAYUNG[URUT_PAYUNG[arah]];
      if (ganti) t.setFrame(f).setScale(k).setAlpha(s.alpha).setPosition(ox, oy).setDepth(s.depth);
      p.setScale(k)
        .setAlpha(buka * s.alpha)
        .setPosition(ox + (a.kubah - 10) * k, oy + (atas[arah] - 2 - 9) * k)
        .setDepth(s.depth + 0.3);
    }
  }
}

/** Kubah payung: nama tekstur, lalu warna kilau, terang, dasar, dan gelapnya. */
const PAYUNG = [
  ['payung_merah', '#f58b7c', '#e0463a', '#c4352f', '#9c2a28'],
  ['payung_biru', '#8fc0f5', '#4a8ae0', '#3a70c4', '#2c569c'],
  ['payung_kuning', '#fff0a8', '#f2c438', '#d9a520', '#b07f14'],
  ['payung_hijau', '#a6e0a8', '#4fa868', '#3f8a5a', '#2e6a44'],
  ['payung_ungu', '#e0c6f2', '#a274d0', '#8a5ab8', '#6a4294'],
] as const;

/** Urutan baris arah di lembar karakter, sama dengan urutan frame pegangan. */
const URUT_PAYUNG = ['down', 'left', 'right', 'up'] as const;

type Titik = [number, number];

/** Warna gagang: logam terang, supaya terbaca di atas rambut gelap maupun terang. */
const GAGANG = '#c6c6be';

/**
 * Pose memegang payung per arah hadap, piksel frame (diukur dari lembarnya:
 * kepala x 9-22 baris 13-23, badan x 12-19 baris 24-28, lengan kanan-layar
 * di x 20-22 baris 25-28, kaki baris 29-30):
 * - `kubah`: kolom tengah kubah — pangkal gagangnya;
 * - `gagang`: [kolom, baris] ujung bawah gagang, di kepalan;
 * - `hapus`: kotak [x0, y0, x1, y1] yang dikosongkan dulu (lengan yang menggantung);
 * - `baju`, `tinta`, `kulit`: piksel yang lalu digambar dengan warna itu.
 *
 * Menghadap bawah dan atas, payungnya disandarkan ke bahu: lengan kanan-layar
 * terangkat, kepalannya di samping pipi, dan gagangnya miring dari tengah
 * kubah — tepat di atas kepala — ke kepalan itu. Dari samping, kepalannya di
 * depan dada dan gagangnya berdiri di depan wajah.
 */
interface Pegang {
  kubah: number;
  gagang: Titik;
  hapus?: [number, number, number, number];
  baju: Titik[];
  tinta: Titik[];
  kulit: Titik[];
}

const TERANGKAT: Pegang = {
  kubah: 16,
  gagang: [21, 22],
  hapus: [20, 22, 24, 28],
  baju: [],
  tinta: [[20, 26], [20, 27], [20, 28], [21, 26], [22, 26], [22, 25], [23, 24], [23, 23], [22, 22], [21, 22], [20, 22], [19, 23]],
  kulit: [[20, 25], [21, 25], [20, 23], [21, 23], [22, 23], [20, 24], [21, 24], [22, 24]],
};

const PEGANG_PAYUNG: Record<(typeof URUT_PAYUNG)[number], Pegang> = {
  down: TERANGKAT,
  left: {
    kubah: 12,
    gagang: [10, 23],
    baju: [[13, 26], [13, 27]],
    tinta: [[9, 24], [9, 25], [10, 26], [11, 26], [12, 26]],
    kulit: [[10, 24], [11, 24], [10, 25], [11, 25], [12, 25]],
  },
  right: {
    kubah: 19,
    gagang: [21, 23],
    baju: [[18, 26], [18, 27]],
    tinta: [[22, 24], [22, 25], [21, 26], [20, 26], [19, 26]],
    kulit: [[20, 24], [21, 24], [20, 25], [21, 25], [19, 25]],
  },
  up: TERANGKAT,
};
