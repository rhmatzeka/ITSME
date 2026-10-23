import Phaser from 'phaser';
import { kilau, ting } from '../bunyi';
import { DEPTH } from '../config';
import { cuaca } from '../cuaca';
import type { Player } from './Player';

/** Jeda antar bintang jatuh, ms. Jarang, supaya tiap kali terasa istimewa. */
const JEDA: [number, number] = [18000, 45000];

/** Permohonan Rahmat saat bintangnya tertangkap. */
const HARAPAN = [
  'Make a wish! ... I wished for zero bugs in production.',
  'A shooting star! I wished for more coffee. Do not tell anyone.',
  'Quick, make a wish! Mine: that you enjoy walking around this village.',
  'I wished for a good night of sleep. Rahmat never gets one.',
  'Wish made! I am not telling you what it was, or it will not come true.',
];

/**
 * Bintang jatuh di malam yang cerah: sesekali seberkas cahaya putih melesat
 * serong melintasi langit di atas kamera — kepalanya bersinar, ekornya
 * panjang meruncing dari putih ke biru muda, dan serbuk kilau kecil luruh di
 * belakangnya.
 * Desanya dilihat dari atas, jadi "langit"-nya adalah layar itu sendiri —
 * bintangnya digambar di atas tirai malam dan semua lampu, seperti kembang
 * api tahun baru.
 *
 * Bisa diketuk selagi melintas: Rahmat mengucapkan permohonan, bintangnya
 * pecah jadi kilau, dan prestasi "Wish upon a star" didapat.
 */
