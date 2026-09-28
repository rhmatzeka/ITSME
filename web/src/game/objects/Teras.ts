import Phaser from 'phaser';
import { ketik, sukses } from '../bunyi';
import { ABOUT, DEPTH, kedalaman } from '../config';
import type { Player } from './Player';
import { spritesheetTeks } from './piksel';
import { faktaBerikutnya } from './Warga';

/** Layar monitor di malam hari: di atas tirai malam (DEPTH.above + 50), di bawah cahaya lampu. */
const KEDALAMAN_LAYAR = DEPTH.above + 52;
const KEDALAMAN_CAHAYA = DEPTH.above + 60;

/**
 * Isi layar monitor, satu baris kode per baris piksel: huruf = warna token,
 * titik = latar. Di kirinya ada lajur nomor baris (titik redup di baris yang
 * berisi kode). Layarnya menampilkan sepuluh baris sekaligus dan bergulir
 * satu baris tiap langkah, berputar kembali ke atas setelah baris terakhir.
 */
const KODE = [
  'mmm.pppp.....',
  '..bbb.yy.www.',
  '..bbbbb.gg...',
  '....ww.yyy...',
  '..pp.........',
  'm............',
  '.............',
  'mmm.bbbb.pp..',
  '..yy.wwww....',
  '....gg.ppp.b.',
  '..bbb........',
  '..p.www......',
  '.............',
  'mm.yyyy.gg...',
  '..w..........',
  'm............',
];
const LAYAR = { lebar: 18, tinggi: 10 };

/** Jeda gulir layar, ms: pelan seperti log build saat ditinggal, cepat saat diketik. */
const GULIR = { ditinggal: 900, diketik: 240 };

/** Sejauh apa pemain boleh berdiri dari kursi untuk bisa duduk, px. */
const JANGKAU = 64;

/**
 * Meja kerja Rahmat di sisi kanan rumah About: meja kayu berlaci, monitor
 * yang menampilkan baris kode berwarna dengan lajur nomor baris, keyboard dan
 * mouse, lampu meja berkap kuning, tanaman pot, mug kopi yang mengepul, dan
 * kursi kantor di depannya.
 *
 * Karakter pemain adalah Rahmat sendiri, jadi yang duduk di sini bukan warga
 * lain: klik mejanya dari dekat dan karakternya duduk membelakangi kamera
 * lalu mengetik — layarnya bergulir lebih cepat dan sesekali tanda centang
 * hijau muncul (build lolos). Gerak apa pun membuatnya berdiri lagi. Diklik
 * selagi duduk, monitornya bercerita fakta tentang Rahmat.
 *
 * Malam hari layarnya tetap terang (digambar di atas tirai malam) dan
 * memendarkan cahaya biru, dan lampu mejanya menyala kuning ke permukaan meja.
 */
export class Teras {
  private layar: Phaser.GameObjects.Sprite;
  private layarMalam: Phaser.GameObjects.Sprite;
  private pendar: Phaser.GameObjects.Image;
  private sinarLampu: Phaser.GameObjects.Image;
  private monitor: Phaser.GameObjects.Image;
  private baris = 0;
  private jedaGulir = 0;
  private jedaCentang = 0;
  /** Jeda ke ketukan tuts berikutnya selagi Rahmat mengetik, ms. */
  private jedaKetik = 0;
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
    // Titik duduk untuk frame 32×32 berpusat: kepalanya tepat di bawah layar,
    // bahunya menyembul di atas sandaran kursi.
    this.kursi = { x, y: kaki - 13 };
    this.bangkit = { x, y: kaki + 21 };

