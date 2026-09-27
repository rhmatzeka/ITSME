import Phaser from 'phaser';
import { PLAYER, ROW, kedalaman, type Dir } from '../config';
import { BAYANGAN_KAKI, bayanganKaki } from './piksel';

/**
 * Karakter: satu sprite + bayangan tanah di bawah kakinya.
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
  /**
   * Diam: 'aktif' → main HP → tidur. Gerak membangunkannya lewat 'bangun'
   * (menyimpan HP, atau duduk lalu menggeliat) — selama itu ia belum bisa
   * berjalan, persis orang yang baru bangun.
   */
  private santai: 'aktif' | 'hp' | 'tidur' | 'bangun' = 'aktif';
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

    this.shadow = scene.add.sprite(x, y, bayanganKaki(scene));
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
    if (this.santai === 'bangun') {
      body.setVelocity(0, 0);
      return;
    }
    if (len > 0 && this.santai !== 'aktif') {
      body.setVelocity(0, 0);
      this.mulaiBangun();
      return;
    }
    if (len > 0) {
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
    if (this.frozen || bergerak || !this.visible || this.santai === 'bangun') {
      this.diam = 0;
      return;
    }
    this.diam += delta;
    if (this.santai === 'aktif' && this.diam > SANTAI.hp && this.scene.anims.exists(`${this.kunci}_hp`)) {
      this.santai = 'hp';
      this.facing = 'down';
      // mengeluarkan HP dulu, baru menunduk memainkannya
      this.play(`${this.kunci}_ambil_hp`).chain(`${this.kunci}_hp`);
    } else if (this.santai === 'hp' && this.diam > SANTAI.hp + SANTAI.tidur && this.scene.anims.exists(`${this.kunci}_rebah`)) {
      this.santai = 'tidur';
      // menguap, duduk, lalu berbaring; dengkurnya mulai begitu berbaring
      this.play(`${this.kunci}_rebah`).chain(`${this.kunci}_tidur`);
      this.dengkur = this.scene.time.addEvent({
        delay: 1400,
        startAt: 0,
        loop: true,
        callback: () => this.anims.currentAnim?.key === `${this.kunci}_tidur` && this.zzz(),
      });
    }
  }

  /** Satu huruf z dari mulutnya, membesar sambil melayang naik. */
  private zzz() {
    // dari sisi kanan kepala yang berbaring di bantal, tidak menimpa wajahnya
    const z = this.scene.add
      .image(this.x + 8, this.y - 1, 'zz')
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

  /** Bangun pelan-pelan: animasi dulu, baru boleh berjalan. */
  private mulaiBangun() {
    const anim = this.santai === 'tidur' ? `${this.kunci}_bangun` : `${this.kunci}_simpan_hp`;
    this.dengkur?.remove();
    this.dengkur = undefined;
    if (!this.scene.anims.exists(anim)) {
      this.bangun();
      return;
    }
    this.santai = 'bangun';
    this.anims.chain();
    this.play(anim);
    this.once(`animationcomplete-${anim}`, () => {
      if (this.santai === 'bangun') this.bangun();
    });
  }

  /** Langsung bangun, tanpa animasi — dipakai saat berpindah tempat. */
  private bangun() {
    this.diam = 0;
    if (this.santai === 'aktif') return;
    this.santai = 'aktif';
    this.dengkur?.remove();
    this.dengkur = undefined;
    // kosongkan antrean dulu: stop() langsung memutar animasi berantai berikutnya
    this.anims.chain();
    this.anims.stop();
    this.setTexture(this.kunci, ROW.idle[this.facing] * 4);
    this.play(`${this.kunci}_idle_${this.facing}`, true);
  }

  setHidden(hidden: boolean) {
    this.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.tingkahSantai(delta);
    // Kedalaman ikut garis pijak, dihitung ulang tiap frame karena karakternya
    // bergerak. Bayangannya menempel setengah tingkat di bawah: selalu persis
    // di belakang karakter, tapi tetap ikut terurut terhadap dunia.
    const d = kedalaman(this.y + PLAYER.baseY);
    this.setDepth(d);
    this.shadow.setDepth(d - 0.5);
    this.shadow.setPosition(this.x, this.y + (PLAYER.baseY - 1) * this.scaleY);
    // tidur tanpa bayangan: badannya sudah rebah di atas alas tidurnya
    const berbaring = this.anims.currentAnim?.key === `${this.kunci}_tidur` || (this.santai === 'tidur' && Number(this.frame.name) >= 1);
    this.shadow.setScale(this.scaleX, this.scaleY);
    this.shadow.setAlpha(berbaring ? 0 : this.alpha * BAYANGAN_KAKI);
  }

  get direction() {
    return this.facing;
  }
}
