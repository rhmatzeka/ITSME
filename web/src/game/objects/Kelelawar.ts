import Phaser from 'phaser';
import { cicitKelelawar } from '../bunyi';
import { DEPTH, LAMPU, TILE } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Di atas tirai malam supaya siluetnya tetap hitam pekat (tidak ikut
 * membiru), tapi di bawah cahaya lampu — kelelawar yang melintas di depan
 * lampu jalan ikut tersorot.
 */
const KEDALAMAN = DEPTH.above + 55;

/** Tajuk pohon tempat kelelawar berputar, px dunia — selain lampu jalan. */
const POHON = [
  { x: 96, y: 262 },
  { x: 412, y: 46 },
  { x: 578, y: 44 },
  { x: 596, y: 288 },
  { x: 190, y: 505 },
  { x: 470, y: 505 },
  { x: 30, y: 30 },
];

interface Seekor {
  s: Phaser.GameObjects.Sprite;
  /** Titik yang sedang dikitari. */
  jangkar: { x: number; y: number };
  x: number;
  y: number;
  sudut: number;
  laju: number;
  jari: number;
  /** Kapan pindah ke jangkar lain, ms. */
  pindah: number;
  kepak: number;
}

/**
 * Kelelawar yang keluar saat malam: berputar-putar tidak beraturan di
 * sekitar lampu jalan (memburu laron) dan tajuk pohon, lalu sesekali
 * terbang jauh ke lampu atau pohon lain. Terbangnya patah-patah — arahnya
 * berbelok tajam tiap sepersekian detik — karena begitulah kelelawar
 * terbang, tidak meluncur mulus seperti burung.
 */
export class Kelelawar {
  private kawanan: Seekor[] = [];
  private jangkar: { x: number; y: number }[];

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    jumlah: number
  ) {
    spritesheetTeks(
      scene,
      'kelelawar',
      [
        ['k.........k', 'kk..k.k..kk', '.kkkkkkkkk.', '...kkekk...', '....k.k....'],
        ['...........', '....k.k....', 'kkkkkkkkkkk', '.kk.kek.kk.', '....k.k....'],
        ['....k.k....', '...kkkkk...', '.kkkkekkkk.', 'kk..kkk..kk', 'k.........k'],
      ],
      { k: '#16121e', e: '#3a2a3e' }
    );
    this.jangkar = [
      ...LAMPU.tiang.map(([tx, ty]) => ({ x: tx * TILE + LAMPU.lentera.x, y: ty * TILE + LAMPU.lentera.y - 6 })),
      ...POHON,
    ];
    for (let i = 0; i < jumlah; i++) {
      const j = this.jangkar[(i * 3) % this.jangkar.length];
      const s = scene.add.sprite(j.x, j.y, 'kelelawar', 0).setDepth(KEDALAMAN).setAlpha(0).setVisible(false);
      this.kawanan.push({
        s,
        jangkar: j,
        x: j.x,
        y: j.y,
        sudut: Math.random() * Math.PI * 2,
        laju: Phaser.Math.FloatBetween(2.2, 3.4) * (Math.random() < 0.5 ? -1 : 1),
        jari: Phaser.Math.Between(14, 26),
        pindah: 0,
        kepak: Math.random() * 100,
      });
    }
    scene.events.on('update', this.detak, this);
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const hadir = Phaser.Math.Clamp((this.gelap() - 0.6) / 0.25, 0, 1);
    const z = this.scene.cameras.main.zoom;
    for (const b of this.kawanan) {
      b.s.setVisible(hadir > 0).setAlpha(hadir);
      if (!hadir) continue;
      if (t > b.pindah) {
        b.pindah = t + Phaser.Math.Between(6000, 15000);
        b.jangkar = Phaser.Utils.Array.GetRandom(this.jangkar);
        b.jari = Phaser.Math.Between(12, 28);
        if (Math.random() < 0.3) cicitKelelawar(b.x, b.y);
      }
      // lingkaran yang digoyang: jari-jarinya berdenyut, sudutnya tersentak
      b.sudut += b.laju * dt * (Math.sin(t / 170 + b.kepak) > 0.6 ? 1.8 : 1);
      const r = b.jari * (0.75 + 0.25 * Math.sin(t / 430 + b.kepak));
      const tx = b.jangkar.x + Math.cos(b.sudut) * r;
      const ty = b.jangkar.y + Math.sin(b.sudut) * r * 0.6 - 6;
      // mendekati titik lintasannya dengan cepat, jadi perpindahan antar
      // jangkar berupa terbang lurus yang lalu melengkung masuk ke putarannya
      const kejar = Math.min(1, dt * 3.5);
      b.x += (tx - b.x) * kejar;
      b.y += (ty - b.y) * kejar;
      b.s.setPosition(Math.round(b.x * z) / z, Math.round(b.y * z) / z);
      b.kepak += dt;
      b.s.setFrame(Math.floor(t / 70 + b.kepak * 10) % 3);
    }
  }
}
