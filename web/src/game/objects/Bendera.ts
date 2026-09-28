import Phaser from 'phaser';
import { LAPANGAN, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Tiang bendera merah putih di tepi utara lapangan CV: tiang besi berbola
 * emas dengan tali di sisinya, di atas alas bercat merah-putih. Benderanya
 * berkibar dalam empat frame: gelombangnya merambat menjauhi tiang, sisi yang
 * miring digelapkan dan yang menghadap cahaya diterangkan, dan pangkalnya
 * yang terikat di tiang tidak ikut bergelombang. Membuat lapangan tanah itu terasa seperti alun-alun
 * desa.
 */
export class Bendera {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'tiang_bendera',
      [
        [
          '....kyyyyk....',
          '....kyYyyk....',
          '....kyyyyk....',
          '....kyyyyk....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkW....',
          '.....kqPkkk...',
          '.....kqPkk....',
          '.....kqPk.....',
          '.....kqPk.....',
          '.....kqPk.....',
          '...kkkqPkkk...',
          '..krrrrrrrrk..',
          '..krrrrrrrrk..',
          '.kkwwwwwwwwkk.',
          'kssssssssssssk',
          'ksSSSSSSSSSSsk',
          '.kkkkkkkkkkkk.',
        ],
      ],
      { P: '#8a8e9c', S: '#8f897e', W: '#cfcabd', Y: '#fff2b0', k: '#2a2420', q: '#f4f6fa', r: '#e0463a', s: '#c9c3b6', w: '#f7f5ee', y: '#f2c94c' }
    );
    spritesheetTeks(
      scene,
      'bendera_merah_putih',
      [
        [
          '...........kkkuRkk....',
          'kkk......kkuruuRRRkk..',
          'rrRkkkkkkuuuruuRRRRRk.',
          'rrRRrrrruuuuruuRRRRRrk',
          'rrRRrrrruuuuruuRRRRRrk',
          'rrRRrrrruuuuruwWRRRRrk',
          'rrRRrrrruuuwwwwWWWRRrk',
          'wwWRrrrruwwwwwwWWWWWrk',
          'wwWWwwwwwwwwwwwWWWWWwk',
          'wwWWwwwwwwwwwwwWWWWWwk',
          'wwWWwwwwwwwwwwkkWWWWwk',
          'wwWWwwwwwwwkkk..kkWWwk',
          'kkkWwwwwwkk.......kkwk',
          '...kkkkkk...........k.',
        ],
        [
          '................kkuRk.',
          'kkkkkk........kkuuuRrk',
          'rrrrrRkkk..kkkuuuuuRrk',
          'rrrrrRRrRkkuruuuuuuRrk',
          'rrrrrRRrRRuuruuuuuuRrk',
          'rrrrrRRrRRuuruuuuuwWrk',
          'rrrrrRRrRRuuruuuwwwWwk',
          'wwwwwWRrRRuuruwwwwwWwk',
          'wwwwwWWwWRuwwwwwwwwWwk',
          'wwwwwWWwWWwwwwwwwwwWwk',
          'wwwwwWWwWWwwwwwwwwkkwk',
          'wwwwwWWwWWwwwwwwkk..k.',
          'kkkkkkWwWWwwwwkk......',
          '......kkkWwkkk........',
        ],
        [
          '...kkkkkk...........k.',
          'kkkurrrrRkk.......kkrk',
          'rruurrrrRRRkkk..kkuurk',
          'rruurrrrRRRRrRkkuuuurk',
          'rruurrrrRRRRrRRuuuuurk',
          'rruurrrrRRRRrRRuuuuurk',
          'rruwwwwwWRRRrRRuuuuuwk',
          'wwwwwwwwWWWRrRRuuuwwwk',
          'wwwwwwwwWWWWwWRuwwwwwk',
          'wwwwwwwwWWWWwWWwwwwwwk',
          'wwwwwwwwWWWWwWWwwwwwwk',
          'wwwkkkkkkWWWwWWwwwwwk.',
          'kkk......kkWwWWwwwkk..',
          '...........kkkWwkk....',
        ],
        [
          '......kkkuRkkk........',
          'kkkkkkuruuRRrRkk......',
          'rrrrruuruuRRrRRRkk..k.',
          'rrrrruuruuRRrRRRRRkkrk',
          'rrrrruuruuRRrRRRRRRurk',
          'rrrrruuruwWRrRRRRRRurk',
          'rrrrruwwwwWWwWRRRRRurk',
          'wwwwwwwwwwWWwWWWRRRurk',
          'wwwwwwwwwwWWwWWWWWRuwk',
          'wwwwwwwwwwWWwWWWWWWwwk',
          'wwwwwwwwwkkWwWWWWWWwwk',
          'wwwwwwkkk..kkkWWWWWwwk',
          'kkkkkk........kkWWWwwk',
          '................kkWwk.',
        ],
      ],
      { R: '#a82a22', W: '#cfcabd', k: '#2a2420', r: '#e0463a', u: '#ff7a66', w: '#f7f5ee' }
    );
    if (!scene.anims.exists('bendera_kibar')) {
      scene.anims.create({
        key: 'bendera_kibar',
        frames: scene.anims.generateFrameNumbers('bendera_merah_putih', { start: 0, end: 3 }),
        frameRate: 7,
        repeat: -1,
      });
    }
    const { x, kaki } = LAPANGAN.bendera;
    const d = kedalaman(kaki);
    scene.add.image(x, kaki, 'tiang_bendera').setOrigin(0.5, 1).setDepth(d);
    // pangkal bendera menempel di kanan tiang, sedikit di bawah bola emasnya
    scene.add
      .sprite(x + 1, kaki - 36, 'bendera_merah_putih', 0)
      .setOrigin(0)
      .setDepth(d + 0.1)
      .play({ key: 'bendera_kibar', startFrame: Phaser.Math.Between(0, 3) });
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 10, 3);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
  }
}
