import Phaser from 'phaser';
import { DEPTH } from '../config';
import { pastikanPanahPintu } from './piksel';
import { lubangCahaya } from './Suasana';

/** Satu riak: dari lingkaran sampai hilang, ms. */
const RIAK_MS = 1600;
const KUNING = 0xffd23f;

/**
 * Penunjuk tempat masuk: panah kuning yang memantul, bayangannya di tanah,
 * dan lingkaran tempat berdiri — dipakai di depan pintu rumah (WorldScene)
 * dan kursi terminal (Teras), supaya keduanya selalu sama persis.
 *
 * Lingkarannya ada di tanah, jadi ikut digelapkan tirai malam; dulu di malam
 * hari lingkaran itu nyaris hilang sementara panahnya tetap terang. Cahaya
 * ADD di atas tirai juga salah: ia menimpa karakter yang berdiri di situ,
 * seolah lingkarannya menembus badannya. Sekarang tirai malamnya sendiri
 * dilubangi lembut di tiap lingkaran (lubangCahaya): lingkaran tetap di
 * tanah, di bawah kaki siapa pun, dan tetap terang di malam hari.
 *
 * Dari lingkarannya sesekali keluar riak yang melebar lalu memudar, supaya
 * tempat masuk terlihat dari jauh; riak berhenti begitu karakternya sudah
 * berdiri di situ.
 */
export class Penunjuk {
  private panah: Phaser.GameObjects.Image;
  private bayangan: Phaser.GameObjects.Ellipse;
  private cincin: Phaser.GameObjects.Graphics;
  private riak: Phaser.GameObjects.Graphics;
  private nyala = 1;
  /** Riak tiap penunjuk tidak serempak: geser fasenya menurut letaknya. */
  private fase: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    pastikanPanahPintu(scene);
    this.fase = (x * 7 + y * 13) % RIAK_MS;
    // bayangan panah di tanah: mengecil saat panahnya naik, supaya terasa melayang
    this.bayangan = scene.add.ellipse(x, y - 6, 8, 3, 0x1b2416, 0.35).setDepth(DEPTH.above + 69);
    this.panah = scene.add.image(x, y - 24, 'panah_pintu').setDepth(DEPTH.above + 70);
    scene.tweens.add({ targets: this.panah, y: y - 20, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.bayangan, scaleX: 1.35, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // lingkaran di tanah, di bawah kaki siapa pun yang berdiri di situ
    this.cincin = scene.add.graphics().setDepth(DEPTH.below + 1);
    this.cincin.fillStyle(0xffffff, 0.28).fillEllipse(x, y + 2, 20, 9);
    this.cincin.lineStyle(1, 0x1b2416, 0.55).strokeEllipse(x, y + 2, 22, 11);
    this.cincin.lineStyle(1, KUNING, 1).strokeEllipse(x, y + 2, 20, 9);
    this.riak = scene.add.graphics({ x, y: y + 2 }).setDepth(DEPTH.below + 1);
    // malam: tirai dilubangi di sini, jadi lingkaran dan riaknya tetap terang
    lubangCahaya(scene, x, y + 2);
  }

  /** Dipanggil tiap frame. `tujuan`: 1 tampil penuh, 0.35 sudah didekati, 0 disembunyikan. */
  atur(tujuan: number) {
    this.nyala += (tujuan - this.nyala) * 0.12;
    if (Math.abs(this.nyala - tujuan) < 0.01) this.nyala = tujuan;
    const n = this.nyala;
    const now = this.scene.time.now;
    this.panah.setAlpha(n);
    this.bayangan.setAlpha(n);
    this.cincin.setAlpha(n * (0.75 + 0.25 * Math.sin(now / 260)));

    // riak: melebar 1x → 1,9x sambil memudar; hanya saat penunjuk tampil penuh
    const p = ((now + this.fase) % RIAK_MS) / RIAK_MS;
    const s = 1 + 0.9 * Phaser.Math.Easing.Quadratic.Out(p);
    const a = (1 - p) * (1 - p) * Phaser.Math.Clamp((n - 0.35) / 0.65, 0, 1);
    this.riak.clear();
    if (a >= 0.01) this.riak.lineStyle(1, KUNING, a).strokeEllipse(0, 0, 20 * s, 9 * s);
  }
}
