import Phaser from 'phaser';
import { ABOUT, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const KRING = ['Kring kring!', 'Kring!', 'Kring kring kring!'];

/**
 * Sepeda ontel yang diparkir di pojok kiri rumah About: rangka biru tua,
 * sadel kulit, boncengan, dan keranjang rotan di depan setang.
 *
 * Keranjangnya menempel ke pojok dinding, jadi urutan gambarnya dipatok
 * sedikit di depan rumah (garis dasar rumah baris 16 = y 272), bukan dari
 * garis pijak rodanya sendiri — kalau tidak, keranjangnya tertutup dinding.
 *
 * Diklik, belnya berbunyi dan sepedanya bergoyang sedikit di standarnya.
 */
export class Sepeda {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'sepeda',
      [
        [
          '.......bbB...gfff.kkkkkk',
          '......bbbbb..g..fkcCcCck',
          '........f.......fkCcCcCk',
          '.ffffffffffffffffkcCcCck',
          '.fkkkkkf.f.....ffkCcCcCk',
          '.kr...fk.f....f.kf...rk.',
          'kr..s.frkf..ff.krf.s..rk',
          'k...sf..k.ff...k..fs...k',
          'k.ssfffffff....k.sshss.k',
          'k...s...k.fkg..k...s...k',
          'kr..s..rk.f....kr..s..rk',
          '.kr...rk........kr...rk.',
          '..kkkkk..........kkkkk..',
        ],
      ],
      { k: '#1b1920', r: '#6a6e7a', s: '#9a9eaa', h: '#c4c8d4', f: '#2a3d5a', g: '#3a2418', b: '#7a4a24', B: '#a8703a', c: '#d9b070', C: '#b08a4a' }
    );
    const { x, kaki } = ABOUT.sepeda;
    const s = scene.add.image(x, kaki, 'sepeda').setOrigin(0.5, 1).setDepth(kedalaman(ABOUT.dasarRumah + 9));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 20, 4);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    let kring = 0;
    s.setInteractive({ useHandCursor: true });
    s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.tweens.add({ targets: s, x: x + 1, duration: 70, yoyo: true, repeat: 2, onComplete: () => s.setX(x) });
      scene.game.events.emit('mapporto:ucap', { msg: KRING[kring++ % KRING.length], siapa: s, nama: 'Bicycle' });
    });
  }
}
