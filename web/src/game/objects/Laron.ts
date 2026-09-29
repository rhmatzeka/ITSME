import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Di atas genangan cahaya lampu — laron itu sendiri yang tersorot terang. */
const KEDALAMAN = DEPTH.above + 64;

interface Ekor {
  titik: Phaser.GameObjects.Rectangle;
  sudut: number;
  laju: number;
  rx: number;
  ry: number;
  fase: number;
}

/** Ngengat: lebih besar dan lebih lambat dari laron, sayapnya terlihat mengepak. */
interface Ngengat {
  s: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  nyala: () => number;
  sudut: number;
  laju: number;
  r: number;
  fase: number;
}

interface Kerumun {
  x: number;
  y: number;
  /** Seberapa terang sumbernya sekarang (0..1) — laron hanya datang ke yang menyala. */
  nyala: () => number;
  ekor: Ekor[];
}

/**
 * Laron yang mengerumuni lampu di malam hari: titik-titik kecil terang yang
 * berputar cepat dan kacau di sekeliling lentera lampu jalan, lampu
 * gerobak, dan jendela rumah — sesekali menabrak kaca lalu terpental.
 *
 * Tiap laron beredar di elips kecilnya sendiri dengan kecepatan dan arah
 * yang berlainan, dan elipsnya digoyang, jadi kerumunannya tidak pernah
 * terlihat seperti roda yang berputar.
 */
export class Laron {
  private kerumun: Kerumun[] = [];
  private ngengat: Ngengat[] = [];

  constructor(private scene: Phaser.Scene) {
    // ngengat 5×3 tampak atas: dua frame, sayap terbuka dan terlipat
    spritesheetTeks(scene, 'ngengat', [['ab.ba', '.bcb.', '..c..'], ['.aba.', '.bcb.', '..c..']], {
      a: '#e8dcc0',
      b: '#c9b890',
      c: '#8a7a5a',
    });
    scene.events.on('update', this.detak, this);
  }

  /**
   * Ngengat yang berputar lebar mengelilingi lampu — lebih jarang dan lebih
   * pelan dari laron, dengan kepakan sayap yang kelihatan. Lintasannya
   * elips miring yang goyah, dan sesekali ia hinggap sebentar di tiangnya.
   */
  kitari(x: number, y: number, nyala: () => number, jumlah = 2) {
    for (let i = 0; i < jumlah; i++) {
      const s = this.scene.add.sprite(x, y, 'ngengat', 0).setDepth(KEDALAMAN).setVisible(false);
      this.ngengat.push({
        s,
        x,
        y,
        nyala,
        sudut: Math.random() * Math.PI * 2,
        laju: Phaser.Math.FloatBetween(1.4, 2.4) * (Math.random() < 0.5 ? -1 : 1),
        r: Phaser.Math.FloatBetween(8, 13),
        fase: Math.random() * 10,
      });
    }
  }

  /** Kerumunan baru di sekitar (x, y). `nyala` = seberapa terang cahayanya sekarang. */
  kerumuni(x: number, y: number, nyala: () => number, jumlah = 6) {
    const ekor: Ekor[] = [];
    for (let i = 0; i < jumlah; i++) {
      ekor.push({
        titik: this.scene.add
          .rectangle(x, y, 1, 1, i % 3 ? 0xfff2c0 : 0xffffff)
          .setDepth(KEDALAMAN)
          .setVisible(false),
        sudut: Math.random() * Math.PI * 2,
        laju: Phaser.Math.FloatBetween(3, 7) * (Math.random() < 0.5 ? -1 : 1),
        rx: Phaser.Math.FloatBetween(3, 8),
        ry: Phaser.Math.FloatBetween(2, 6),
        fase: Math.random() * 10,
      });
    }
    this.kerumun.push({ x, y, nyala, ekor });
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const kamera = this.scene.cameras.main.worldView;
    const z = this.scene.cameras.main.zoom;
    for (const m of this.ngengat) {
      const n = m.nyala();
      const tampak = n > 0.3 && kamera.contains(m.x, m.y);
      m.s.setVisible(tampak);
      if (!tampak) continue;
      m.fase += dt;
      // sesekali melambat hampir berhenti — hinggap sebentar di dekat lampunya
      const pelan = Math.sin(m.fase * 0.7) > 0.93 ? 0.1 : 1;
      m.sudut += m.laju * dt * pelan;
      const x = m.x + Math.cos(m.sudut) * m.r + Math.sin(m.fase * 3.1) * 2;
      const y = m.y + Math.sin(m.sudut) * m.r * 0.55 + Math.cos(m.fase * 2.3) * 2;
      m.s
        .setPosition(Math.round(x * z) / z, Math.round(y * z) / z)
        .setFrame(Math.floor(m.fase * (pelan < 1 ? 4 : 14)) % 2)
        .setAlpha(Math.min(1, n * 1.2));
    }
    for (const k of this.kerumun) {
      const n = k.nyala();
      // yang di luar layar tidak perlu digerakkan
      const tampak = n > 0.3 && kamera.contains(k.x, k.y);
      for (const e of k.ekor) {
        e.titik.setVisible(tampak);
        if (!tampak) continue;
        e.sudut += e.laju * dt;
        e.fase += dt;
        const goyang = Math.sin(e.fase * 5.3) * 2;
        // sesekali menukik menabrak sumber cahayanya, lalu terpental keluar lagi
        const tabrak = Math.max(0, Math.sin(e.fase * 1.3)) ** 8;
        const r = 1 - tabrak * 0.85;
        e.titik
          .setPosition(k.x + Math.cos(e.sudut) * e.rx * r + goyang, k.y + Math.sin(e.sudut) * e.ry * r)
          .setAlpha(n * (0.6 + 0.4 * Math.sin(e.fase * 17)));
      }
    }
  }
}
