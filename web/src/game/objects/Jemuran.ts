import Phaser from 'phaser';
import { UTARA, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const WARNA = {
  k: '#3a2418', b: '#8a5a2a', B: '#5e3a1a', r: '#e0463a', w: '#fbf3e2',
  z: '#6b3f5a', Z: '#4a2a3e', u: '#f7d77a', i: '#f2b233', j: '#5a8fe0',
};

/** Kain di tali, kiri ke kanan: kaus, sarung, handuk, celana pendek. */
const KAIN: { key: string; gambar: string[] }[] = [
  { key: 'jemuran_kaus', gambar: [
      '.kkk...kkk.',
      'krrrkkkrrrk',
      'krrrrrrrrrk',
      '.kkrrrrrkk.',
      '..krrrrrk..',
      '..krrwrrk..',
      '..krrrrrk..',
      '..krrrrrk..',
      '..kkkkkkk..',
    ] },
  { key: 'jemuran_sarung', gambar: [
      'kkkkkkkkk',
      'kzZzzZzzk',
      'kZZZZZZZk',
      'kzZzzZzzk',
      'kzZzzZzzk',
      'kZZZZZZZk',
      'kzZzzZzzk',
      'kzZzzZzzk',
      'kZZZZZZZk',
      'kzZzzZzzk',
      'kkkkkkkkk',
    ] },
  { key: 'jemuran_handuk', gambar: [
      'kkkkkkk',
      'kuuuuuk',
      'kuuuuuk',
      'kiiiiik',
      'kuuuuuk',
      'kuuuuuk',
      'kiiiiik',
      'kuuuuuk',
      'kkkkkkk',
    ] },
  { key: 'jemuran_celana', gambar: [
      'kkkkkkkkk',
      'kjjjjjjjk',
      'kjjjjjjjk',
      'kjjjkjjjk',
      'kjjk.kjjk',
      'kjjk.kjjk',
      'kkkk.kkkk',
    ] },
];

/**
 * Jemuran di utara bangku: dua tiang kayu, seutas tali yang melendut, dan
 * empat helai kain yang berayun ditiup angin — masing-masing dengan irama
 * sendiri, jadi tidak pernah terlihat bergoyang serempak seperti satu gambar.
 * Tiangnya menghalangi langkah; kainnya tergantung setinggi kepala, jadi
 * orang lewat di bawahnya.
 */
export class Jemuran {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    const { kiri, kanan, kaki } = UTARA.jemuran;
    const tinggi = 22;
    spritesheetTeks(scene, 'tiang_jemuran', [['.k.', 'kbk', ...Array(tinggi - 4).fill('kbk'), 'kBk', 'kkk']], WARNA);
    for (const k of KAIN) spritesheetTeks(scene, k.key, [k.gambar], WARNA);

    const d = kedalaman(kaki);
    const puncak = kaki - tinggi + 2;
    for (const x of [kiri, kanan]) {
      scene.add.image(x, kaki, 'tiang_jemuran').setOrigin(0.5, 1).setDepth(d);
      if (blocked) {
        const r = scene.add.rectangle(x, kaki - 1, 4, 3);
        scene.physics.add.existing(r, true);
        blocked.add(r);
      }
    }

    // tali melendut; kainnya dijepit di titik-titik sepanjang lengkungnya
    const z = scene.cameras.main.zoom;
    const tali = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(kiri, puncak),
      new Phaser.Math.Vector2((kiri + kanan) / 2, puncak + 6),
      new Phaser.Math.Vector2(kanan, puncak)
    );
    const g = scene.add.graphics().setDepth(d + 0.1);
    g.lineStyle(2 / z, 0xe8e0d0, 1);
    tali.draw(g, 24);

    KAIN.forEach((k, i) => {
      const titik = tali.getPoint((i + 0.75) / (KAIN.length + 0.5));
      const helai = scene.add.image(titik.x, titik.y - 0.5, k.key).setOrigin(0.5, 0).setDepth(d + 0.2);
      const ayun = 3 + (i % 2) * 2;
      helai.setAngle(-ayun);
      scene.tweens.add({
        targets: helai,
        angle: ayun,
        duration: Phaser.Math.Between(900, 1400),
        delay: i * 230,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }
}
