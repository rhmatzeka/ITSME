import Phaser from 'phaser';
import { UTARA, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Kain di tali, kiri ke kanan. Lebar = lebar gambarnya, untuk menata jaraknya di tali. */
const KAIN = [
  { key: 'jemuran_kaus', lebar: 12 },
  { key: 'jemuran_sarung', lebar: 10 },
  { key: 'jemuran_celana', lebar: 10 },
  { key: 'jemuran_handuk', lebar: 8 },
];

/**
 * Jemuran di utara bangku: dua tiang kayu berpalang, seutas tali yang
 * melendut, dan kain yang dijepit — kaus merah bersablon, sarung batik
 * bertumpal emas, celana jeans, handuk bergaris berumbai.
 *
 * Tiap helai berkibar dengan iramanya sendiri: berayun di jepitannya sambil
 * sesekali menggembung ditiup angin (lebarnya menyusut-mengembang), dan
 * bayangannya di rumput ikut bergeser. Versi pertama cuma kotak-kotak rata
 * yang berayun serempak — terbaca seperti papan, bukan kain.
 *
 * Tiangnya menghalangi langkah; kainnya tergantung setinggi kepala.
 */
export class Jemuran {
  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'tiang_jemuran',
      [
      [
        '.kkkkkkk.',
        'kbbccbbbk',
        'kbbbbbbbk',
        '.kkbbBkk.',
        '..kcbBk..',
        '..kcbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '..kbbBk..',
        '.kBBBBBk.',
        '..kkkkk..',
      ],
      ],
      { B: '#7a4a24', b: '#a8703a', c: '#c89060', k: '#3a2418' }
    );
    spritesheetTeks(
      scene,
      'jemuran_kaus',
      [
      [
        '..kckkkkck..',
        'kkrBrrrrBrk.',
        'rrrrrxxrrrrk',
        'rrrrrrrrrRrk',
        'rRrrrrrrrRRk',
        'kkrrrxxrrRk.',
        '.krrrxxrrR..',
        '.krrrrrrrR..',
        '.krrRrrRrR..',
        '.krrrrrrrR..',
        '..kkkkkkk...',
      ],
      ],
      { B: '#7a4a24', R: '#b0302a', c: '#c89060', k: '#3a2418', r: '#e0463a', x: '#fbf6e6' }
    );
    spritesheetTeks(
      scene,
      'jemuran_sarung',
      [
      [
        '.kckkkkck.',
        'kmBmmmmBmk',
        'kmmmMmmMMk',
        'kmmMmmMmMk',
        'kmMmmMmmMk',
        'kmmmMmmMMk',
        'kmmMmmMmMk',
        'kmMmmMmmMk',
        'kmmmMmmMMk',
        'kmUuUuUuMk',
        'kmuuuuuuMk',
        'kmmmMmmMMk',
        'kmmmmmmmmk',
        '.kkkkkkkk.',
      ],
      ],
      { B: '#7a4a24', M: '#5a1f36', U: '#d9a52a', c: '#c89060', k: '#3a2418', m: '#7a2e4a', u: '#f2c94c' }
    );
    spritesheetTeks(
      scene,
      'jemuran_celana',
      [
      [
        '.kckkkkck.',
        'knBnnnnBnk',
        'kjjjjjjjJk',
        'kjJJjjJJJk',
        'kjjjjjjjJk',
        'kjjjjjjjJk',
        'kjjjjjjjJk',
        'kjjsjjjsJk',
        'kjjjjjjjJk',
        'kjjjkjjjJk',
        '.kkk.kkkk.',
        '..........',
      ],
      ],
      { B: '#7a4a24', J: '#3565a8', c: '#c89060', j: '#4f86d6', k: '#3a2418', n: '#2a4a80', s: '#f4f1ea' }
    );
    spritesheetTeks(
      scene,
      'jemuran_handuk',
      [
      [
        '.kkckkk.',
        'kuuBuuuk',
        'kuuuuuUk',
        'kxxxxxUk',
        'kxxxxxUk',
        'kuuuuuUk',
        'kuuuuuUk',
        'kxxxxxUk',
        'kxxxxxUk',
        'kuuuuuUk',
        'kuuuuuUk',
        '.ukukuk.',
        '.k.k.k..',
      ],
      ],
      { B: '#7a4a24', U: '#d9a52a', c: '#c89060', k: '#3a2418', u: '#f2c94c', x: '#fbf6e6' }
    );

    const { kiri, kanan, kaki } = UTARA.jemuran;
    const d = kedalaman(kaki);
    // palang tiang di baris 1-2 lembar 9×26; tali diikat di ujung palang yang menghadap ke dalam
    const puncak = kaki - 26 + 2;
    for (const x of [kiri, kanan]) {
      scene.add.image(x, kaki, 'tiang_jemuran').setOrigin(0.5, 1).setDepth(d);
      if (blocked) {
        const r = scene.add.rectangle(x, kaki - 1, 4, 3);
        scene.physics.add.existing(r, true);
        blocked.add(r);
      }
    }

    const z = scene.cameras.main.zoom;
    const tali = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(kiri + 3, puncak),
      new Phaser.Math.Vector2((kiri + kanan) / 2, puncak + 7),
      new Phaser.Math.Vector2(kanan - 3, puncak)
    );
    const g = scene.add.graphics().setDepth(d + 0.1);
    g.lineStyle(2 / z, 0xf4ecd8, 1);
    tali.draw(g, 24);

    // tata kain berjajar rapat di sepanjang tali, sisa ruangnya dibagi rata
    const panjang = kanan - kiri - 6;
    const total = KAIN.reduce((n, k) => n + k.lebar, 0);
    const sela = (panjang - total) / (KAIN.length + 1);
    let jalan = sela;
    KAIN.forEach((k, i) => {
      const t = (jalan + k.lebar / 2) / panjang;
      jalan += k.lebar + sela;
      const titik = tali.getPoint(t);
      const helai = scene.add.image(titik.x, titik.y - 1, k.key).setOrigin(0.5, 0).setDepth(d + 0.2);
      const tinggi = helai.height;
      // bayangan di rumput, jauh di bawah kainnya
      const bayang = scene.add
        .rectangle(titik.x + 2, kaki - 2, k.lebar - 3, 2, 0x1b2416, 0.14)
        .setDepth(kedalaman(kaki - 10));
      const ayun = 4 + (i % 2) * 3;
      helai.setAngle(-ayun);
      scene.tweens.add({
        targets: helai,
        angle: ayun,
        duration: Phaser.Math.Between(1000, 1500),
        delay: i * 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => bayang.setX(titik.x + 2 + Math.sin(Phaser.Math.DegToRad(helai.angle)) * -tinggi * 0.5),
      });
      scene.tweens.add({
        targets: helai,
        scaleX: 0.86,
        duration: Phaser.Math.Between(700, 1100),
        delay: 400 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }
}
