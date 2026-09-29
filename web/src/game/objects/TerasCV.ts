import Phaser from 'phaser';
import { DEPTH, TERAS_CV, kedalaman } from '../config';
import { potongan, spritesheetTeks } from './piksel';

/**
 * Pot bunga dari paket Pixel 16 — paket yang sama dengan rumah dan jalan di
 * peta, jadi garis tepi dan bayangannya pasti serasi: [x, y, lebar, tinggi]
 * di lembar `desa_pixel16`.
 */
const POT = {
  pot_bunga_jingga: [212, 82, 9, 14],
  pot_bunga_biru: [228, 82, 9, 14],
} as const;

/** Berapa baris teratas pot (bunga dan daunnya) yang condong ditiup angin. */
const BUNGA = 6;

/**
 * Karpet kecil Sprout Lands (16×13, tiga warna hijau pupus) yang diwarnai
 * cokelat sabut supaya terbaca sebagai keset.
 */
const KESET = { dari: [0, 82, 16, 13] as [number, number, number, number], warna: { '#c0d470': '#b8844a', '#7a9b61': '#7a4f2a', '#d2e077': '#d9a766' } };

/**
 * Sepasang sandal jepit tampak atas, yang kanan sedikit tertinggal: telapak
 * membulat di jari, menyempit di tengah, tali V putih dari sela jempol.
 * Digambar di scratchpad art2/sandal.py, dibandingkan langsung dengan aset
 * karakter supaya ukuran dan garis tepinya serasi.
 */
const SANDAL = [
  '.kkk.......',
  'kbwbk..kkk.',
  'kwbwk.kbwbk',
  'wbbbw.kwbwk',
  '.kbk..wbbbw',
  'kbbbk..kbk.',
  'kBBBk.kbbbk',
  '.kkk..kBBBk',
  '.......kkk.',
];
export const WARNA_SANDAL = { k: '#2c3a52', b: '#5a86c0', B: '#3a5c8e', w: '#ffffff' };

/**
 * Teras rumah CV: keset sabut di depan pintu, sepasang sandal jepit yang
 * ditinggal pemiliknya di sebelahnya, dan dua pot bunga di bawah jendela
 * kanan. Bunganya bergoyang pelan kena angin.
 *
 * Siluet orang yang lewat di balik jendelanya diatur Jendela.ts, bersama
 * jendela rumah lain.
 */
export class TerasCV {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    siapkanPot(scene);
    potongan(scene, 'perabot_sprout', 'keset_sabut', KESET.dari, KESET.warna);
    spritesheetTeks(scene, 'sandal_sepasang', [SANDAL], WARNA_SANDAL);

    const { keset, sandal, pot: tempat } = TERAS_CV;
    scene.add.image(keset.x, keset.y, 'keset_sabut').setOrigin(0.5, 0).setDepth(DEPTH.below + 0.5);
    scene.add.image(sandal.x, sandal.y, 'sandal_sepasang').setDepth(DEPTH.below + 0.6);
    tempat.forEach((p, i) => pasangPot(scene, p.x, p.kaki, i ? 'pot_bunga_biru' : 'pot_bunga_jingga', blocked));
  }
}

/** Tekstur pot bunga: frame 0 tegak, frame 1 bunganya condong satu piksel. */
export function siapkanPot(scene: Phaser.Scene) {
  for (const [key, dari] of Object.entries(POT)) {
    potongan(scene, 'desa_pixel16', key, [...dari], {}, 2, (ctx, n) => {
      if (!n) return;
      const atas = ctx.getImageData(0, 0, dari[2], BUNGA);
      ctx.clearRect(0, 0, dari[2], BUNGA);
      ctx.putImageData(atas, 1, 0);
    });
    if (!scene.anims.exists(key)) {
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { frames: [0, 0, 1, 0] }), frameRate: 2, repeat: -1 });
    }
  }
}

/** Satu pot bunga berdiri di tanah: urut-y seperti benda lain, dan menghalangi langkah. */
export function pasangPot(
  scene: Phaser.Scene,
  x: number,
  kaki: number,
  key = 'pot_bunga_jingga',
  blocked?: Phaser.Physics.Arcade.StaticGroup
) {
  siapkanPot(scene);
  const s = scene.add.sprite(x, kaki, key, 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
  // tidak serempak: tiap pot mulai di frame acak
  if (scene.anims.exists(key)) s.play({ key, startFrame: Phaser.Math.Between(0, 3) });
  if (blocked) {
    const r = scene.add.rectangle(x, kaki - 2, 7, 3);
    scene.physics.add.existing(r, true);
    blocked.add(r);
  }
  return s;
}
