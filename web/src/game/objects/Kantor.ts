import Phaser from 'phaser';
import { DEPTH, KANTOR, TILE, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Jendela menyala di atas tirai malam, sama seperti layar monitor di Teras. */
const KEDALAMAN_MALAM = DEPTH.above + 52;

/** Ganti-ganti layar monitor di jendela atas tengah, ms. */
const KEDIP = { min: 900, max: 2600 };

/**
 * Gedung "AI OFFICE" di kanan rumah Projects: pintu masuk ke Kantor AI
 * (kantor.rahmateka.my.id), tempat agent-agent Rahmat bekerja. Isinya
 * dibuka sebagai panel oleh Desa.astro, seperti rumah lain.
 *
 * Gedungnya tidak ada di map.tmx — digambar di sini dari gambar teks, jadi
 * tabrakan, petak jalan (Kisi), dan gambarnya di peta besar/minimap
 * dipasang sendiri: kotak tabrakan + petak terhalang di data map, dan
 * lukisanPeta() seperti meja terminal.
 */
export class Kantor {
  private gedung: Phaser.GameObjects.Image;
  private malam: Phaser.GameObjects.Sprite;
  private jedaKedip = KEDIP.max;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    spritesheetTeks(scene, 'kantor_ai', [GEDUNG], PALET);
    spritesheetTeks(scene, 'kantor_ai_malam', GEDUNG_MALAM, PALET_MALAM);
    const { x, kaki } = KANTOR;
    this.gedung = scene.add.image(x, kaki, 'kantor_ai').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    this.malam = scene.add
      .sprite(x, kaki, 'kantor_ai_malam', 0)
      .setOrigin(0.5, 1)
      .setDepth(KEDALAMAN_MALAM)
      .setAlpha(0);

    // Dinding sampai anak tangga menghalangi; atap dan antenanya tidak, jadi
    // yang lewat di belakang gedung tertutup olehnya, seperti rumah lain.
    const kiri = x - this.gedung.width / 2;
    const atas = kaki - this.gedung.height;
    const tembok = { x0: kiri + 1, x1: kiri + 47, y0: atas + 20, y1: atas + 61 };
    if (blocked) {
      const r = scene.add.rectangle(
        (tembok.x0 + tembok.x1) / 2,
        (tembok.y0 + tembok.y1) / 2,
        tembok.x1 - tembok.x0,
        tembok.y1 - tembok.y0
      );
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    this.tutupPetak(tembok);
    scene.events.on('update', this.detak, this);
  }

  /**
   * Petak yang sebagian besar tertutup tembok ditandai terhalang di data
   * map, supaya pencari jalan (Kisi: kurir, warga, klik-jalan) memutarinya.
   * Harus dipanggil sebelum Kisi dibuat dari `autoCollision`.
   */
  private tutupPetak(t: { x0: number; x1: number; y0: number; y1: number }) {
    const raw = this.scene.cache.tilemap.get('map')?.data as { width?: number; autoCollision?: number[] } | undefined;
    const g = raw?.autoCollision;
    const W = raw?.width;
    if (!g || !W) return;
    for (let ty = Math.floor(t.y0 / TILE); ty * TILE < t.y1; ty++) {
      for (let tx = Math.floor(t.x0 / TILE); tx * TILE < t.x1; tx++) {
        const tutup =
          (Math.min(t.x1, (tx + 1) * TILE) - Math.max(t.x0, tx * TILE)) *
          (Math.min(t.y1, (ty + 1) * TILE) - Math.max(t.y0, ty * TILE));
        if (tutup >= (TILE * TILE) / 2) g[ty * W + tx] = 1;
      }
    }
  }

  /** Gedungnya sebagai kanvas berkoordinat dunia, untuk peta desa. */
  lukisanPeta() {
    const o = this.gedung;
    const f = o.frame;
    const kanvas = document.createElement('canvas');
    kanvas.width = f.cutWidth;
    kanvas.height = f.cutHeight;
    const ctx = kanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
    return { kanvas, x: Math.round(o.x - o.displayOriginX), y: Math.round(o.y - o.displayOriginY) };
  }

  private detak(_t: number, delta: number) {
    const malam = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.5, 0, 1);
    this.malam.setAlpha(malam);
    if (!malam) return;
    // seseorang (atau agentnya) masih bekerja: layar di jendela atas menyala-padam
    this.jedaKedip -= delta;
    if (this.jedaKedip > 0) return;
    this.jedaKedip = Phaser.Math.Between(KEDIP.min, KEDIP.max);
    this.malam.setFrame(this.malam.frame.name === '0' ? 1 : 0);
  }
}

