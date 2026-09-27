import Phaser from 'phaser';
import { DEPTH, TILE, kedalaman } from '../config';
import { Kisi, spritesheetTeks } from './piksel';

type Keadaan = 'tanah' | 'terbang' | 'pergi';

interface Seekor {
  s: Phaser.GameObjects.Sprite;
  keadaan: Keadaan;
  berikut: number;
  vx: number;
  vy: number;
}

/**
 * Burung pipit yang hinggap di tanah, mematuk dan melompat kecil, lalu
 * kabur terbang begitu pemain (atau kurir) mendekat. Beberapa detik
 * kemudian ia hinggap lagi di tempat lain, jadi desanya tidak pernah
 * kehabisan burung.
 *
 * Tempat hinggap dipilih dari petak yang tidak terhalang di grid tabrakan
 * — jadi tidak pernah di atas atap, air, atau pagar — dan tidak di depan
 * pintu, supaya tidak menutupi panah penunjuk.
 */
export class Burung {
  private kawanan: Seekor[] = [];

  constructor(
    private scene: Phaser.Scene,
    private kisi: Kisi,
    private hindari: [number, number][],
    private pengganggu: () => (Phaser.GameObjects.Components.Transform | undefined)[],
    jumlah = 5
  ) {
    this.buatTekstur();
    for (let i = 0; i < jumlah; i++) {
      const s = scene.add.sprite(0, 0, 'burung', 0).setOrigin(0.5, 1);
      const b: Seekor = { s, keadaan: 'tanah', berikut: 0, vx: 0, vy: 0 };
      this.hinggap(b, false);
      this.kawanan.push(b);
    }
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const p = { k: '#2b1d14', b: '#8a5a36', l: '#ead3a8', d: '#5a3a22', o: '#f2a23a', e: '#0e0a08' };
    spritesheetTeks(
      this.scene,
      'burung',
      [
        // 0 diam
        ['.........', '..kkk....', '.kbebk...', 'okbbbbkk.', '.kllbddbk', '..kllddk.', '...k.k...'],
        // 1 mematuk
        ['.........', '.........', '...kkkk..', '..kbbddkk', 'okebbddbk', '.kkllllk.', '...k.k...'],
        // 2 sayap naik
        ['....kk...', '...kdk...', '.kkdbkkk.', 'okebbbbbk', '.kllldk..', '..kkkk...', '.........'],
        // 3 sayap turun
        ['.........', '..kkk....', 'okebbkkk.', '.kbbbbbbk', '.kllddk..', '..kkdk...', '....kk...'],
      ],
      p
    );
  }

  /**
   * Cari petak rumput kosong yang jauh dari pintu dan dari pengganggu.
   *
   * Sebagian besar dipilih di sekitar area yang sedang terlihat kamera, dan
   * sering di dekat burung lain yang sudah hinggap — pipit datang berkelompok.
   * Dulu tempatnya diacak di seluruh peta: dengan 4-6 ekor untuk peta seluas
   * ini, layar ponsel yang cuma memperlihatkan sepotong kecil peta lebih
   * sering kosong daripada tidak, dan burungnya terasa hilang.
   */
  private tempatBaru() {
    const v = this.scene.cameras.main.worldView;
    const teman = this.kawanan.filter((b) => b.keadaan === 'tanah' && v.contains(b.s.x, b.s.y));
    for (let coba = 0; coba < 80; coba++) {
      let tx: number;
      let ty: number;
      const r = Math.random();
      if (teman.length && r < 0.45) {
        const t = Phaser.Utils.Array.GetRandom(teman);
        tx = Math.floor(t.s.x / TILE) + Phaser.Math.Between(-2, 2);
        ty = Math.floor(t.s.y / TILE) + Phaser.Math.Between(-1, 1);
      } else if (r < 0.85) {
        tx = Math.floor(Phaser.Math.Between(v.left - 24, v.right + 24) / TILE);
        ty = Math.floor(Phaser.Math.Between(v.top + 20, v.bottom + 24) / TILE);
      } else {
        tx = Phaser.Math.Between(1, this.kisi.w - 2);
        ty = Phaser.Math.Between(1, this.kisi.h - 2);
      }
      if (tx < 1 || ty < 1 || tx > this.kisi.w - 2 || ty > this.kisi.h - 2) continue;
      if (!this.kisi.bebas(tx, ty)) continue;
      if (this.hindari.some(([hx, hy]) => Math.abs(hx - tx) <= 2 && Math.abs(hy - ty) <= 2)) continue;
      const x = tx * TILE + Phaser.Math.Between(4, 12);
      const y = ty * TILE + Phaser.Math.Between(8, 14);
      const dekat = this.pengganggu().some((o) => o && Phaser.Math.Distance.Between(o.x, o.y, x, y) < 64);
      if (dekat) continue;
      return { x, y };
    }
    // cadangan: petak kosong mana pun di peta (tanpa syarat jarak)
    for (;;) {
      const tx = Phaser.Math.Between(1, this.kisi.w - 2);
      const ty = Phaser.Math.Between(1, this.kisi.h - 2);
      if (this.kisi.bebas(tx, ty)) return { x: tx * TILE + 8, y: ty * TILE + 12 };
    }
  }

