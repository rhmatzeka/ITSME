import Phaser from 'phaser';
import { krok as bunyiKrok } from '../bunyi';
import { kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { spritesheetTeks } from './piksel';

/**
 * Tempat kodok duduk di malam hari, px dunia: rumput tepi utara sungai
 * (kering sampai y 372) dan tepi selatannya. Jembatan (x 112-143 dan
 * 368-399) dan tempat bebek tidur (x 278-306) dilewati.
 */
const TEMPAT = [
  { x: 62, y: 370 },
  { x: 186, y: 370 },
  { x: 336, y: 371 },
  { x: 442, y: 370 },
  { x: 506, y: 371 },
  { x: 586, y: 370 },
  { x: 60, y: 416 },
  { x: 182, y: 416 },
  { x: 420, y: 416 },
  { x: 575, y: 416 },
];

const F = { duduk: 0, krok: 1, lompat: 2 } as const;

interface Seekor {
  s: Phaser.GameObjects.Sprite;
  x0: number;
  nada: number;
  berikut: number;
  sibuk: boolean;
}

/**
 * Kodok di tepi sungai, malam hari — dan saat gerimis, siang sekalipun. Mereka bersahutan: seekor
 * ber-"krok-krok" (kantung suaranya menggembung putih di tiap krok), lalu
 * tetangganya menyahut sepersekian detik kemudian, kadang disusul yang lain
 * lagi — paduan yang merambat di sepanjang sungai. Sesekali seekor melompat
 * pendek menyusuri tepi.
 */
export class Kodok {
  private kawanan: Seekor[] = [];

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    // katak sawah 13×11 dilihat dari depan-atas: mata kuning besar yang menonjol
    // di atas kepala, mulut lebar, perut pucat, punggung berbintik, kaki depan
    // berjari. Frame 1: kantung suaranya menggembung putih; frame 2: melompat.
    spritesheetTeks(
      scene,
      'kodok',
      [
        [
          '..kkk...kkk..',
          '.kyWyk.kyWyk.',
          '.kpyyk.kyypk.',
          'kLLkkLLLkkLLk',
          'kLgLLgggLLgLk',
          'kgmmmmmmmmmgk',
          'kGgggbbbgggGk',
          'kGgsgbbbgsgGk',
          '.kGgggggggGk.',
          'kgkGGkkkGGkgk',
          'kkgk.....kgkk',
        ],
        [
          '..kkk...kkk..',
          '.kyWyk.kyWyk.',
          '.kpyyk.kyypk.',
          'kLLkkLLLkkLLk',
          'kLgLLgggLLgLk',
          'kgmmmmmmmmmgk',
          'kGgkwwwwwkgGk',
          'kGkwwwwwwwkGk',
          '.kGkwwwwwkGk.',
          'kgkGGkkkGGkgk',
          'kkgk.....kgkk',
        ],
        [
          '..kkk...kkk..',
          '.kyWyk.kyWyk.',
          '.kpyyk.kyypk.',
          'kLLkkLLLkkLLk',
          'kLgLLgggLLgLk',
          'kgmmmmmmmmmgk',
          '.kgggbbbgggk.',
          '..kgsbbbsgk..',
          '.kkGgggggGkk.',
          'kgGk.....kGgk',
          'kk.........kk',
        ],
      ],
      { k: '#1b2612', L: '#8ed65c', g: '#5aa03a', G: '#3e7428', m: '#24401a', b: '#d8e8a0', s: '#2f5a20', y: '#f2d040', W: '#ffffff', p: '#101010', w: '#eef6d8' }
    );
    for (const t of TEMPAT) {
      const s = scene.add
        .sprite(t.x, t.y, 'kodok', F.duduk)
        .setOrigin(0.5, 1)
        .setDepth(kedalaman(t.y))
        .setFlipX(Math.random() < 0.5)
        .setVisible(false);
      this.kawanan.push({
        s,
        x0: t.x,
        nada: Phaser.Math.FloatBetween(0.8, 1.25),
        berikut: scene.time.now + Phaser.Math.Between(2000, 12000),
        sibuk: false,
      });
    }
    scene.events.on('update', this.detak, this);
  }

  /** Satu kodok ber-krok; tetangganya mungkin menyahut. */
  private krok(k: Seekor, sahut: number) {
    if (k.sibuk) return;
    k.sibuk = true;
    const kali = Phaser.Math.Between(1, 3);
    bunyiKrok(k.s.x, k.s.y, k.nada, kali);
    for (let i = 0; i < kali; i++) {
      this.scene.time.delayedCall(i * 270, () => k.s.setFrame(F.krok));
      this.scene.time.delayedCall(i * 270 + 170, () => k.s.setFrame(F.duduk));
    }
    this.scene.time.delayedCall(kali * 270 + 200, () => (k.sibuk = false));
    if (sahut > 0 && Math.random() < 0.65) {
      const dekat = this.kawanan
        .filter((l) => l !== k && !l.sibuk && Math.abs(l.s.x - k.s.x) < 160)
        .sort(() => Math.random() - 0.5)[0];
      if (dekat) this.scene.time.delayedCall(kali * 270 + Phaser.Math.Between(250, 800), () => this.krok(dekat, sahut - 1));
    }
  }

  private lompat(k: Seekor) {
    k.sibuk = true;
    const ke = Phaser.Math.Clamp(k.s.x + Phaser.Math.Between(-8, 8), k.x0 - 10, k.x0 + 10);
    const y = k.s.y;
    k.s.setFlipX(ke > k.s.x).setFrame(F.lompat);
    const dari = k.s.x;
    const p = { t: 0 };
    this.scene.tweens.add({
      targets: p,
      t: 1,
      duration: 320,
      onUpdate: () => k.s.setPosition(dari + (ke - dari) * p.t, y - Math.sin(p.t * Math.PI) * 6),
      onComplete: () => {
        k.s.setPosition(ke, y).setFrame(F.duduk);
        k.sibuk = false;
      },
    });
  }

  private detak(t: number) {
    // keluar setelah gelap — atau saat gerimis, siang bolong sekalipun
    const hadir = Math.max(Phaser.Math.Clamp((this.gelap() - 0.55) / 0.25, 0, 1), Phaser.Math.Clamp(cuaca.hujan * 2, 0, 1));
    // hujan membuat paduannya jauh lebih riuh
    const riuh = 1 + cuaca.hujan * 2.5;
    for (const k of this.kawanan) {
      k.s.setVisible(hadir > 0).setAlpha(hadir);
      if (hadir < 1 || k.sibuk || t < k.berikut) continue;
      k.berikut = t + Phaser.Math.Between(6000, 16000) / riuh;
      if (Math.random() < 0.25) this.lompat(k);
      else this.krok(k, 2);
    }
  }
}