/* Gambar 48×64: gedung dua lantai, papan nama "AI OFFICE", pintu kaca ganda. */
const GEDUNG = [
  '.........r......................................',
  '........kkk.....................................',
  '.........k......................................',
  '.........k......................................',
  '........kkk.....................................',
  '.........k.....................kkkkk............',
  '.........k....................kAAAAak...........',
  '.........k.....kkkkkkkkkk.....kaaaaak...........',
  '.........k.....kMMMMMMMMk......kkkkk............',
  '.........k.....kmsmsmsmmk........k....kkkkkkk...',
  '...............kmsmsmsmmk.......kkk...kpPpPpk...',
  '...............kkkkkkkkkk.............kkkkkkk...',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
  '.kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGk.',
  '.kggggggggggggggggggggggggggggggggggggggggggggk.',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
  '.kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk.',
  '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWWWk.',
  '.kwwffffffffffffwffffffffffffwffffffffffffwWWWk.',
  '.kwwfBBBBBfBBBBfwfBBBBBfBBBBfwfBBBBBfBBBBfwWWWk.',
  '.kwwfbbbbbfbbbbfwfbbbbbfbbbbfwfbbbbbfbbbbfwWWWk.',
  '.kwwfbbbbbfbbbbfwfbbbbbfbbbbfwfbbbbbfbbbbfwWWWk.',
  '.kwwfbbbbbfbbbbfwfbbbbbfbbbbfwfbbbbbfbbbbfwWWWk.',
  '.kwwfbbbccfbbbbfwfbbbccfbbbbfwfbbbccfbbbbfwWWWk.',
  '.kwwfbbccbfbbbbfwfbbccbfbbbbfwfbbccbfbbbbfwWWWk.',
  '.kwwfbccbbfbbbbfwfbccbbfbbbbfwfbccbbfbbbbfwWWWk.',
  '.kwwffffffffffffwffffffffffffwffffffffffffwWWWk.',
  '.kwwKKKKKKKKKKKKwKKKKKKKKKKKKwKKKKKKKKKKKKwWWWk.',
  '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWWWk.',
  '.kKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk.',
  '.kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk.',
  '.kwwwwkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkwWWWk.',
  '.kwwwwknLnnLLLnnnnLLLnLLLnLLLnLLLnLLLnLLLkwWWWk.',
  '.kwwwwkLnLnnLnnnnnLnLnLnnnLnnnnLnnLnnnLnnkwWWWk.',
  '.kwwwwkLLLnnLnnnnnLnLnLLnnLLnnnLnnLnnnLLnkwWWWk.',
  '.kwwwwkLnLnnLnnnnnLnLnLnnnLnnnnLnnLnnnLnnkwWWWk.',
  '.kwwwwkLnLnLLLnnnnLLLnLnnnLnnnLLLnLLLnLLLkwWWWk.',
  '.kwwwwkkkkkkkkkkkGGGGGGGGGGGGGGkkkkkkkkkkkwWWWk.',
  '.kwwwwwwwwwwwwwwkkkkkkkkkkkkkkkkwwwwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwwwwwkkkkkkkkkkkkwwwwwwwwwwwwwWWWk.',
  '.kwwffffffffffwwwwkDDDDffDDDDkwwwwffffffffffWWk.',
  '.kwwfBBBBBBBBfwwwwkddddffddddkwwwwfBBBBBBBBfWWk.',
  '.kwwfbbbbbbbbfwwwwkddddffddddkwwwwfbbbbbbbbfWWk.',
  '.kwwfbbbbbbbbfwwwwkddddffddddkwwwwfbbbbbbbbfWWk.',
  '.kwwfbbbbbbbbfwwwwkddddffddddkwwwwfbbbbbbbbfWWk.',
  '.kwwfbbbbbbbbfwwwwkddddcfdddckwwwwfbbbbbbbbfWWk.',
  '.kwwfbbbbbbbbfwwwwkdddcffddcdkwwwwfbbbbbbbbfWWk.',
  '.kwwfbbbccbbbfwwwwkddcdffdcddkwwwwfbbbccbbbfWWk.',
  '.kwwfbbccbbbbfwwwwkdcdhffhdddkwwwwfbbccbbbbfWWk.',
  '.kwwfbccbbbbbfwwwwkddddffddddkwwwwfbccbbbbbfWWk.',
  '.kwwffffffffffwwwwkddddffddddkwwwwffffffffffWWk.',
  '.kwwKKKKKKKKKKvvvwkddddffddddkwvvvKKKKKKKKKKWWk.',
  '.kwwwwwwwwwwwVVVVVkddddffddddkVVVVVwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwvvvvvkddddffddddkvvvvvwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwkkkwkddddffddddkwkkkwwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwkokwkddddffddddkwkokwwwwwwwwwWWWk.',
  '.kwwwwwwwwwwwwkkkwkkkkkkkkkkkkwkkkwwwwwwwwwWWWk.',
  '.kKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk.',
  '.................kGGGGGGGGGGGGk.................',
  '................kggggggggggggggk................',
  '................kkkkkkkkkkkkkkkk................',
  '................................................',
];

