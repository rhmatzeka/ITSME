import Phaser from 'phaser';
import { DEPTH, THUNDER, TRANSITION } from '../config';

/**
 * Urutan spawn petir — dipakai saat mulai main dan tiap pindah titik singgah.
 *
 * Dua detail yang menentukan rasanya:
 *  1. Kilat putih menutupi momen kamera berpindah, jadi karakter tidak pernah
 *     terlihat "teleport" — dia muncul DARI kilat.
 *  2. Karakter masuk dengan scaleY 0→1, bukan fade. Fade terasa seperti hantu;
 *     scale terasa seperti dihantam ke tanah.
 */
export class ThunderFx {
  private count = 0;

  constructor(private scene: Phaser.Scene) {}

  static registerAnimations(scene: Phaser.Scene) {
    if (!scene.anims.exists('thunder_strike')) {
      scene.anims.create({
        key: 'thunder_strike',
        frames: scene.anims.generateFrameNumbers('thunderstrike', { start: 0, end: THUNDER.strike.frames - 1 }),
        frameRate: 34,
      });
    }
    if (!scene.anims.exists('thunder_splash')) {
      scene.anims.create({
        key: 'thunder_splash',
        frames: scene.anims.generateFrameNumbers('thunder_splash', { start: 0, end: THUNDER.splash.frames - 1 }),
        frameRate: 30,
      });
    }
  }

  /** Mode cepat: dipilih user, atau otomatis setelah beberapa kali transisi. */
  private get timing() {
    const reduced = this.scene.game.device.os.desktop
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    const forced = localStorage.getItem('mapporto:fastFx') === '1';
    return reduced || forced || this.count >= TRANSITION.autoFastAfter ? TRANSITION.fast : TRANSITION.full;
  }

  /**
   * @param onArrive dipanggil tepat saat layar tertutup kilat — di sinilah
   *                 kamera dipindah dan karakter ditaruh di posisi baru.
   */
  play(worldX: number, worldY: number, onArrive: () => void, onDone?: () => void) {
    const t = this.timing;
    this.count++;

    const cam = this.scene.cameras.main;
    const strike = this.scene.add
      .sprite(worldX, worldY - THUNDER.strike.frameHeight / 2 + 8, 'thunderstrike')
      .setDepth(DEPTH.fx)
      .setVisible(false);

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: t.fadeOut,
      onComplete: () => {
        onArrive();
        strike.setVisible(true).play('thunder_strike');

        this.scene.time.delayedCall(t.strike, () => {
          // kilat layar penuh — menutupi perpindahan kamera
          cam.flash(t.flash + t.land * 0.6, 255, 255, 245, true);
          cam.shake(t.land * 0.5, 0.006);

          const splash = this.scene.add
            .sprite(worldX, worldY, 'thunder_splash')
            .setDepth(DEPTH.fx)
            .play('thunder_splash');
          splash.once('animationcomplete', () => splash.destroy());

          this.scene.time.delayedCall(t.land, () => {
            strike.destroy();
            /*
             * Satu tarikan napas sebelum layar diserahkan ke panel.
             *
             * `t.ui` sudah ada di config sejak awal dan ikut dihitung di nilai
             * kembalian di bawah, tapi tidak pernah benar-benar ditunggu:
             * onDone dipanggil di frame yang sama saat karakter selesai
             * mendarat, jadi modal menutupi layar tepat pada akhir animasi.
             * Akibatnya petirnya terasa tidak pernah terjadi — yang terlihat
             * cuma menu yang tiba-tiba terbuka.
             */
            this.scene.time.delayedCall(t.ui, () => onDone?.());
          });
        });
      },
    });

    return t.fadeOut + t.strike + t.land + t.ui;
  }

  /** Karakter "dihantam" ke tanah: pipih lalu menegak. */
  landPlayer(target: Phaser.GameObjects.Sprite) {
    const t = this.timing;
    target.setScale(1, 0);
    this.scene.tweens.add({
      targets: target,
      scaleY: 1,
      duration: t.land,
      ease: 'Back.easeOut',
    });
  }

  get transitions() {
    return this.count;
  }
}
