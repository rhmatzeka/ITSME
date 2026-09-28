import Phaser from 'phaser';
import { LAPANGAN, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Tiang bendera merah putih di tepi utara lapangan CV: tiang besi berbola
 * emas di atas alas batu bertingkat, benderanya berkibar dalam tiga frame
 * gelombang yang bergeser. Membuat lapangan tanah itu terasa seperti alun-alun
 * desa.
 */
export class Bendera {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'tiang_bendera',
      [
        [
          '....kyk....',
          '...kYyyk...',
          '..kyyyyyk..',
          '...kyyyk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '....kpPk...',
          '..kkkpPkkk.',
          '.kssssssssk',
          '.kssssssssk',
          'kSSSSSSSSSS',
          'kSSSSSSSSSS',
          '.kkkkkkkkkk',
        ],
      ],
      { P: '#8a8e9c', S: '#7d776c', Y: '#fff2b0', k: '#2a2420', p: '#c4c8d4', s: '#aaa498', y: '#f2c94c' }
    );
    spritesheetTeks(
      scene,
      'bendera_merah_putih',
      [
        [
          '.k..........kk.',
          'kRk......kkkRRk',
          'kRkkkkkkkrrrRRk',
          'kRrrrrRRrrrrRRk',
          'kRrrrrRRrrrrRRk',
          'kWrrrrRRrrrrWWk',
          'kWrrrrRRrwwwWWk',
          'kWwwwwWWwwwwWWk',
          'kWwwwwWWwwwwWWk',
          '.kwwwwWWwwwwkk.',
          '.kwwwwWWwkkk...',
          '..kkkkkkk......',
        ],
        [
          '.k...kkkkkkkk..',
          'krkkkRrrrrRRrk.',
          'krrrRRrrrrRRrrk',
          'krrrRRrrrrRRrrk',
          'krrrRRrrrrRRrrk',
          'kwrrRWwwwwWWwrk',
          'kwwwWWwwwwWWwwk',
          'kwwwWWwwwwWWwwk',
          'kwwwWWwwwwWWwwk',
          '.kwwWkkkkkkkkwk',
          '..kkk........k.',
          '...............',
        ],
        [
          '.kkkkk.........',
          'krRRrrkkk......',
          'krRRrrrrRkkkkk.',
          'krRRrrrrRRrrrrk',
          'krRRrrrrRRrrrrk',
          'kwWWwwrrRRrrrrk',
          'kwWWwwwwWRrrrrk',
          'kwWWwwwwWWwwwwk',
          'kwWWwwwwWWwwwwk',
          '.kkkkkwwWWwwwwk',
          '......kkkWwwwwk',
          '.........kkkkk.',
        ],
      ],
      { R: '#b0302a', W: '#d6d2c6', k: '#2a2420', r: '#e0463a', w: '#f7f5ee' }
    );
    if (!scene.anims.exists('bendera_kibar')) {
      scene.anims.create({
        key: 'bendera_kibar',
        frames: scene.anims.generateFrameNumbers('bendera_merah_putih', { start: 0, end: 2 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    const { x, kaki } = LAPANGAN.bendera;
    const d = kedalaman(kaki);
    // tiang 11 px: pusatnya di tengah piksel supaya jatuh di grid
    scene.add.image(x + 0.5, kaki, 'tiang_bendera').setOrigin(0.5, 1).setDepth(d);
    scene.add
      .sprite(x + 2, kaki - 46, 'bendera_merah_putih', 0)
      .setOrigin(0)
      .setDepth(d + 0.1)
      .play({ key: 'bendera_kibar', startFrame: Phaser.Math.Between(0, 2) });
    if (blocked) {
      const r = scene.add.rectangle(x + 0.5, kaki - 2, 8, 3);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
  }
}