    scene.add.image(x, kaki, 'meja_kerja').setOrigin(0.5, 1).setDepth(d);
    // benda di atas meja, dari belakang ke depan
    this.monitor = scene.add.image(x - 1, kaki - 11, 'monitor').setOrigin(0.5, 1).setDepth(d + 0.1);
    const kiriLayar = this.monitor.x - 11 + 2;
    const atasLayar = this.monitor.y - this.monitor.height + 1;
    this.layar = scene.add.sprite(kiriLayar, atasLayar, 'layar_kode', 0).setOrigin(0).setDepth(d + 0.15);
    this.layarMalam = scene.add
      .sprite(kiriLayar, atasLayar, 'layar_kode', 0)
      .setOrigin(0)
      .setDepth(KEDALAMAN_LAYAR)
      .setAlpha(0);
    this.pendar = scene.add
      .image(this.monitor.x, atasLayar + 8, 'layar_pendar')
      .setScale(1 / 4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setAlpha(0);
    scene.add.image(x - 13, kaki - 10, 'pot_meja').setOrigin(0.5, 1).setDepth(d + 0.2);
    scene.add.image(x + 12, kaki - 10, 'lampu_meja').setOrigin(0.5, 1).setDepth(d + 0.2);
    // sinar lampu jatuh di permukaan meja, di bawah kapnya yang menunduk ke kiri
    this.sinarLampu = scene.add
      .image(x + 8, kaki - 11, 'lampu_sinar')
      .setScale(1 / 4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setAlpha(0);
    scene.add.image(x - 1, kaki - 9, 'keyboard').setOrigin(0.5, 1).setDepth(d + 0.3);
    scene.add.image(x + 9, kaki - 9, 'mouse').setOrigin(0.5, 1).setDepth(d + 0.3);
    scene.add.image(x - 12, kaki - 8, 'mug_kopi').setOrigin(0.5, 1).setDepth(d + 0.3);
    scene.add.image(x, kaki + 17, 'kursi_kantor').setOrigin(0.5, 1).setDepth(kedalaman(kaki + 17));

    if (blocked) {
      for (const [cx, cy, w, h] of [
        [x, kaki - 4, 34, 8],
        [x, kaki + 14, 12, 6],
      ]) {
        const r = scene.add.rectangle(cx, cy, w, h);
        scene.physics.add.existing(r, true);
        blocked.add(r);
      }
    }

    const zona = scene.add
      .zone(x, kaki - 2, 38, 44)
      .setInteractive({ useHandCursor: true })
      .setDepth(kedalaman(kaki + 17) + 1);
    zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      // jangan sampai terbaca juga sebagai "jalan ke sini" — itu langsung membuatnya berdiri
      p.event.preventDefault();
      this.klik();
    });

