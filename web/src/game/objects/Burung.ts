import Phaser from 'phaser';
import { cuit, kepak } from '../bunyi';
import { DEPTH, TILE, kedalaman } from '../config';
import { Kisi, spritesheetTeks } from './piksel';

type Keadaan = 'tanah' | 'terbang' | 'pergi';

interface Seekor {
  s: Phaser.GameObjects.Sprite;
  keadaan: Keadaan;
  berikut: number;
  vx: number;
  vy: number;
  /** Bayangan di tanah: tetap di tanah saat burungnya terbang, memudar makin tinggi. */
  bayang: Phaser.GameObjects.Ellipse;
  /** Garis tanah di bawah burung yang sedang terbang. */
  tanahY: number;
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
    jumlah = 5,
    /** Titik yang boleh dipijak — bukan air. Tanpa ini, cuma dicek per petak. */
    private bolehDi: (x: number, y: number) => boolean = () => true,
    /** 0 siang .. 1 malam: pipit pulang ke sarangnya begitu gelap. */
    private gelap: () => number = () => 0
  ) {
    this.buatTekstur();
    for (let i = 0; i < jumlah; i++) {
      const s = scene.add.sprite(0, 0, 'burung', 0).setOrigin(0.5, 1);
      const bayang = scene.add.ellipse(0, 0, 7, 2, 0x1b2416, 0.3).setDepth(DEPTH.below + 1);
      const b: Seekor = { s, keadaan: 'tanah', berikut: 0, vx: 0, vy: 0, bayang, tanahY: 0 };
      this.hinggap(b, false);
      this.kawanan.push(b);
    }
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    // Pipit gereja 12×8 menghadap kiri: topi cokelat, pipi putih, kerongkongan
    // hitam, punggung bergaris, ekor pendek. Digambar di scratchpad burung2.py.
    spritesheetTeks(
      this.scene,
      'burung',
      [
        // 0 diam
        [
          '...kkk......',
          '..kCcck.....',
          '.kcwecck....',
          'okwwwbBbkk..',
          '.kKwllbBbBkk',
          '..kllLbBbttk',
          '...kLLLkkkk.',
          '....k..k....',
        ],
        [
          '............',
          '....kkkk....',
          '..kkcCcckk..',
          '.kcwcbBbBbkk',
          'okwecbBbBttk',
          'kKwwllLbkkk.',
          '.kkllLLkk...',
          '....k..k....',
        ],
        [
          '...k...kk...',
          '..kBk.kBBk..',
          '..kbBkkbBk..',
          '..kcbBbBk...',
          'okwecbBbkkk.',
          '.kKwllLbbttk',
          '..kkLLLkkkk.',
          '............',
        ],
        [
          '............',
          '...kkk......',
          '..kcCck.....',
          'okwecckkkkkk',
          '.kKwllbBbttk',
          '..kllkbBbk..',
          '...kk.kbBk..',
          '.......kk...',
        ],
      ],
      {
        k: '#2b1d14', c: '#8a4a24', C: '#b0643a', w: '#f4ecdc', e: '#0e0a08', o: '#f2a23a', K: '#1b1512',
        l: '#d8cbb0', L: '#b8a88a', b: '#9a6a3e', B: '#5a3a22', t: '#6a4a2e',
      }
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
      // Petak "bebas" belum tentu kering: petak jembatan dan tepi sungai bisa
      // dilewati orang tapi sebagian gambarnya air. Yang dicek piksel pijaknya.
      if (!this.bolehDi(x, y)) continue;
      const dekat = this.pengganggu().some((o) => o && Phaser.Math.Distance.Between(o.x, o.y, x, y) < 64);
      if (dekat) continue;
      return { x, y };
    }
    // cadangan: petak kosong mana pun di peta (tanpa syarat jarak)
    for (;;) {
      const tx = Phaser.Math.Between(1, this.kisi.w - 2);
      const ty = Phaser.Math.Between(1, this.kisi.h - 2);
      if (this.kisi.bebas(tx, ty) && this.bolehDi(tx * TILE + 8, ty * TILE + 12)) return { x: tx * TILE + 8, y: ty * TILE + 12 };
    }
  }

  private hinggap(b: Seekor, turun: boolean) {
    // malam: tidak ada pipit yang hinggap — dicoba lagi nanti, siapa tahu sudah pagi
    if (turun && this.malam) {
      b.s.setVisible(false);
      b.keadaan = 'terbang';
      this.scene.time.delayedCall(Phaser.Math.Between(4000, 9000), () => this.hinggap(b, true));
      return;
    }
    const { x, y } = this.tempatBaru();
    b.keadaan = 'tanah';
    b.tanahY = y;
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
    // satu derai kepak untuk serombongan yang kabur bersamaan, bukan satu per ekor
    if (this.scene.time.now > this.kepakLagi) {
      this.kepakLagi = this.scene.time.now + 350;
      kepak(b.s.x, b.s.y);
    }
    const sudut = Math.atan2(b.s.y - dari.y, b.s.x - dari.x);
    b.keadaan = 'pergi';
    b.vx = Math.cos(sudut) * 70;
    b.vy = Math.min(Math.sin(sudut) * 40, 0) - 45;
    b.s.setFlipX(b.vx > 0).setDepth(DEPTH.above + 30);
    b.tanahY = b.s.y;
    b.berikut = this.scene.time.now + 1500;
    this.scene.tweens.add({ targets: b.s, alpha: 0, delay: 900, duration: 600 });
  }

  private cekBerikut = 0;
  private kepakLagi = 0;
  private malam = false;

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

  /**
   * Bayangan di tanah. Burung yang hinggap berdiri di atasnya; yang terbang
   * meninggalkannya di tanah dan bayangannya memudar makin tinggi — tanpa
   * itu, dari atas, burung yang melintas di atas sungai terlihat seperti
   * duduk di permukaan air.
   */
  private ikutBayang(b: Seekor) {
    if (!b.s.visible) {
      b.bayang.setVisible(false);
      return;
    }
    // lompatan kecil di tanah juga meninggalkan bayangannya di garis tanah
    const diTanah = b.keadaan === 'tanah';
    const tanah = b.tanahY;
    const tinggi = Math.max(0, tanah - b.s.y);
    b.bayang
      .setVisible(true)
      .setPosition(b.s.x, tanah)
      .setScale(diTanah ? 1 : Math.max(0.5, 1 - tinggi / 80))
      .setAlpha(0.3 * b.s.alpha * Math.max(0, 1 - tinggi / 70));
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    // senja → malam: semua yang masih di tanah terbang pulang
    const malam = this.gelap() > 0.55;
    if (malam && !this.malam) {
      for (const b of this.kawanan) if (b.keadaan === 'tanah') this.kabur(b, { x: b.s.x + Phaser.Math.Between(-20, 20), y: b.s.y + 30 });
    }
    this.malam = malam;
    if (!malam) this.datangkan(t);
    const pengganggu = this.pengganggu();
    for (const b of this.kawanan) {
      this.ikutBayang(b);
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
      if (Math.random() < 0.08) cuit(b.s.x, b.s.y);
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
