import Phaser from 'phaser';
import { DEPTH } from '../config';

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

  constructor(private scene: Phaser.Scene) {
    scene.events.on('update', this.detak, this);
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
