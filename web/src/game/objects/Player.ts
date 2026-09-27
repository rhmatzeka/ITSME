import Phaser from 'phaser';
import { PLAYER, ROW, kedalaman, type Dir } from '../config';

/**
 * Karakter: satu sprite + satu sprite bayangan yang mengikuti persis di bawahnya.
 * Hitbox sengaja cuma sebesar kaki — supaya kepala bisa lewat di depan pagar
 * dan atap tanpa nyangkut.
 */
/** Lama diam sebelum mengeluarkan HP, lalu sebelum tertidur, ms. */
const SANTAI = { hp: 8000, tidur: 14000 } as const;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private shadow: Phaser.GameObjects.Sprite;
  private facing: Dir = 'down';
  private frozen = false;
  /** Kunci lembar dasarnya — texture.key berganti saat pose santai diputar. */
  private readonly kunci: string;
  /** Diam: 'aktif' → main HP → tidur. Gerak apa pun membangunkannya. */
  private santai: 'aktif' | 'hp' | 'tidur' = 'aktif';
  private diam = 0;
  private dengkur?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, key = 'player') {
    super(scene, x, y, key, ROW.idle.down * 4);
    this.kunci = key;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setSize(PLAYER.body.width, PLAYER.body.height);
    b.setOffset(PLAYER.body.offsetX, PLAYER.body.offsetY);
    b.setCollideWorldBounds(true);

    this.shadow = scene.add.sprite(x, y, scene.textures.exists(`${key}_shadow`) ? `${key}_shadow` : 'player_shadow', 0);
    Player.registerSantai(scene, key);
  }

  /** Animasi pose santai, kalau lembarnya ada (lihat Rupa.ts). */
  private static registerSantai(scene: Phaser.Scene, key: string) {
    if (scene.textures.exists(`${key}_hp`) && !scene.anims.exists(`${key}_hp`)) {
      scene.anims.create({
        key: `${key}_hp`,
        frames: scene.anims.generateFrameNumbers(`${key}_hp`, { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1,
      });
    }
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
      this.bangun();
      // normalisasi supaya gerak diagonal tidak lebih cepat
      body.setVelocity((vx / len) * PLAYER.speed, (vy / len) * PLAYER.speed);
      // sumbu dominan yang menentukan arah hadap
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      this.play(`${this.texture.key}_walk_${this.facing}`, true);
    } else {
      body.setVelocity(0, 0);
      if (this.santai === 'aktif') this.play(`${this.kunci}_idle_${this.facing}`, true);
    }
  }

  face(dir: Dir) {
    this.bangun();
    this.facing = dir;
    this.play(`${this.kunci}_idle_${dir}`, true);
  }

  freeze(on: boolean) {
    this.frozen = on;
    this.bangun();
    if (on) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.play(`${this.kunci}_idle_${this.facing}`, true);
    }
  }

  /** Sedang main HP atau tidur — senternya disimpan dulu. */
  get sedangSantai() {
    return this.santai !== 'aktif';
  }

  /**
   * Didiamkan sebentar, karakternya mengeluarkan HP; didiamkan lebih lama,
   * ia rebahan dan tertidur. Pengunjung yang meninggalkan tab terbuka
   * kembali ke desa yang masih hidup, bukan karakter yang mematung.
   */
  private tingkahSantai(delta: number) {
    const b = this.body as Phaser.Physics.Arcade.Body | undefined;
    const bergerak = !!b && (b.velocity.x !== 0 || b.velocity.y !== 0);
    if (this.frozen || bergerak || !this.visible) {
      this.diam = 0;
      return;
    }
    this.diam += delta;
    if (this.santai === 'aktif' && this.diam > SANTAI.hp && this.scene.anims.exists(`${this.kunci}_hp`)) {
      this.santai = 'hp';
      this.facing = 'down';
      this.play(`${this.kunci}_hp`);
    } else if (this.santai === 'hp' && this.diam > SANTAI.hp + SANTAI.tidur && this.scene.textures.exists(`${this.kunci}_tidur`)) {
      this.santai = 'tidur';
      this.anims.stop();
      this.setTexture(`${this.kunci}_tidur`, 0);
      this.dengkur = this.scene.time.addEvent({ delay: 1300, loop: true, callback: () => this.zzz() });
      this.zzz();
    }
  }

  /** Satu huruf z dari mulutnya, membesar sambil melayang naik. */
  private zzz() {
    // mulut kepala yang rebahan: wajahnya di kanan bantal, sedikit di bawah pusat frame
    const z = this.scene.add
      .image(this.x + 4, this.y + 4, 'zz')
      .setScale(0.5)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: z,
      x: z.x + Phaser.Math.Between(4, 9),
      y: z.y - 20,
      scale: 1,
      alpha: { from: 1, to: 0 },
      duration: 2000,
      ease: 'Sine.easeOut',
      onComplete: () => z.destroy(),
    });
  }

  private bangun() {
    this.diam = 0;
    if (this.santai === 'aktif') return;
    this.santai = 'aktif';
    this.dengkur?.remove();
    this.dengkur = undefined;
    this.setTexture(this.kunci, ROW.idle[this.facing] * 4);
    this.play(`${this.kunci}_idle_${this.facing}`, true);
  }

  setHidden(hidden: boolean) {
    this.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
  }

  /** Bayangan mengikuti frame yang sama supaya kakinya sinkron. */
  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.tingkahSantai(delta);
    // Kedalaman ikut garis pijak, dihitung ulang tiap frame karena karakternya
    // bergerak. Bayangannya menempel setengah tingkat di bawah: selalu persis
    // di belakang karakter, tapi tetap ikut terurut terhadap dunia.
    const d = kedalaman(this.y + PLAYER.baseY);
    this.setDepth(d);
    this.shadow.setDepth(d - 0.5);
    this.shadow.setPosition(this.x, this.y);
    // pose santai tidak punya bayangan sendiri: main HP memakai bayangan
    // berdiri, tidur tanpa bayangan (badannya sudah di tanah)
    this.shadow.setFrame(this.santai === 'aktif' ? this.frame.name : 0);
    this.shadow.setScale(this.scaleX, this.scaleY);
    this.shadow.setAlpha(this.santai === 'tidur' ? 0 : this.alpha * 0.55);
  }

  get direction() {
    return this.facing;
  }
}
