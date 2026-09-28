import Phaser from 'phaser';
import { ABOUT, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const KRING = ['Kring kring!', 'Kring!', 'Kring kring kring!'];

/**
 * Sepeda ontel yang diparkir di pojok kiri rumah About: rangka merah dengan
 * sisi bawah yang lebih gelap, roda berjari-jari dengan velg dan ban, spakbor
 * krom, sadel kulit, boncengan, standar, dan keranjang rotan di depan setang.
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
          '......................ggggggg.',
          '........BBBB...ggAAAAgcccccccg',
          '.......bbbbbb..gg...AgccCcCccg',
          '..........A.........AgcCcCcCcg',
          '..........f.........fgccCcCccg',
          '.aaaaaaaa.fffffffffffgcCcCcCcg',
          '..AaakkkkfRRRRRRRRRRfgcccccccg',
          '.aaAkrrrkfaf.....aaffRggggggg.',
          'aakAr.s.fRkRf...aafRAks.rrkaa.',
          'akrsA.s.fsrkf...afRs.Ak..srka.',
          'kkr.s.sfR.rkRf..fRr.sAk.s.rkk.',
          'kr...ssf...rkf.fRr...sAk...rk.',
          'krssssfRfffffkkkkrssssAksssrk.',
          'kr...sRRRRRRRkhkkr...sss...rk.',
          'kkr.s.s.s.rkkAkkkkr.s.s.s.rkk.',
          '.krs..s..srkA..gggrs..s..srk..',
          '..krr.s.rrk.A.....krr.s.rrk...',
          '...kkrrrkk.A.......kkrrrkk....',
          '....kkkkk..A........kkkkk.....',
        ],
      ],
      {
        k: '#1b1920', r: '#8a8e9c', s: '#b8bcc8', h: '#e8eaf0', f: '#d0402f', R: '#8a2420', F: '#f07060',
        a: '#dfe2ea', A: '#8a8e9c', b: '#5a3018', B: '#8a5030', c: '#d9b070', C: '#a8803c', g: '#3a2418',
      }
    );
    const { x, kaki } = ABOUT.sepeda;
    const s = scene.add.image(x, kaki, 'sepeda').setOrigin(0.5, 1).setDepth(kedalaman(ABOUT.dasarRumah + 9));
    if (blocked) {
      // hanya bagian di atas rumput; roda belakangnya menjorok ke tepi jalan tanah tempat kurir lewat
      const r = scene.add.rectangle(x + 4, kaki - 2, 20, 4);
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
