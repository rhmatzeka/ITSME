import Phaser from 'phaser';
import { DEPTH } from '../config';

/** Pita air, px dunia: sungai mendatar (mengalir ke timur) dan sungai tegak di barat (mengalir ke selatan). */
const PITA = [
  { x0: 0, x1: 624, y0: 378, y1: 403, tegak: false, jumlah: 46 },
  { x0: 16, x1: 31, y0: 0, y1: 372, tegak: true, jumlah: 16 },
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
 * Arus sungai: garis-garis riak pendek yang hanyut searah aliran, muncul,
 * memanjang sebentar, lalu hilang.
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
        const img = scene.add.image(0, 0, 'arus_datar', 0).setDepth(KEDALAMAN).setVisible(false);
        // umur awal diacak supaya tidak semuanya lahir di frame yang sama
        this.garis.push({ img, pita, x: 0, y: 0, laju: 0, umur: -Math.random() * 3, lama: 0 });
      }
    }
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  /** Tiga panjang garis, mendatar dan tegak: pucuknya (arah hanyut) lebih terang. */
  private buatTekstur() {
    const tx = this.scene.textures;
    if (tx.exists('arus_datar')) return;
    const panjang = [4, 6, 9];
    const lebar = Math.max(...panjang);
    for (const tegak of [false, true]) {
      const k = tx.createCanvas(tegak ? 'arus_tegak' : 'arus_datar', tegak ? panjang.length : lebar, tegak ? lebar : panjang.length)!;
      const ctx = k.getContext();
      panjang.forEach((p, f) => {
        for (let i = 0; i < p; i++) {
          ctx.fillStyle = i === p - 1 ? '#ffffff' : '#cfeeff';
          if (tegak) ctx.fillRect(f, i, 1, 1);
          else ctx.fillRect(i, f, 1, 1);
        }
        if (tegak) k.add(f, 0, f, 0, 1, p);
        else k.add(f, 0, 0, f, p, 1);
      });
      k.refresh();
    }
  }

  private lahir(g: Garis) {
    const p = g.pita;
    // beberapa kali mencoba mencari air terbuka; gagal = coba lagi nanti
    for (let n = 0; n < 6; n++) {
      const x = Phaser.Math.Between(p.x0, p.x1);
      const y = Phaser.Math.Between(p.y0, p.y1);
      const ujung = p.tegak ? this.air(x, y + 11) : this.air(x + 11, y);
      if (!this.air(x, y) || !ujung) continue;
      g.x = x;
      g.y = y;
      g.laju = Phaser.Math.FloatBetween(7, 13);
      g.lama = Phaser.Math.FloatBetween(1.6, 3.2);
      g.umur = g.lama;
      g.img.setTexture(p.tegak ? 'arus_tegak' : 'arus_datar', Phaser.Math.Between(0, 2)).setVisible(true);
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
      const depan = g.pita.tegak ? this.air(g.x, g.y + 9) : this.air(g.x + 9, g.y);
      if (g.umur <= 0 || !depan) {
        g.img.setVisible(false);
        g.umur = -Phaser.Math.FloatBetween(0.3, 1.6);
        continue;
      }
      // pudar masuk dan keluar bertangga, bukan gradasi halus: tetap pixel art
      const f = 1 - g.umur / g.lama;
      const pekat = Math.ceil(Math.sin(Math.PI * f) * 3) / 3;
      g.img.setPosition(Math.round(g.x * z) / z, Math.round(g.y * z) / z).setAlpha(0.9 * pekat);
    }
  }
}
