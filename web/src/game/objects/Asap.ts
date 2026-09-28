import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * Di atas tirai malam: warnanya dihitung sendiri (lihat `warna()`), supaya
 * gumpalan yang melintas di depan lampu bisa ikut terang, sementara yang
 * jauh dari lampu tetap kelabu kebiruan seperti malam.
 */
const KEDALAMAN = DEPTH.above + 56;

/** Warna asap: siang, malam yang jauh dari lampu, dan yang tersorot lampu. */
const WARNA = {
  siang: [226, 226, 222],
  malam: [104, 112, 140],
  terang: [236, 196, 140],
} as const;

interface Gumpal {
  r: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  umur: number;
  lama: number;
  angin: number;
}

/**
 * Asap tipis dari dapur yang sedang menyalakan tungku: naik pelan dari atap,
 * melebar, terbawa angin ke timur (searah awan), lalu hilang.
 *
 * Malam hari gumpalan yang melintas dekat lampu jalan tersorot kuning hangat
 * — yang jauh dari lampu kelabu kebiruan. Itu yang membuat asapnya terasa
 * ada di dalam malam yang sama, bukan tempelan.
 */
export class Asap {
  private gumpal: Gumpal[] = [];
  private jeda = 0;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private gelap: () => number,
    /** Sumber cahaya di dekatnya, px dunia. */
    private lampu: { x: number; y: number }[]
  ) {
    for (let i = 0; i < 18; i++) {
      this.gumpal.push({
        r: scene.add.rectangle(0, 0, 2, 2, 0xffffff).setDepth(KEDALAMAN).setVisible(false),
        x: 0,
        y: 0,
        umur: 0,
        lama: 0,
        angin: 0,
      });
    }
    scene.events.on('update', this.detak, this);
  }

  private warna(x: number, y: number, g: number) {
    let terang = 0;
    for (const l of this.lampu) terang = Math.max(terang, 1 - Phaser.Math.Distance.Between(x, y, l.x, l.y) / 90);
    terang = Phaser.Math.Clamp(terang, 0, 1) * g;
    const c = [0, 1, 2].map((i) => {
      const malam = WARNA.malam[i] + (WARNA.terang[i] - WARNA.malam[i]) * terang;
      return Math.round(WARNA.siang[i] + (malam - WARNA.siang[i]) * g);
    });
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }

  private detak(_t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const g = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.6, 0, 1);
    if ((this.jeda -= delta) <= 0) {
      this.jeda = Phaser.Math.Between(380, 620);
      const b = this.gumpal.find((q) => q.umur <= 0);
      if (b) {
        b.x = this.x + Phaser.Math.Between(-2, 2);
        b.y = this.y;
        b.lama = Phaser.Math.FloatBetween(2.6, 3.6);
        b.umur = b.lama;
        b.angin = Phaser.Math.FloatBetween(3, 6);
        b.r.setVisible(true);
      }
    }
    for (const b of this.gumpal) {
      if (b.umur <= 0) continue;
      b.umur -= dt;
      if (b.umur <= 0) {
        b.r.setVisible(false);
        continue;
      }
      const f = 1 - b.umur / b.lama; // 0 baru keluar .. 1 habis
      b.y -= dt * (9 - f * 4);
      b.x += dt * b.angin * f + Math.sin(f * 9 + b.lama) * 0.08;
      b.r
        .setPosition(b.x, b.y)
        .setScale(1 + f * 2)
        .setFillStyle(this.warna(b.x, b.y, g))
        .setAlpha(0.62 * Math.min(1, f * 6) * (1 - f));
    }
  }
}
