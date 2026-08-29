import Phaser from 'phaser';
import { PLAYER, ROW, kedalaman, type Dir } from '../config';

/**
 * Karakter: satu sprite + satu sprite bayangan yang mengikuti persis di bawahnya.
 * Hitbox sengaja cuma sebesar kaki — supaya kepala bisa lewat di depan pagar
 * dan atap tanpa nyangkut.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private shadow: Phaser.GameObjects.Sprite;
  private facing: Dir = 'down';
  private frozen = false;

  constructor(scene: Phaser.Scene, x: number, y: number, key = 'player') {
    super(scene, x, y, key, ROW.idle.down * 4);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setSize(PLAYER.body.width, PLAYER.body.height);
    b.setOffset(PLAYER.body.offsetX, PLAYER.body.offsetY);
    b.setCollideWorldBounds(true);

    this.shadow = scene.add.sprite(x, y, `${key}_shadow`, 0);
  }

  static registerAnimations(scene: Phaser.Scene, key = 'player') {
    const make = (name: string, row: number, rate: number, repeat: number) => {
      if (scene.anims.exists(`${key}_${name}`)) return;
      scene.anims.create({
        key: `${key}_${name}`,
        frames: scene.anims.generateFrameNumbers(key, { start: row * 4, end: row * 4 + 3 }),
        frameRate: rate,
        repeat,
      });
    };
    for (const [dir, row] of Object.entries(ROW.idle)) make(`idle_${dir}`, row, 4, -1);
    for (const [dir, row] of Object.entries(ROW.walk)) make(`walk_${dir}`, row, 9, -1);
  }

  /** Arahkan gerak dari vektor -1..1. Dipanggil tiap frame oleh WorldScene. */
  move(vx: number, vy: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.frozen) {
      body.setVelocity(0, 0);
      return;
    }

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      // normalisasi supaya gerak diagonal tidak lebih cepat
      body.setVelocity((vx / len) * PLAYER.speed, (vy / len) * PLAYER.speed);
      // sumbu dominan yang menentukan arah hadap
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      this.play(`${this.texture.key}_walk_${this.facing}`, true);
    } else {
      body.setVelocity(0, 0);
      this.play(`${this.texture.key}_idle_${this.facing}`, true);
    }
  }

  face(dir: Dir) {
    this.facing = dir;
    this.play(`${this.texture.key}_idle_${dir}`, true);
  }

  freeze(on: boolean) {
    this.frozen = on;
    if (on) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.play(`${this.texture.key}_idle_${this.facing}`, true);
    }
  }

  setHidden(hidden: boolean) {
    this.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
  }

  /** Bayangan mengikuti frame yang sama supaya kakinya sinkron. */
  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    // Kedalaman ikut garis pijak, dihitung ulang tiap frame karena karakternya
    // bergerak. Bayangannya menempel setengah tingkat di bawah: selalu persis
    // di belakang karakter, tapi tetap ikut terurut terhadap dunia.
    const d = kedalaman(this.y + PLAYER.baseY);
    this.setDepth(d);
    this.shadow.setDepth(d - 0.5);
    this.shadow.setPosition(this.x, this.y);
    this.shadow.setFrame(this.frame.name);
    this.shadow.setScale(this.scaleX, this.scaleY);
    this.shadow.setAlpha(this.alpha * 0.55);
  }

  get direction() {
    return this.facing;
  }
}
