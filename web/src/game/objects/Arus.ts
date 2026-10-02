import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Pita air, px dunia: sungai mendatar (mengalir ke timur) dan sungai tegak di barat (mengalir ke selatan). */
const PITA = [
  { x0: 0, x1: 624, y0: 378, y1: 403, tegak: false, jumlah: 30 },
  { x0: 16, x1: 31, y0: 0, y1: 372, tegak: true, jumlah: 12 },
] as const;

/** Di atas air (lapisan dasar), di bawah jembatan, batu, dan teratai (lantai). */
const KEDALAMAN = DEPTH.ground + 0.5;

interface Garis {
  img: Phaser.GameObjects.Image;
  pita: (typeof PITA)[number];
  x: number;
  y: number;
  laju: number;
  umur: number;
  lama: number;
}

/**
 * Arus sungai: riak-riak kecil yang hanyut pelan searah aliran, muncul,
 * melengkung sebentar, lalu pecah dan hilang.
 *
 * Airnya tile peta yang diam; ikan, bebek, dan kilau cuma mengisi beberapa
 * titik, jadi permukaan seluas itu terbaca seperti lantai biru. Riak yang
 * terus hanyut membuat seluruh pitanya terasa mengalir. Tiap garis hanya
 * lahir dan hidup di atas air terbuka: begitu ujungnya menyentuh tepi, batu,
 * atau jembatan, ia hilang.
 */
export class Arus {
  private garis: Garis[] = [];

  constructor(
    private scene: Phaser.Scene,
    /** Apakah titik dunia ini air terbuka. */
    private air: (x: number, y: number) => boolean
  ) {
    this.buatTekstur();
    for (const pita of PITA) {
      for (let i = 0; i < pita.jumlah; i++) {
        const img = scene.add.image(0, 0, 'riak_arus', 0).setDepth(KEDALAMAN).setVisible(false);
        // umur awal diacak supaya tidak semuanya lahir di frame yang sama
        this.garis.push({ img, pita, x: 0, y: 0, laju: 0, umur: -Math.random() * 3, lama: 0 });
      }
    }
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  /**
   * Satu riak, empat tahap: muncul pendek, memanjang, melengkung dengan
   * kilau putih di puncaknya, lalu pecah jadi dua. Warnanya biru muda air
   * itu sendiri, bukan garis putih — cuma kilaunya yang putih.
   */
  private buatTekstur() {
    spritesheetTeks(
      this.scene,
      'riak_arus',
      [
        ['...ll....', '.........'],
        ['..llll...', '.........'],
        ['..lwwll..', '.l.....l.'],
        ['.ll...ll.', '.........'],
      ],
      { l: '#8fd6f9', w: '#ffffff' }
    );
  }

  private lahir(g: Garis) {
    const p = g.pita;
    // beberapa kali mencoba mencari air terbuka; gagal = coba lagi nanti
    for (let n = 0; n < 6; n++) {
      const x = Phaser.Math.Between(p.x0, p.x1);
      const y = Phaser.Math.Between(p.y0, p.y1);
      // kedua ujung riaknya (lebar 9) dan jalur di depannya harus air terbuka
      const depan = p.tegak ? this.air(x, y + 8) : this.air(x + 12, y);
      if (!this.air(x - 5, y) || !this.air(x + 5, y) || !depan) continue;
      g.x = x;
      g.y = y;
      g.laju = Phaser.Math.FloatBetween(4, 8);
      g.lama = Phaser.Math.FloatBetween(2.2, 3.6);
      g.umur = g.lama;
      g.img.setFrame(0).setAlpha(0.85).setVisible(true);
      return;
    }
    g.umur = -Phaser.Math.FloatBetween(0.2, 0.8);
  }

  private detak(_t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const z = this.scene.cameras.main.zoom;
    for (const g of this.garis) {
      if (g.umur <= 0) {
        // jeda sebelum lahir lagi
        g.umur += dt;
        if (g.umur > 0) this.lahir(g);
        continue;
      }
      g.umur -= dt;
      if (g.pita.tegak) g.y += g.laju * dt;
      else g.x += g.laju * dt;
      const depan = g.pita.tegak ? this.air(g.x, g.y + 3) : this.air(g.x + 6, g.y);
      if (g.umur <= 0 || !depan) {
        g.img.setVisible(false);
        g.umur = -Phaser.Math.FloatBetween(0.3, 1.6);
        continue;
      }
      // bentuknya yang berganti (lihat buatTekstur), bukan pekatnya yang memudar
      const f = 1 - g.umur / g.lama;
      const tahap = f < 0.12 ? 0 : f < 0.28 ? 1 : f < 0.78 ? 2 : 3;
      g.img.setFrame(tahap).setPosition(Math.round(g.x * z) / z, Math.round(g.y * z) / z);
    }
  }
}
