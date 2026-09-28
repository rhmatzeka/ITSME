import Phaser from 'phaser';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Tinggi palang di atas tanah, px — setinggi itu ayamnya melompat naik. */
export const TINGGI_PALANG = 7;

/**
 * Tenggeran bambu di halaman rumah About: dua tiang beruas dan sebatang
 * bambu melintang. Siang hari kosong; begitu gelap ayam-ayam halaman
 * berjalan ke sini satu per satu, melompat ke palangnya, dan tidur berjajar
 * sampai pagi — seperti ayam kampung sungguhan yang tidak pernah tidur di
 * tanah.
 */
export class Tenggeran {
  /** Titik kaki tiap ayam di bawah palang, kiri ke kanan. */
  readonly tempat: { x: number; y: number }[];

  constructor(scene: Phaser.Scene, x: number, kaki: number, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'tenggeran',
      [
        [
          '.kkk..............................kkk.',
          '.kjk..............................kjk.',
          'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          'khhhhhJhhhhhhhhhhhJhhhhhhhhhhhhJhhhhhk',
          'kjjjjjJjjjjjjjjjjjJjjjjjjjjjjjjJjjjjjk',
          'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '.kjk..............................kjk.',
          '.kJk..............................kJk.',
          '.kjk..............................kjk.',
          '.kjk..............................kjk.',
          'kkkkk............................kkkkk',
        ],
      ],
      { J: '#9a7a3a', h: '#e0c27a', j: '#c8a860', k: '#2a2420' }
    );
    scene.add.image(x, kaki, 'tenggeran').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    this.tempat = [-11, 0, 11].map((dx) => ({ x: x + dx, y: kaki }));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 38, 4);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
  }
}
