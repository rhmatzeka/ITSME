import Phaser from 'phaser';
import { PLAYER, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Jarak antar bekas langkah, px dunia — kira-kira satu langkah kaki. */
const JARAK = 13;

/**
 * Bekas langkah karakter: kepulan debu kecil di jalan tanah dan batu, helai
 * rumput yang terpental di rumput.
 *
 * Tanpa ini karakternya meluncur di atas peta; dengan ini tiap langkah
 * meninggalkan sesuatu di tanah yang diinjaknya. Muncul di belakang kaki
 * (berlawanan arah jalan) dan digambar tepat di belakang karakternya.
 */
export class Debu {
  private kepul: Phaser.GameObjects.Sprite[] = [];
  private helai: Phaser.GameObjects.Rectangle[] = [];
  private tempuh = 0;
  private tadi?: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Phaser.GameObjects.Sprite | undefined,
    /** Apakah titik dunia ini jalan tanah atau batu. */
    private jalan: (x: number, y: number) => boolean,
    /** Apakah titik dunia ini rumput (bukan air, bukan papan jembatan). */
    private rumput: (x: number, y: number) => boolean
  ) {
    spritesheetTeks(
      scene,
      'debu_langkah',
      [
        ['.......', '.......', '..ab...', '.abba..', '.......'],
        ['.......', '..aa...', '.abba..', 'aabbaa.', '.......'],
        ['..a.a..', '.a...a.', 'a..b..a', '.a...a.', '.......'],
        ['.a...a.', '.......', 'a.....a', '.......', '.......'],
      ],
      { a: '#f8e2bd', b: '#dcae78' }
    );
    if (!scene.anims.exists('debu_langkah')) {
      scene.anims.create({
        key: 'debu_langkah',
        frames: scene.anims.generateFrameNumbers('debu_langkah', {}),
        frameRate: 11,
        hideOnComplete: true,
      });
    }
    for (let i = 0; i < 8; i++) this.kepul.push(scene.add.sprite(0, 0, 'debu_langkah', 0).setVisible(false));
    for (let i = 0; i < 8; i++) this.helai.push(scene.add.rectangle(0, 0, 1, 2, 0x7ac04a).setVisible(false));
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  private detak() {
    const p = this.pemain();
    const b = p?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!p || !b || !p.visible) {
      this.tadi = undefined;
      return;
    }
    const kaki = { x: p.x, y: p.y + PLAYER.baseY - 1 };
    const tadi = this.tadi;
    this.tadi = kaki;
    if (!tadi) return;
    const d = Phaser.Math.Distance.Between(tadi.x, tadi.y, kaki.x, kaki.y);
    // diam, atau baru saja dipindahkan petir: bukan langkah
    if (d < 0.05 || d > 8) return;
    this.tempuh += d;
    if (this.tempuh < JARAK) return;
    this.tempuh = 0;
    // di belakang kaki, berlawanan arah jalan
    const x = kaki.x - ((kaki.x - tadi.x) / d) * 3;
    const y = kaki.y - ((kaki.y - tadi.y) / d) * 2;
    if (this.jalan(x, y)) this.kepulkan(x, y);
    else if (this.rumput(x, y)) this.pentalkan(x, y);
  }

  private kepulkan(x: number, y: number) {
    const s = this.kepul.find((o) => !o.visible);
    if (!s) return;
    s.setPosition(Math.round(x), Math.round(y) - 1)
      .setDepth(kedalaman(y) - 0.6)
      .setAlpha(0.85)
      .setFlipX(Math.random() < 0.5)
      .setVisible(true)
      .play('debu_langkah');
  }

  /** Satu dua helai rumput terpental pendek dari bawah kaki, lalu jatuh dan hilang. */
  private pentalkan(x: number, y: number) {
    for (let n = Phaser.Math.Between(1, 2); n > 0; n--) {
      const h = this.helai.find((o) => !o.visible);
      if (!h) return;
      const x0 = Math.round(x) + Phaser.Math.Between(-2, 2);
      const y0 = Math.round(y);
      h.setPosition(x0, y0)
        .setDepth(kedalaman(y) - 0.6)
        .setFillStyle(Math.random() < 0.5 ? 0x4f9a3a : 0x8fd05a)
        .setAlpha(1)
        .setVisible(true);
      this.scene.tweens.add({ targets: h, x: x0 + Phaser.Math.Between(-3, 3), duration: 320 });
      this.scene.tweens.add({
        targets: h,
        y: y0 - Phaser.Math.Between(3, 5),
        duration: 160,
        ease: 'Quad.easeOut',
        yoyo: true,
        onComplete: () => h.setVisible(false),
      });
    }
  }
}
