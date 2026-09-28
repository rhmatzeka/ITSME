import Phaser from 'phaser';
import { ABOUT, DEPTH, kedalaman } from '../config';
import type { Player } from './Player';
import { spritesheetTeks } from './piksel';
import { faktaBerikutnya } from './Warga';

/** Layar laptop di malam hari: di atas tirai malam (DEPTH.above + 50), di bawah cahaya lampu. */
const KEDALAMAN_LAYAR = DEPTH.above + 52;
const KEDALAMAN_CAHAYA = DEPTH.above + 60;

/**
 * Isi layar laptop, satu baris kode per baris piksel: huruf = warna token,
 * titik = latar. Layarnya menampilkan enam baris sekaligus dan bergulir satu
 * baris tiap langkah, berputar kembali ke atas setelah baris terakhir.
 */
const KODE = [
  'mmm.pppp....',
  '.bbb.yy.ww..',
  '..bbbbb.gg..',
  '..ww.yyy....',
  '.pp.........',
  'm...........',
  '............',
  'mmm.bbbb.p..',
  '.yy.wwww....',
  '..gg.ppp.b..',
  '..bbb.......',
  '.p..........',
  '............',
  'mm.yyyy.....',
];
const BARIS_LAYAR = 6;

/** Jeda gulir layar, ms: pelan seperti log build saat ditinggal, cepat saat diketik. */
const GULIR = { ditinggal: 900, diketik: 240 };

/** Sejauh apa pemain boleh berdiri dari kursi untuk bisa duduk, px. */
const JANGKAU = 64;

/**
 * Meja kerja Rahmat di sisi kanan rumah About: meja kayu, laptop yang
 * layarnya menampilkan baris kode berwarna, mug kopi yang mengepul, dan kursi
 * di depannya.
 *
 * Karakter pemain adalah Rahmat sendiri, jadi yang duduk di sini bukan warga
 * lain: klik mejanya dari dekat dan karakternya duduk membelakangi kamera
 * lalu mengetik — layarnya bergulir lebih cepat dan sesekali tanda centang
 * hijau muncul (build lolos). Gerak apa pun membuatnya berdiri lagi. Diklik
 * selagi duduk, laptopnya bercerita fakta tentang Rahmat.
 *
 * Malam hari layarnya tetap terang (digambar di atas tirai malam) dan
 * memendarkan cahaya biru ke meja dan ke kepala yang duduk di depannya.
 */
export class Teras {
  private layar: Phaser.GameObjects.Sprite;
  private layarMalam: Phaser.GameObjects.Sprite;
  private pendar: Phaser.GameObjects.Image;
  private laptop: Phaser.GameObjects.Image;
  private baris = 0;
  private jedaGulir = 0;
  private jedaCentang = 0;
  private pernahDuduk = false;
  private readonly kursi: { x: number; y: number };
  private readonly bangkit: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Player | undefined,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { x, kaki } = ABOUT.meja;
    const d = kedalaman(kaki);
    // kursi merapat ke meja; titik duduknya dihitung untuk frame 32×32 berpusat
    this.kursi = { x, y: kaki - 9 };
    this.bangkit = { x, y: kaki + 13 };