const GEDUNG_MALAM = [
  [
    '.........r......................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '.....yyyyy.yyyy...yyyyy.yyyy...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...yyyyy.yyyy...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...yyyyy.yyyy...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...yyyyy.yyyy...yyyyy.yyyy.......',
    '.....yyyYY.yyyy...yyyYY.yyyy...yyyYY.yyyy.......',
    '.....yyYYy.yyyy...yyYYy.yyyy...yyYYy.yyyy.......',
    '.....yYYyy.yyyy...yYYyy.yyyy...yYYyy.yyyy.......',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '........L..LLL....LLL.LLL.LLL.LLL.LLL.LLL.......',
    '.......L.L..L.....L.L.L...L....L..L...L.........',
    '.......LLL..L.....L.L.LL..LL...L..L...LL........',
    '.......L.L..L.....L.L.L...L....L..L...L.........',
    '.......L.L.LLL....LLL.L...L...LLL.LLL.LLL.......',
    '................................................',
    '................................................',
    '................................................',
    '...................yyyy..yyyy...................',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyyY.yyyY......yyyyyyyy.....',
    '.....yyyyyyyy......yyyY..yyYy......yyyyyyyy.....',
    '.....yyyYYyyy......yyYy..yYyy......yyyYYyyy.....',
    '.....yyYYyyyy......yYy....yyy......yyYYyyyy.....',
    '.....yYYyyyyy......yyyy..yyyy......yYYyyyyy.....',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
  ],
  [
    '.........r......................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '.....yyyyy.yyyy...sssss.ssss...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...sssss.ssss...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...sssss.ssss...yyyyy.yyyy.......',
    '.....yyyyy.yyyy...sssss.ssss...yyyyy.yyyy.......',
    '.....yyyYY.yyyy...sssSS.ssss...yyyYY.yyyy.......',
    '.....yyYYy.yyyy...ssSSs.ssss...yyYYy.yyyy.......',
    '.....yYYyy.yyyy...sSSss.ssss...yYYyy.yyyy.......',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '........L..LLL....LLL.LLL.LLL.LLL.LLL.LLL.......',
    '.......L.L..L.....L.L.L...L....L..L...L.........',
    '.......LLL..L.....L.L.LL..LL...L..L...LL........',
    '.......L.L..L.....L.L.L...L....L..L...L.........',
    '.......L.L.LLL....LLL.L...L...LLL.LLL.LLL.......',
    '................................................',
    '................................................',
    '................................................',
    '...................yyyy..yyyy...................',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyy..yyyy......yyyyyyyy.....',
    '.....yyyyyyyy......yyyyY.yyyY......yyyyyyyy.....',
    '.....yyyyyyyy......yyyY..yyYy......yyyyyyyy.....',
    '.....yyyYYyyy......yyYy..yYyy......yyyYYyyy.....',
    '.....yyYYyyyy......yYy....yyy......yyYYyyyy.....',
    '.....yYYyyyyy......yyyy..yyyy......yYYyyyyy.....',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '...................yyyy..yyyy...................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
  ],
];

const PALET = {'k': '#1d1a24', 'K': '#5a5466', 'r': '#ff4a4a', 'a': '#d8dce6', 'A': '#ffffff', 'm': '#9aa0ae', 'M': '#c4c9d4', 's': '#5d6272', 'p': '#2f4f8a', 'P': '#6fa0e0', 'g': '#5f6680', 'G': '#8a92ad', 'w': '#ece6d6', 'W': '#cbc2ad', 'f': '#3a3f52', 'b': '#4f9fd0', 'B': '#2f6f9e', 'c': '#bfeaff', 'n': '#23262f', 'L': '#6ff0ff', 'd': '#5aa8d6', 'D': '#2f6f9e', 'h': '#f2c94c', 'v': '#4fae4a', 'V': '#2f7a35', 'o': '#a0603a'};

/** Kaca jadi lampu hangat, papan nama makin terang; s/S = layar monitor biru. */
const PALET_MALAM = { y: '#ffd88a', Y: '#fff3c8', L: '#9ffbff', r: '#ff6a6a', s: '#7fc8ff', S: '#d0f0ff' };
