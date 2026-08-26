import Phaser from 'phaser';
import { PLAYER } from '../config';

/**
 * Boot cuma memuat yang dibutuhkan LAYAR LOADING itu sendiri:
 * satu spritesheet karakter (7 KB) + font. Tanpa ini, bar-nya sempat
 * tampil dengan font fallback lalu melompat begitu font asli masuk.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.spritesheet('player', '/assets/sprites/blonde_man.png', {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
  }

  async create() {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.load('16px Silkscreen');
    } catch {
      // font gagal dimuat bukan alasan untuk menggagalkan game
    }
    this.scene.start('Preload');
  }
}
