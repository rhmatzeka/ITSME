import Phaser from 'phaser';
import { DEPTH, TERAS_CV, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Teras rumah CV: keset anyaman di depan pintu, sepasang sandal jepit yang
 * ditinggal pemiliknya di sebelahnya, dan dua pot bunga di bawah jendela
 * sayap kiri dan kanan. Bunganya bergoyang pelan kena angin.
 *
 * Siluet orang yang lewat di balik jendelanya diatur Jendela.ts, bersama
 * jendela rumah lain.
 */
export class TerasCV {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'keset',
      [['kkkkkkkkkkkkkk', 'kmMmMmMmMmMmMk', 'kMmMmMmMmMmMmk', 'kkkkkkkkkkkkkk']],
      { k: '#5e3a1f', m: '#c9a060', M: '#a8803e' }
    );
    // sepasang sandal jepit tampak atas, yang kanan sedikit miring ke luar
    spritesheetTeks(
      scene,
      'sandal_sepasang',
      [['.kkk..kkk.', 'krwrkkrwrk', 'kwrwkkwrwk', 'krrrkkrrrk', 'krrrk.krrk', 'krrrk.krrk', '.kkk..kkk.']],
      { k: '#6a2020', r: '#e0463a', w: '#f7f5ee' }
    );
    // pot tanah liat berisi bunga; dua frame: tangkainya condong ke kanan
    const pot = (b: string) => [
      [`..${b}${b}.${b}.`, `.${b}Y${b}${b}Y${b}`, `..${b}g${b}${b}.`, '...gg..', '.kkkkk.', 'kttttTk', '.kttTk.', '.kttTk.', '..kkk..'],
      [`...${b}${b}.${b}`, `..${b}Y${b}${b}Y`, `...${b}g${b}${b}`, '...gg..', '.kkkkk.', 'kttttTk', '.kttTk.', '.kttTk.', '..kkk..'],
    ];
    spritesheetTeks(scene, 'pot_bunga_merah', pot('r'), { r: '#e0463a', Y: '#ffd34a', g: '#3f8a3a', k: '#5e2a1a', t: '#c8683a', T: '#9a4a2a' });
    spritesheetTeks(scene, 'pot_bunga_ungu', pot('u'), { u: '#9a6ad0', Y: '#fff2b0', g: '#3f8a3a', k: '#5e2a1a', t: '#c8683a', T: '#9a4a2a' });
    for (const k of ['pot_bunga_merah', 'pot_bunga_ungu']) {
      if (!scene.anims.exists(k)) {
        scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { frames: [0, 0, 1, 0] }), frameRate: 2, repeat: -1 });
      }
    }

    const { keset, sandal, pot: tempat } = TERAS_CV;
    scene.add.image(keset.x, keset.y, 'keset').setDepth(DEPTH.below + 0.5);
    scene.add.image(sandal.x, sandal.y, 'sandal_sepasang').setDepth(DEPTH.below + 0.6);
    tempat.forEach((p, i) => pasangPot(scene, p.x, p.kaki, i ? 'pot_bunga_ungu' : 'pot_bunga_merah', blocked));
  }
}

/** Satu pot bunga berdiri di tanah: urut-y seperti benda lain, dan menghalangi langkah. */
export function pasangPot(
  scene: Phaser.Scene,
  x: number,
  kaki: number,
  key = 'pot_bunga_merah',
  blocked?: Phaser.Physics.Arcade.StaticGroup
) {
  const s = scene.add.sprite(x, kaki, key, 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
  // tidak serempak: tiap pot mulai di frame acak
  s.play({ key, startFrame: Phaser.Math.Between(0, 3) });
  if (blocked) {
    const r = scene.add.rectangle(x, kaki - 2, 6, 3);
    scene.physics.add.existing(r, true);
    blocked.add(r);
  }
  return s;
}