    scene.add.image(x, kaki, 'meja_teras').setOrigin(0.5, 1).setDepth(d);
    this.laptop = scene.add.image(x, kaki - 9, 'laptop').setOrigin(0.5, 1).setDepth(d + 0.1);
    const kiriLayar = x - 6;
    const atasLayar = kaki - 19;
    this.layar = scene.add.sprite(kiriLayar, atasLayar, 'layar_kode', 0).setOrigin(0).setDepth(d + 0.2);
    this.layarMalam = scene.add
      .sprite(kiriLayar, atasLayar, 'layar_kode', 0)
      .setOrigin(0)
      .setDepth(KEDALAMAN_LAYAR)
      .setAlpha(0);
    this.pendar = scene.add
      .image(x, atasLayar + 9, 'layar_pendar')
      .setScale(1 / 4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setAlpha(0);
    scene.add.image(x + 10, kaki - 10, 'mug_kopi').setOrigin(0.5, 1).setDepth(d + 0.1);
    scene.add.image(x, kaki + 12, 'kursi_teras').setOrigin(0.5, 1).setDepth(kedalaman(kaki + 12));

    if (blocked) {
      for (const [cx, cy, w, h] of [
        [x, kaki - 4, 24, 8],
        [x, kaki + 10, 10, 4],
      ]) {
        const r = scene.add.rectangle(cx, cy, w, h);
        scene.physics.add.existing(r, true);
        blocked.add(r);
      }
    }

    const zona = scene.add
      .zone(x, kaki - 5, 30, 36)
      .setInteractive({ useHandCursor: true })
      .setDepth(kedalaman(kaki + 12) + 1);
    zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      // jangan sampai terbaca juga sebagai "jalan ke sini" — itu langsung membuatnya berdiri
      p.event.preventDefault();
      this.klik();
    });

    // kopi di mug mengepul pelan
    scene.time.addEvent({
      delay: 1300,
      loop: true,
      callback: () => this.kepul(x + 9 + Phaser.Math.Between(0, 1), kaki - 17),
    });
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    const KAYU = { k: '#3a2418', c: '#c89060', b: '#a8703a', B: '#7a4a24' };
    // meja 26×14: papan atas dengan satu sambungan, lis depan, empat kaki
    spritesheetTeks(
      s,
      'meja_teras',
      [
        [
          '.kkkkkkkkkkkkkkkkkkkkkkkk.',
          'kcccccccccccccccccccccccck',
          'kcccccccccccccccccccccccck',
          'kbbbbbbbbbbbbbbbbbbbbbbbbk',
          'kcccccccccccccccccccccccck',
          'kcccccccccccccccccccccccck',
          'kkkkkkkkkkkkkkkkkkkkkkkkkk',
          'kbbbbbbbbbbbbbbbbbbbbbbbbk',
          'kBBBBBBBBBBBBBBBBBBBBBBBBk',
          'kkbBkkkkkkkkkkkkkkkkkkBbkk',
          '.kbBk................kBbk.',
          '.kbBk................kBbk.',
          '.kbBk................kBbk.',
          '.kkkk................kkkk.',
        ],
      ],
      KAYU
    );
    // kursi dari belakang: sandaran berjeruji, lalu kaki
    spritesheetTeks(
      s,
      'kursi_teras',
      [
        [
          '.kkkkkkkkkk.',
          'kcccccccccck',
          'kbbbbbbbbbbk',
          'kbk.kbbk.kbk',
          'kbk.kbbk.kbk',
          'kkkkkkkkkkkk',
          'kBBBBBBBBBBk',
          'kbk......kbk',
          'kBk......kBk',
          'kkk......kkk',
        ],
      ],
      KAYU
    );
    // laptop 16×12: layarnya diisi sprite terpisah supaya bisa bergulir
    spritesheetTeks(
      s,
      'laptop',
      [
        [
          '.kkkkkkkkkkkkkk.',
          'kggggggggggggggk',
          'kg............gk',
          'kg............gk',
          'kg............gk',
          'kg............gk',
          'kg............gk',
          'kg............gk',
          'kggggggggggggggk',
          'kkkkkkkkkkkkkkkk',
          'kaadadadadadadak',
          '.kkkkkkkkkkkkkk.',
        ],
      ],
      { k: '#1b1920', g: '#3c3f4c', a: '#c4c8d4', d: '#8a8e9c' }
    );
    const frame = KODE.map((_, i) =>
      Array.from({ length: BARIS_LAYAR }, (_, r) => KODE[(i + r) % KODE.length].replace(/\./g, 's'))
    );
    spritesheetTeks(s, 'layar_kode', frame, {
      s: '#1c2233',
      m: '#c792ea',
      p: '#ff7eb6',
      b: '#78dce8',
      y: '#ffd866',
      g: '#a9dc76',
      w: '#e8e8e8',
    });
    spritesheetTeks(
      s,
      'mug_kopi',
      [['kkkkk..', 'kccck..', 'kwwwkkk', 'krrrk.k', 'kwwwkkk', 'kwwwk..', '.kkk...']],
      { k: '#3a2418', c: '#6a3a20', w: '#f4f1ea', r: '#e0463a' }
    );
    // tanda centang hijau: build lolos
    spritesheetTeks(
      s,
      'centang',
      [['.....kk', '....kgk', 'kk.kgk.', 'kgkgk..', '.kgk...', '..k....']],
      { k: '#1b2416', g: '#a9dc76' }
    );
    // pendar layar: elips biru lembut, digambar 4× lebih rapat lalu dikecilkan
    if (!s.textures.exists('layar_pendar')) {
      const w = 44 * 4;
      const h = 30 * 4;
      const k = s.textures.createCanvas('layar_pendar', w, h)!;
      const ctx = k.getContext();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      g.addColorStop(0, 'rgba(150, 200, 255, 0.4)');
      g.addColorStop(0.4, 'rgba(110, 160, 240, 0.18)');
      g.addColorStop(1, 'rgba(90, 130, 220, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      k.refresh();
    }
  }

  private klik() {
    const p = this.pemain();
    if (!p) return;
    if (p.sedangKerja) {
      this.ucap(faktaBerikutnya());
      return;
    }
    const jauh = Phaser.Math.Distance.Between(p.x, p.y, this.bangkit.x, this.bangkit.y) > JANGKAU;
    if (jauh || !this.scene.anims.exists('rahmat_ngetik')) {
      this.ucap("Rahmat's desk. Walk up to it and click again to sit down and write some code.");
      return;
    }
    p.duduk(this.kursi.x, this.kursi.y, 'rahmat_ngetik', this.bangkit);
    this.jedaCentang = Phaser.Math.Between(3000, 5000);
    if (!this.pernahDuduk) {
      this.pernahDuduk = true;
      this.scene.game.events.emit('mapporto:greet', 'Back to coding. Click the laptop for a fun fact, or move to get up.');
    }
  }

  private ucap(msg: string) {
    this.scene.game.events.emit('mapporto:ucap', { msg, siapa: this.laptop, nama: 'Laptop' });
  }

  private detak(_t: number, delta: number) {
    const diketik = !!this.pemain()?.sedangKerja;
    if ((this.jedaGulir -= delta) <= 0) {
      this.jedaGulir = diketik ? GULIR.diketik : GULIR.ditinggal;
      this.baris = (this.baris + 1) % KODE.length;
      this.layar.setFrame(this.baris);
      this.layarMalam.setFrame(this.baris);
    }
    if (diketik && (this.jedaCentang -= delta) <= 0) {
      this.jedaCentang = Phaser.Math.Between(5000, 8000);
      this.centang();
    }
    const g = this.gelap();
    this.layarMalam.setAlpha(g);
    this.pendar.setAlpha(g * (diketik ? 0.8 : 0.5));
  }

  /** Tanda centang hijau yang naik dari layar lalu memudar. */
  private centang() {
    const { x, kaki } = ABOUT.meja;
    const c = this.scene.add.image(x + 3, kaki - 20, 'centang').setDepth(KEDALAMAN_LAYAR + 1);
    this.scene.tweens.add({
      targets: c,
      y: c.y - 10,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      ease: 'Sine.easeOut',
      onComplete: () => c.destroy(),
    });
  }

  private kepul(x: number, y: number) {
    const k = this.scene.add.rectangle(x, y, 1, 1, 0xffffff, 0.6).setDepth(DEPTH.above + 20);
    this.scene.tweens.add({
      targets: k,
      y: y - Phaser.Math.Between(7, 11),
      x: x + Phaser.Math.Between(-2, 2),
      scale: 2,
      alpha: 0,
      duration: 1500,
      ease: 'Sine.easeOut',
      onComplete: () => k.destroy(),
    });
  }
}