    // kopi di mug mengepul pelan
    scene.time.addEvent({
      delay: 1300,
      loop: true,
      callback: () => this.kepul(x - 14 + Phaser.Math.Between(0, 1), kaki - 15),
    });
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    // meja 36×15: permukaan berserat, lis depan dengan laci berpegangan kuningan, empat kaki
    spritesheetTeks(
      s,
      'meja_kerja',
      [
        [
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          'kcCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCck',
          'kcccccccccccccccccccccccccccccccccck',
          'kccbccccccbccccccbccccccbccccccbccck',
          'kcccccccccccccccccccccccccccccccccck',
          'kcccccccccccccccccccccccccccccccccck',
          'kbbbbbbbbbbbbbbbbbbbbkbbbbbbbbbbbbbk',
          'kbbbbbbbbbbbbbbbbbbbbkbbbbbhhbbbbbbk',
          'kBBBBBBBBBBBBBBBBBBBBkbbbbbbbbbbbbBk',
          '.kbbBkkkkkkkkkkkkkkkkkkkkkkkkkkbbBk.',
          '.kbbBk........................kbbBk.',
          '.kbbBk........................kbbBk.',
          '.kbbBk........................kbbBk.',
          '.kbbBk........................kbbBk.',
          '..kkk..........................kkk..',
        ],
      ],
      { k: '#3a2418', c: '#d6a06a', C: '#e8b884', b: '#b07840', B: '#7a4a24', h: '#f2c94c' }
    );
    const BENDA = {
      k: '#15161c', g: '#3a3d4a', G: '#565a6c', l: '#6fe08a', a: '#d4d7e0', d: '#9a9eb0',
      y: '#e8b030', Y: '#fff2b0', m: '#4a4d5c', s: '#2a2d38', r: '#15161c',
    };
    // monitor 22×17: bingkai, dagu dengan lampu daya hijau, leher, kaki; layarnya sprite terpisah
    spritesheetTeks(
      s,
      'monitor',
      [
        [
          '.kkkkkkkkkkkkkkkkkkkk.',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kg..................gk',
          'kggggggggggggggggggggk',
          'kGGGGGGGGGGGGGGGGlGGGk',
          '.kkkkkkkkgggGkkkkkkkk.',
          '......kkkgggGkkk......',
          '.....kggggggggggk.....',
          '......kkkkkkkkkk......',
        ],
      ],
      BENDA
    );
    const frame = KODE.map((_, i) =>
      Array.from({ length: LAYAR.tinggi }, (_, r) => {
        const kode = KODE[(i + r) % KODE.length];
        const nomor = /[^.]/.test(kode) ? 'n' : 'd';
        return ('d' + nomor + 's' + kode.replace(/\./g, 's')).slice(0, LAYAR.lebar).padEnd(LAYAR.lebar, 's');
      })
    );
    spritesheetTeks(s, 'layar_kode', frame, {
      s: '#1c2233',
      d: '#262c40',
      n: '#4a5068',
      m: '#c792ea',
      p: '#ff7eb6',
      b: '#78dce8',
      y: '#ffd866',
      g: '#a9dc76',
      w: '#e8e8e8',
    });
    spritesheetTeks(
      s,
      'lampu_meja',
      [
        [
          '...kkkk....',
          '..kyyyyk...',
          '.kyyyyyyk..',
          'kyyyyyyyk..',
          'kYYYYYYk...',
          '.kkkkkmk...',
          '......kmk..',
          '.......kmk.',
          '.......kmk.',
          '......kmk..',
          '.....kmk...',
          '.....kmk...',
          '.....kmk...',
          '...kkkmkkk.',
          '..kmmmmmmk.',
          '..kkkkkkkk.',
        ],
      ],
      BENDA
    );
    spritesheetTeks(s, 'keyboard', [['kkkkkkkkkkkkkk', 'kadadadadadadk', 'kdadadadadadak', 'kkkkkkkkkkkkkk']], BENDA);
    spritesheetTeks(s, 'mouse', [['.kk.', 'kaak', 'kadk', '.kk.']], BENDA);
    // kursi kantor dari belakang: sandaran membulat berjaring, dudukan, tiang, kaki bintang beroda
    spritesheetTeks(
      s,
      'kursi_kantor',
      [
        [
          '...kggggggk...',
          '..kggggggggk..',
          '.kgGGGGGGGGgk.',
          'kggGGGGGGGGggk',
          'kggGGGGGGGGggk',
          'kggGGGGGGGGggk',
          'kggGGGGGGGGggk',
          'kggGGGGGGGGggk',
          'kggggggggggggk',
          'kggggggggggggk',
          'kggggggggggggk',
          'kkkkkksskkkkkk',
          '.....kssk.....',
          '.....kssk.....',
          '.kkkkksskkkkk.',
          'kssssssssssssk',
          'rrkkkkrrkkkkrr',
          'kk....kk....kk',
        ],
      ],
      BENDA
    );
    spritesheetTeks(
      s,
      'pot_meja',
      [
        [
          '..kkkkk..',
          '.klllllk.',
          'klLLllllk',
          'kLLLLlllk',
          'klLLlLLlk',
          'kllllLLlk',
          'kllllLLlk',
          'kTllLllTk',
          '.ktttttk.',
          '.ktttttk.',
          '.ktttttk.',
          '.ktttttk.',
          '..kkkkk..',
        ],
      ],
      { k: '#3a2418', t: '#c65a3a', T: '#e07a4a', l: '#6fbf5a', L: '#4a9a44' }
    );
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
    this.elips('layar_pendar', 48, 32, ['rgba(150, 200, 255, 0.4)', 'rgba(110, 160, 240, 0.18)', 'rgba(90, 130, 220, 0)']);
    this.elips('lampu_sinar', 22, 12, ['rgba(255, 220, 140, 0.7)', 'rgba(255, 200, 110, 0.3)', 'rgba(255, 190, 100, 0)']);
  }

  /** Pendar elips halus, digambar 4× lebih rapat lalu dikecilkan. */
  private elips(key: string, lebar: number, tinggi: number, warna: [string, string, string] | string[]) {
    const tx = this.scene.textures;
    if (tx.exists(key)) return;
    const w = lebar * 4;
    const h = tinggi * 4;
    const k = tx.createCanvas(key, w, h)!;
    const ctx = k.getContext();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, warna[0]);
    g.addColorStop(0.4, warna[1]);
    g.addColorStop(1, warna[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
    k.refresh();
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
      this.scene.game.events.emit('mapporto:greet', 'Back to coding. Click the monitor for a fun fact, or move to get up.');
    }
  }

  private ucap(msg: string) {
    this.scene.game.events.emit('mapporto:ucap', { msg, siapa: this.monitor, nama: 'Computer' });
  }

  private detak(_t: number, delta: number) {
    const diketik = !!this.pemain()?.sedangKerja;
    if ((this.jedaGulir -= delta) <= 0) {
      this.jedaGulir = diketik ? GULIR.diketik : GULIR.ditinggal;
      this.baris = (this.baris + 1) % KODE.length;
      this.layar.setFrame(this.baris);
      this.layarMalam.setFrame(this.baris);
    }
    // tuts berketuk tidak rata: beberapa cepat, sesekali berhenti berpikir
    if (diketik && (this.jedaKetik -= delta) <= 0) {
      const x = this.monitor.x;
      const y = this.monitor.y;
      ketik(x, y, Math.random() < 0.12);
      this.jedaKetik = Math.random() < 0.08 ? Phaser.Math.Between(500, 1100) : Phaser.Math.Between(70, 180);
    }
    if (diketik && (this.jedaCentang -= delta) <= 0) {
      this.jedaCentang = Phaser.Math.Between(5000, 8000);
      this.centang();
    }
    const g = this.gelap();
    this.layarMalam.setAlpha(g);
    this.pendar.setAlpha(g * (diketik ? 0.8 : 0.5));
    this.sinarLampu.setAlpha(g * 0.6);
  }

  /** Tanda centang hijau yang naik dari layar lalu memudar. */
  private centang() {
    sukses(this.monitor.x, this.monitor.y);
    const c = this.scene.add
      .image(this.monitor.x + 5, this.monitor.y - this.monitor.height + 2, 'centang')
      .setDepth(KEDALAMAN_LAYAR + 1);
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
