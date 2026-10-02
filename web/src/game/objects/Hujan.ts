import Phaser from 'phaser';
import { gerimis, kecipak, tikHujan } from '../bunyi';
import { DEPTH, PLAYER, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { barisAtas, spritesheetTeks } from './piksel';
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
    p: Phaser.GameObjects.Image;
    gagang: Phaser.GameObjects.Rectangle;
    tangan: Phaser.GameObjects.Rectangle;
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
     * Payung: cuma kubahnya yang jadi tekstur (17×9, dilihat agak dari atas:
     * pucuk, empat bilah dari terang ke gelap, tepi bergelombang). Gagang dan
     * tangan yang menggenggamnya digambar per orang di aturPayung(), karena
     * letaknya ikut arah hadap dan warna kulit masing-masing.
     */
    const kubah = [
      '........k........',
      '.....kkkhkkk.....',
      '...kkhaahbbcckk..',
      '..khaaaahbbbccck.',
      '.khaaaaahbbbbccck',
      '.kaaaaaakbbbbbcck',
      'kaaaaaaakbbbbbbck',
      'kakkaaakkkbbbkkck',
      '.k..kkk...kkk..k.',
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
      const p = this.scene.add.image(0, 0, PAYUNG[i % PAYUNG.length][0]).setOrigin(0).setVisible(false);
      const gagang = this.scene.add.rectangle(0, 0, 1, 1, 0x3a2f2a).setOrigin(0).setVisible(false);
      // warna kulitnya dibaca dari tangan kanan di frame diam-menghadap-bawah
      const c = this.scene.textures.getPixel(20, 27, s.texture.key, 0);
      const tangan = this.scene.add.rectangle(0, 0, 2, 1, c && c.alpha > 0 ? c.color : 0xe8b48a).setOrigin(0).setVisible(false);
      this.payung.push({ s, p, gagang, tangan });
    });
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
    for (const { s, p, gagang, tangan } of this.payung) {
      if (buka <= 0 || !s.visible || s.alpha <= 0) {
        if (p.visible) {
          p.setVisible(false);
          gagang.setVisible(false);
          tangan.setVisible(false);
        }
        continue;
      }
      /*
       * Semua ukuran dalam piksel frame 32×32 karakternya, dikali skalanya.
       * Kubahnya (9 baris) berhenti dua baris di bawah puncak kepala — yang
       * dibaca dari frame-nya sendiri, karena tinggi tiap orang berbeda —
       * jadi cuma pucuk rambut yang tertutup dan wajahnya tetap kelihatan.
       * Gagangnya bersandar di bahu: yang tampak cuma
       * potongan di antara kubah dan tangan yang menggenggamnya, sisanya
       * tertutup kepala. Dari belakang, gagangnya tertutup badan seluruhnya.
       */
      const k = s.scaleY;
      const ox = s.x - s.originX * s.displayWidth;
      const oy = s.y - s.originY * s.displayHeight;
      const kaki = s.y + (1 - s.originY) * s.displayHeight - 2 * k;
      const d = kedalaman(kaki);
      const a = PEGANG_PAYUNG[arahDariFrame(s)];
      const pekat = buka * s.alpha;
      p.setVisible(true)
        .setScale(k)
        .setAlpha(pekat)
        .setPosition(ox + (a.kubah - 8) * k, oy + (barisAtas(s) + 2 - 9) * k)
        .setDepth(d + 0.3);
      gagang.setVisible(!!a.gagang);
      tangan.setVisible(!!a.gagang);
      if (!a.gagang) continue;
      const [gx, atas, bawah] = a.gagang;
      gagang
        .setScale(k)
        .setSize(1, bawah - atas + 1)
        .setAlpha(pekat)
        .setPosition(ox + gx * k, oy + atas * k)
        .setDepth(d + 0.1);
      tangan
        .setScale(k)
        .setAlpha(pekat)
        .setPosition(ox + a.tangan * k, oy + bawah * k)
        .setDepth(d + 0.2);
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

/**
 * Letak payung per arah hadap, piksel frame: kolom tengah kubah, gagang
 * [kolom, baris atas, baris bawah], dan kolom kiri tangan (dua piksel, di
 * baris bawah gagang). Tangannya ada di x 20-21 saat menghadap bawah, x 16-17
 * hadap kiri, x 14-15 hadap kanan — sama dengan pegangan senter.
 */
const PEGANG_PAYUNG: Record<string, { kubah: number; gagang?: [number, number, number]; tangan: number }> = {
  down: { kubah: 17, gagang: [21, 22, 25], tangan: 20 },
  left: { kubah: 15, gagang: [16, 21, 24], tangan: 16 },
  right: { kubah: 17, gagang: [15, 21, 24], tangan: 14 },
  up: { kubah: 16, tangan: 0 },
};