export class BintangJatuh {
  private g: Phaser.GameObjects.Graphics;
  private zona: Phaser.GameObjects.Zone;
  private lagi: number;
  private aktif = false;
  private dari = { x: 0, y: 0 };
  private ke = { x: 0, y: 0 };
  private mulai = 0;
  private lama = 0;
  private tertangkap = false;
  private harapanKe = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Player | undefined
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.above + 75).setBlendMode(Phaser.BlendModes.ADD);
    this.zona = scene.add.zone(0, 0, 26, 26).setDepth(DEPTH.above + 75).setInteractive({ useHandCursor: true });
    this.zona.input!.enabled = false;
    this.zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.tangkap();
    });
    this.lagi = scene.time.now + Phaser.Math.Between(6000, 14000);
    scene.events.on('update', this.detak, this);
  }

  /** Untuk dites dari konsol: `__game.scene.getScene('World').bintangJatuh.lontar()`. */
  lontar() {
    const v = this.scene.cameras.main.worldView;
    // dari pojok kanan atas layar, melesat serong ke kiri bawah
    this.dari = { x: v.x + v.width * Phaser.Math.FloatBetween(0.35, 0.95), y: v.y + v.height * Phaser.Math.FloatBetween(0.02, 0.3) };
    const sudut = Phaser.Math.DegToRad(Phaser.Math.Between(140, 160));
    const jauh = Phaser.Math.Between(70, 120);
    this.ke = { x: this.dari.x + Math.cos(sudut) * jauh, y: this.dari.y + Math.sin(sudut) * jauh };
    this.mulai = this.scene.time.now;
    this.lama = Phaser.Math.Between(800, 1200);
    this.aktif = true;
    this.tertangkap = false;
    this.zona.input!.enabled = true;
  }

  private detak(t: number) {
    const cerah = this.gelap() > 0.7 && cuaca.hujan < 0.2;
    if (!this.aktif) {
      if (t > this.lagi) {
        this.lagi = t + Phaser.Math.Between(...JEDA);
        if (cerah) this.lontar();
      }
      return;
    }
    const f = (t - this.mulai) / this.lama;
    if (f >= 1) {
      this.aktif = false;
      this.zona.input!.enabled = false;
      this.g.clear();
      return;
    }
    // melambat di ujung, memudar menjelang padam
    const e = 1 - (1 - f) * (1 - f);
    const kepala = { x: Phaser.Math.Linear(this.dari.x, this.ke.x, e), y: Phaser.Math.Linear(this.dari.y, this.ke.y, e) };
    const terang = f < 0.15 ? f / 0.15 : f > 0.75 ? (1 - f) / 0.25 : 1;
    const g = this.g.clear();
    const dx = this.ke.x - this.dari.x;
    const dy = this.ke.y - this.dari.y;
    const panjang = Math.hypot(dx, dy);
    const ux = dx / panjang;
    const uy = dy / panjang;
    // ekor panjang yang meruncing: tebal dan putih di dekat kepala, tipis dan
    // kebiruan di ujungnya
    const ekor = 38 * Math.min(1, f * 4);
    const RUAS = 16;
    for (let i = 0; i < RUAS; i++) {
      const a = (i / RUAS) * ekor;
      const b = ((i + 1) / RUAS) * ekor;
      const k = i / RUAS;
      const warna = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(0x8fb8ff),
        RUAS,
        i
      );
      g.lineStyle(2.2 * (1 - k) + 0.6, Phaser.Display.Color.GetColor(warna.r, warna.g, warna.b), terang * (1 - k) * 0.95);
      g.lineBetween(kepala.x - ux * a, kepala.y - uy * a, kepala.x - ux * b, kepala.y - uy * b);
    }
    // kepala bersinar: pendar lebar, pendar dalam, inti putih, kilau silang
    g.fillStyle(0x9fc0ff, terang * 0.18).fillCircle(kepala.x, kepala.y, 6);
    g.fillStyle(0xd8e6ff, terang * 0.45).fillCircle(kepala.x, kepala.y, 3);
    g.fillStyle(0xffffff, terang).fillRect(kepala.x - 1, kepala.y - 1, 2, 2);
    g.fillStyle(0xffffff, terang * 0.6).fillRect(kepala.x - 3, kepala.y, 6, 1).fillRect(kepala.x, kepala.y - 3, 1, 6);
    // jejak kilau kecil yang luruh dari ekornya
    if (Math.random() < 0.55 * terang) this.serbuk(kepala.x - ux * Phaser.Math.Between(2, 10), kepala.y - uy * Phaser.Math.Between(2, 10));
    this.zona.setPosition(kepala.x, kepala.y);
  }

  /** Sebutir serbuk bintang yang luruh pelan dan padam. */
  private serbuk(x: number, y: number) {
    const r = this.scene.add
      .rectangle(x, y, 1, 1, Phaser.Utils.Array.GetRandom([0xffffff, 0xdfe8ff, 0xfff2b0]))
      .setDepth(DEPTH.above + 74)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: r,
      y: y + Phaser.Math.Between(3, 7),
      x: x + Phaser.Math.FloatBetween(-1.5, 1.5),
      alpha: { from: 0.9, to: 0 },
      duration: Phaser.Math.Between(450, 800),
      onComplete: () => r.destroy(),
    });
  }

  private tangkap() {
    if (!this.aktif || this.tertangkap) return;
    this.tertangkap = true;
    const { x, y } = this.zona;
    this.lama = Math.min(this.lama, this.scene.time.now - this.mulai + 150);
    ting(x, y);
    kilau(x, y);
    // pecah jadi kilau kecil yang berhamburan
    for (let i = 0; i < 10; i++) {
      const r = this.scene.add
        .rectangle(x, y, 1, 1, Phaser.Utils.Array.GetRandom([0xffffff, 0xfff2b0, 0xbfd4ff]))
        .setDepth(DEPTH.above + 76)
        .setBlendMode(Phaser.BlendModes.ADD);
      const a = (i / 10) * Math.PI * 2;
      this.scene.tweens.add({
        targets: r,
        x: x + Math.cos(a) * Phaser.Math.Between(6, 14),
        y: y + Math.sin(a) * Phaser.Math.Between(6, 14),
        alpha: 0,
        duration: 700,
        onComplete: () => r.destroy(),
      });
    }
    const p = this.pemain();
    if (p?.visible) {
      this.scene.game.events.emit('mapporto:ucap', { msg: HARAPAN[this.harapanKe++ % HARAPAN.length], siapa: p, nama: 'Rahmat' });
    }
    this.scene.game.events.emit('mapporto:jejak', 'bintang');
  }
}