  private hinggap(b: Seekor, turun: boolean) {
    const { x, y } = this.tempatBaru();
    b.keadaan = 'tanah';
    b.s.setFrame(0).setFlipX(Math.random() < 0.5).setVisible(true);
    b.berikut = this.scene.time.now + Phaser.Math.Between(400, 1600);
    if (!turun) {
      b.s.setPosition(x, y).setAlpha(1).setDepth(kedalaman(y));
      return;
    }
    // melayang turun dari atas, sayap mengepak, baru menjejak tanah
    b.s.setPosition(x - 30, y - 40).setAlpha(0).setDepth(DEPTH.above + 30);
    b.keadaan = 'terbang';
    this.scene.tweens.add({
      targets: b.s,
      x,
      y,
      alpha: 1,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: () => b.s.setFrame(Math.floor(this.scene.time.now / 90) % 2 ? 2 : 3),
      onComplete: () => {
        b.keadaan = 'tanah';
        b.s.setFrame(0).setDepth(kedalaman(y));
      },
    });
  }

  private kabur(b: Seekor, dari: { x: number; y: number }) {
    const sudut = Math.atan2(b.s.y - dari.y, b.s.x - dari.x);
    b.keadaan = 'pergi';
    b.vx = Math.cos(sudut) * 70;
    b.vy = Math.min(Math.sin(sudut) * 40, 0) - 45;
    b.s.setFlipX(b.vx > 0).setDepth(DEPTH.above + 30);
    b.berikut = this.scene.time.now + 1500;
    this.scene.tweens.add({ targets: b.s, alpha: 0, delay: 900, duration: 600 });
  }

  private cekBerikut = 0;

  /**
   * Burung yang sudah lama tertinggal di luar layar terbang datang ke dekat
   * area yang sedang dilihat, sampai ada sekitar `target` ekor di layar.
   * Tanpa ini burungnya menetap di tempat pemain pertama muncul, dan begitu
   * pemain berjalan ke sisi lain desa, layarnya kosong burung.
   */
  private datangkan(t: number) {
    if (t < this.cekBerikut) return;
    this.cekBerikut = t + Phaser.Math.Between(1500, 3000);
    const v = this.scene.cameras.main.worldView;
    const terlihat = this.kawanan.filter((b) => b.s.visible && v.contains(b.s.x, b.s.y)).length;
    const target = this.scene.scale.width < 700 ? 4 : 6;
    if (terlihat >= target) return;
    const jauh = this.kawanan.filter(
      (b) =>
        b.keadaan === 'tanah' &&
        !Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(v), 60, 60), b.s.x, b.s.y)
    );
    const b = jauh.length ? Phaser.Utils.Array.GetRandom(jauh) : undefined;
    if (b) this.hinggap(b, true);
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    this.datangkan(t);
    const pengganggu = this.pengganggu();
    for (const b of this.kawanan) {
      if (b.keadaan === 'pergi') {
        b.s.x += b.vx * dt;
        b.s.y += b.vy * dt;
        b.s.setFrame(Math.floor(t / 80) % 2 ? 2 : 3);
        if (t > b.berikut) {
          b.s.setVisible(false);
          b.keadaan = 'terbang';
          this.scene.time.delayedCall(Phaser.Math.Between(3000, 7000), () => this.hinggap(b, true));
        }
        continue;
      }
      if (b.keadaan !== 'tanah') continue;
      const ganggu = pengganggu.find(
        (o) => o && Phaser.Math.Distance.Between(o.x, o.y + 14, b.s.x, b.s.y) < 38
      );
      if (ganggu) {
        this.kabur(b, { x: ganggu.x, y: ganggu.y + 14 });
        continue;
      }
      if (t < b.berikut) continue;
      // tingkah di tanah: mematuk, melompat kecil, atau menoleh
      const r = Math.random();
      if (r < 0.5) {
        b.s.setFrame(1);
        this.scene.time.delayedCall(260, () => b.keadaan === 'tanah' && b.s.setFrame(0));
      } else if (r < 0.8) {
        const arah = b.s.flipX ? 1 : -1;
        this.scene.tweens.add({ targets: b.s, x: b.s.x + arah * 4, duration: 180, ease: 'Sine.easeOut' });
        this.scene.tweens.add({ targets: b.s, y: b.s.y - 3, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
      } else {
        b.s.setFlipX(!b.s.flipX);
      }
      b.berikut = t + Phaser.Math.Between(500, 1800);
    }
  }
}
