import Phaser from 'phaser';
import { COW, PLAYER, THUNDER } from '../config';

/**
 * Loading bar-nya jujur: lebarnya digerakkan oleh event `progress` milik
 * loader Phaser, bukan animasi palsu berdurasi tetap.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width: w, height: h } = this.scale;
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);

    // karakter idle di atas bar — persis referensi
    const hero = this.add.sprite(cx, cy - 70, 'player', 0).setScale(3);
    this.anims.create({
      key: 'preload_idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    hero.play('preload_idle');

    const BAR_W = Math.min(420, Math.round(w * 0.6));
    const BAR_H = 26;
    const x = cx - BAR_W / 2;
    const y = cy + 40;

    const frame = this.add.graphics();
    frame.lineStyle(3, 0x1b2416, 1).strokeRect(x - 3, y - 3, BAR_W + 6, BAR_H + 6);

    const fill = this.add.graphics();
    const label = this.add
      .text(cx, y + BAR_H + 36, '0%', { fontFamily: 'Silkscreen, monospace', fontSize: '34px', color: '#1b2416' })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      fill.clear().fillStyle(0x1b2416, 1).fillRect(x, y, Math.round(BAR_W * p), BAR_H);
      label.setText(`${Math.round(p * 100)}%`);
    });

    // ---- asset berat ----
    this.load.image('atlas', '/assets/atlas.png');
    this.load.tilemapTiledJSON('map', '/assets/map.json');

    this.load.spritesheet('player_shadow', '/assets/sprites/blonde_man_shadow.png', {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('woman', '/assets/sprites/blue_haired_woman.png', {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('woman_shadow', '/assets/sprites/blue_haired_woman_shadow.png', {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('thunderstrike', '/assets/sprites/thunderstrike.png', {
      frameWidth: THUNDER.strike.frameWidth,
      frameHeight: THUNDER.strike.frameHeight,
    });
    this.load.spritesheet('thunder_splash', '/assets/sprites/thunder_splash.png', {
      frameWidth: THUNDER.splash.frameWidth,
      frameHeight: THUNDER.splash.frameHeight,
    });

    // peta hasil render pipeline: minimap tajam + peta besar
    this.load.image('map_mini', '/assets/map_mini.png');
    this.load.image('map_mini_sm', '/assets/map_mini_sm.png');
    this.load.image('map_full', '/assets/map_full.png');

    // penghuni kandang
    for (const c of ['sapi_jantan', 'sapi_betina']) {
      this.load.spritesheet(c, `/assets/sprites/${c}.png`, {
        frameWidth: COW.frameWidth,
        frameHeight: COW.frameHeight,
      });
    }

    // joystick virtual
    this.load.image('joy_base', '/assets/sprites/joy_base.png');
    this.load.image('joy_knob', '/assets/sprites/joy_knob.png');

    // konten portfolio ikut dihitung di bar yang sama
    this.load.json('content', '/content.json');
  }

  create() {
    this.scene.start('Title');
  }
}
