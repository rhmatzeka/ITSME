import Phaser from 'phaser';
import { DEPTH } from '../config';
import { pastikanPanahPintu } from './piksel';

/**
 * Di atas tirai malam (DEPTH.above + 50) bersama cahaya lampu jalan, di
 * bawah awan (DEPTH.above + 65): awan yang lewat tetap menutupi nyalanya.
 */
const DEPTH_SINAR = DEPTH.above + 61;
/** Satu riak: dari lingkaran sampai hilang, ms. */
const RIAK_MS = 1600;
const KUNING = 0xffd23f;

/**
 * Penunjuk tempat masuk: panah kuning yang memantul, bayangannya di tanah,
 * dan lingkaran tempat berdiri — dipakai di depan pintu rumah (WorldScene)
 * dan kursi terminal (Teras), supaya keduanya selalu sama persis.
 *
 * Lingkarannya ada di tanah, jadi ikut digelapkan tirai malam; dulu di malam
 * hari lingkaran itu nyaris hilang sementara panahnya tetap terang. Sekarang
 * ada lapisan kedua di atas tirai (ADD, seperti genangan cahaya lampu jalan):
 * pendar kuning bertingkat dan cincin yang menyala, kuatnya mengikuti
 * gelapnya desa. Di siang hari lapisan itu tidak tampak dan yang terlihat
 * lingkaran tanah biasa.
 *
 * Dari lingkarannya sesekali keluar riak yang melebar lalu memudar, supaya
 * tempat masuk terlihat dari jauh; riak berhenti begitu karakternya sudah
 * berdiri di situ.
 */
export class Penunjuk {
  private panah: Phaser.GameObjects.Image;
  private bayangan: Phaser.GameObjects.Ellipse;
  private cincin: Phaser.GameObjects.Graphics;
  private sinar: Phaser.GameObjects.Graphics;
  private riak: Phaser.GameObjects.Graphics;
  private riakSinar: Phaser.GameObjects.Graphics;
  private nyala = 1;
  /** Riak tiap penunjuk tidak serempak: geser fasenya menurut letaknya. */
  private fase: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private gelap: () => number
  ) {
    pastikanPanahPintu(scene);
    this.fase = (x * 7 + y * 13) % RIAK_MS;
    // bayangan panah di tanah: mengecil saat panahnya naik, supaya terasa melayang
    this.bayangan = scene.add.ellipse(x, y - 6, 8, 3, 0x1b2416, 0.35).setDepth(DEPTH.above + 69);
    this.panah = scene.add.image(x, y - 24, 'panah_pintu').setDepth(DEPTH.above + 70);
    scene.tweens.add({ targets: this.panah, y: y - 20, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.bayangan, scaleX: 1.35, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // siang: lingkaran di tanah, di bawah kaki siapa pun yang berdiri di situ
    this.cincin = scene.add.graphics().setDepth(DEPTH.below + 1);
    this.cincin.fillStyle(0xffffff, 0.28).fillEllipse(x, y + 2, 20, 9);
    this.cincin.lineStyle(1, 0x1b2416, 0.55).strokeEllipse(x, y + 2, 22, 11);
    this.cincin.lineStyle(1, KUNING, 1).strokeEllipse(x, y + 2, 20, 9);

    // malam: pendar bertingkat (gaya piksel, bukan gradasi halus) + cincin menyala
    this.sinar = scene.add.graphics().setDepth(DEPTH_SINAR).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    for (const [w, h, a] of [
      [34, 15, 0.1],
      [28, 12, 0.12],
      [22, 10, 0.16],
    ] as const)
      this.sinar.fillStyle(0xffc23a, a).fillEllipse(x, y + 2, w, h);
    this.sinar.lineStyle(1, KUNING, 0.95).strokeEllipse(x, y + 2, 20, 9);

    this.riak = scene.add.graphics({ x, y: y + 2 }).setDepth(DEPTH.below + 1);
    this.riakSinar = scene.add.graphics({ x, y: y + 2 }).setDepth(DEPTH_SINAR).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Dipanggil tiap frame. `tujuan`: 1 tampil penuh, 0.35 sudah didekati, 0 disembunyikan. */
  atur(tujuan: number) {
    this.nyala += (tujuan - this.nyala) * 0.12;
    if (Math.abs(this.nyala - tujuan) < 0.01) this.nyala = tujuan;
    const n = this.nyala;
    const g = Phaser.Math.Clamp(this.gelap(), 0, 1);
    const now = this.scene.time.now;
    const denyut = 0.75 + 0.25 * Math.sin(now / 260);

    this.panah.setAlpha(n);
    this.bayangan.setAlpha(n);
    this.cincin.setAlpha(n * denyut);
    this.sinar.setAlpha(n * g * (0.8 + 0.2 * denyut));

    // riak: melebar 1x → 1,9x sambil memudar; hanya saat penunjuk tampil penuh
    const p = ((now + this.fase) % RIAK_MS) / RIAK_MS;
    const s = 1 + 0.9 * Phaser.Math.Easing.Quadratic.Out(p);
    const a = (1 - p) * (1 - p) * Phaser.Math.Clamp((n - 0.35) / 0.65, 0, 1);
    this.riak.clear();
    this.riakSinar.clear();
    if (a < 0.01) return;
    this.riak.lineStyle(1, KUNING, a * (1 - g)).strokeEllipse(0, 0, 20 * s, 9 * s);
    if (g > 0.01) this.riakSinar.lineStyle(1, KUNING, a * g).strokeEllipse(0, 0, 20 * s, 9 * s);
  }
}
