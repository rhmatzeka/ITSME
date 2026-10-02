import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Di atas tirai malam: warnanya dihitung sendiri (lihat `warna()`), supaya
 * gumpalan yang melintas di depan lampu bisa ikut terang, sementara yang
 * jauh dari lampu tetap kelabu kebiruan seperti malam.
 */
const KEDALAMAN = DEPTH.above + 56;

/** Warna asap: siang, malam yang jauh dari lampu, dan yang tersorot lampu. */
const WARNA = {
  siang: [255, 255, 255],
  malam: [104, 112, 140],
  terang: [236, 196, 140],
} as const;

/** Tinggi cerobong di atas titik pasangnya, px — asap keluar dari puncaknya. */
const TINGGI_CEROBONG = 8;

interface Gumpal {
  r: Phaser.GameObjects.Image;
  x: number;
  y: number;
  umur: number;
  lama: number;
  angin: number;
}

/**
 * Asap tipis dari dapur yang sedang menyalakan tungku: keluar dari cerobong
 * bata di atap, naik pelan sambil membesar, terbawa angin ke timur (searah
 * awan), lalu buyar.
 *
 * Gumpalannya gambar piksel bulat dalam empat tahap (kecil, sedang, besar,
 * buyar). Versi pertama memakai kotak yang diperbesar, tanpa cerobong:
 * terbaca seperti kotak-kotak krem yang melayang dari genteng.
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
    /** Titik pasang cerobong di atap: tengah dasarnya, px dunia. */
    private x: number,
    private y: number,
    private gelap: () => number,
    /** Sumber cahaya di dekatnya, px dunia. */
    private lampu: { x: number; y: number }[]
  ) {
    spritesheetTeks(
      scene,
      'cerobong',
      [['kkkkkkk', 'kssSSsk', 'kkkkkkk', '.kbBbk.', '.kBbBk.', '.kbBbk.', '.kBbBk.', '.kbBbk.']],
      { k: '#2a2420', s: '#9a9a94', S: '#74746e', b: '#b5553c', B: '#8f3f2e' }
    );
    spritesheetTeks(
      scene,
      'asap_gumpal',
      [
        ['.......', '.......', '...a...', '..aab..', '...b...', '.......'],
        ['.......', '..aaa..', '.aaaab.', '.aabbb.', '..bbb..', '.......'],
        ['..aaa..', '.aaaaa.', 'aaaaabb', 'aaaabbb', '.aabbb.', '..bbb..'],
        ['..a.a..', '.a...a.', 'a..a..b', '.a...b.', '..a.b..', '.......'],
      ],
      { a: '#ffffff', b: '#d9dbd6' }
    );
    // di atas genteng (lapisan menggantung), di bawah tirai malam: ikut gelap seperti rumahnya
    scene.add.image(x, y, 'cerobong').setOrigin(0.5, 1).setDepth(DEPTH.above + 2);
    for (let i = 0; i < 8; i++) {
      this.gumpal.push({
        r: scene.add.image(0, 0, 'asap_gumpal', 0).setDepth(KEDALAMAN).setVisible(false),
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
      this.jeda = Phaser.Math.Between(650, 950);
      const b = this.gumpal.find((q) => q.umur <= 0);
      if (b) {
        b.x = this.x;
        b.y = this.y - TINGGI_CEROBONG - 2;
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
      // membesar dan menipis bertahap, dikunci ke piksel layar seperti awan
      const tahap = f < 0.2 ? 0 : f < 0.5 ? 1 : f < 0.82 ? 2 : 3;
      const z = this.scene.cameras.main.zoom;
      b.r
        .setFrame(tahap)
        .setPosition(Math.round(b.x * z) / z, Math.round(b.y * z) / z)
        .setTint(this.warna(b.x, b.y, g))
        .setAlpha([0.85, 0.75, 0.6, 0.4][tahap]);
    }
  }
}
