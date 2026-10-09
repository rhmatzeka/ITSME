import Phaser from 'phaser';
import { DEPTH, KANTOR, TILE, kedalaman } from '../config';
import { geserPintu } from '../bunyi';
import { spritesheetTeks } from './piksel';

/** Jendela menyala di atas tirai malam, sama seperti layar monitor di Teras. */
const KEDALAMAN_MALAM = DEPTH.above + 52;

/** Layar monitor di jendela kiri berkedip, ms. */
const KEDIP = { min: 900, max: 2600 };

/** Jarak kaki pemain ke depan pintu yang membuka pintu kaca, dan yang menutupnya, px. */
const BUKA = 38;
const TUTUP = 46;
/** Lama satu langkah geser, ms (4 langkah: tiap daun masuk 1 px ke dinding). */
const LANGKAH_GESER = 45;

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
  /** Daun pintu kaca siang & malam (frame 0 tertutup … 4 terbuka penuh). */
  private pintu: Phaser.GameObjects.Sprite;
  private pintuMalam: Phaser.GameObjects.Sprite;
  /** Sorot hangat yang jatuh dari pintu terbuka di malam hari (tekstur dari Pintu.ts). */
  private cahaya?: Phaser.GameObjects.Image;
  private terbuka = false;
  private geser?: Phaser.Tweens.Tween;
  /** Titik berdiri di depan pintu: sama dengan `enterAt` POI kantor_ai. */
  private readonly depan: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Phaser.GameObjects.Components.Transform | undefined,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    spritesheetTeks(scene, 'kantor_ai', [GEDUNG], PALET);
    // pintunya punya sprite malam sendiri (bisa terbuka), jadi dikosongkan di sini
    spritesheetTeks(scene, 'kantor_ai_malam', GEDUNG_MALAM.map(tanpaPintu), PALET_MALAM);
    spritesheetTeks(scene, 'kantor_ai_pintu', bingkaiPintu(), PALET_PINTU);
    spritesheetTeks(scene, 'kantor_ai_pintu_malam', bingkaiPintu(), PALET_PINTU_MALAM);
    const { x, kaki } = KANTOR;
    this.gedung = scene.add.image(x, kaki, 'kantor_ai').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    this.malam = scene.add
      .sprite(x, kaki, 'kantor_ai_malam', 0)
      .setOrigin(0.5, 1)
      .setDepth(KEDALAMAN_MALAM)
      .setAlpha(0);
    const px = x - this.gedung.width / 2 + PINTU.x;
    const py = kaki - this.gedung.height + PINTU.y;
    this.pintu = scene.add.sprite(px, py, 'kantor_ai_pintu', 0).setOrigin(0).setDepth(kedalaman(kaki) + 0.1);
    this.pintuMalam = scene.add
      .sprite(px, py, 'kantor_ai_pintu_malam', 0)
      .setOrigin(0)
      .setDepth(KEDALAMAN_MALAM + 0.1)
      .setAlpha(0);
    this.depan = { x, y: kaki + 12 };

    // Dinding sampai anak tangga menghalangi; atapnya tidak, jadi yang lewat
    // di belakang gedung tertutup olehnya, seperti rumah lain.
    const kiri = x - this.gedung.width / 2;
    const atas = kaki - this.gedung.height;
    const tembok = { x0: kiri + 2, x1: kiri + 44, y0: atas + 28, y1: atas + 57 };
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

  /** Titik gantung label "AI OFFICE": di ujung antena, di atas atapnya. */
  get puncak() {
    return { x: this.gedung.x, y: this.gedung.y - this.gedung.height - 2 };
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

  /**
   * Pintu kaca otomatis: kedua daunnya bergeser masuk ke dinding saat
   * pemain mendekat, memperlihatkan lobi di dalam, lalu menutup lagi.
   */
  private gerak(buka: boolean) {
    this.terbuka = buka;
    geserPintu(this.depan.x, this.depan.y - 14, buka);
    this.geser?.stop();
    const langkah = { f: Number(this.pintu.frame.name) };
    const ke = buka ? 4 : 0;
    this.geser = this.scene.tweens.add({
      targets: langkah,
      f: ke,
      duration: Math.abs(ke - langkah.f) * LANGKAH_GESER,
      onUpdate: () => {
        const f = Math.round(langkah.f);
        this.pintu.setFrame(f);
        this.pintuMalam.setFrame(f);
      },
    });
  }

  private detak(_t: number, delta: number) {
    const p = this.pemain();
    const jarak = p ? Phaser.Math.Distance.Between(p.x, p.y, this.depan.x, this.depan.y) : Infinity;
    if (!this.terbuka && jarak < BUKA) this.gerak(true);
    else if (this.terbuka && jarak > TUTUP) this.gerak(false);

    const malam = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.5, 0, 1);
    this.malam.setAlpha(malam);
    this.pintuMalam.setAlpha(malam);
    if (!this.cahaya && this.scene.textures.exists('pintu_cahaya')) {
      this.cahaya = this.scene.add
        .image(this.depan.x, this.pintu.y + PINTU.h - 2, 'pintu_cahaya')
        .setScale(1 / 4)
        .setOrigin(0.5, 0.25)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.above + 60)
        .setAlpha(0);
    }
    this.cahaya?.setAlpha(malam * (Number(this.pintu.frame.name) / 4));
    if (!malam) return;
    // seseorang (atau agentnya) masih bekerja: layar di jendela kiri berkedip
    this.jedaKedip -= delta;
    if (this.jedaKedip > 0) return;
    this.jedaKedip = Phaser.Math.Between(KEDIP.min, KEDIP.max);
    this.malam.setFrame(this.malam.frame.name === '0' ? 1 : 0);
  }
}

/* Gambar 46×60, gaya rumah desa: atap seng tampak atas (AC, antena, panel surya),
 * papan nama di lis atap, dinding pendek dengan jendela berbingkai kayu dan pintu kaca. */
const GEDUNG = [
  '...................z..........................',
  '...................k..........................',
  '...................k..........................',
  '.................kkkkk........................',
  '...................k..........................',
  '...................k..........................',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kRRRRRRRRRRRRRRRRRRkRRRRRRRRRRRRRRRRRRRRRRRRRk',
  'kRrrrqRrrrqRrrrqRrrkqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrkqRrrkkkkkkkkkkkkkkkkkkkrrk',
  'kRrrkkkkkkkkkkkkRrrkqRrrkplppPlppPlppPlpppkrrk',
  'kRrrkMMMMMMMMMMkRrrkqRrrkppppPpppPpppPppppkrrk',
  'kRrrkmmssssssmmkRrkkkRrrkppppPpppPpppPppppkrrk',
  'kRrrkmmsSmSSsmmkRrkkkRrrkPPPPPPPPPPPPPPPPPkrrk',
  'kRrrkmmsSssSsmmkRrrrqRrrkpplpPplpPplpPplppkrrk',
  'kRrrkmmsSSmSsmmkRrrrqRrrkppppPpppPpppPppppkrrk',
  'kRrrkmmssssssmmkRrrrqRrrkppppPpppPpppPppppkrrk',
  'kRrrkmmmmmmmmmmkRrrrqRrrkppppPpppPpppPppppkrrk',
  'kRrrkkkkkkkkkkkkRrrrqRrrkkkkkkkkkkkkkkkkkkkrrk',
  'kRrrrqqqqqqqqqqqRrrrqRrrrqqqqqqqqqqqqqqqqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrqRrrrk',
  'kQQQkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkQQQk',
  'kkkWkGnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnGkWkkk',
  '..kWknnLnnLLLnnnLLLnLLLnLLLnLLLnLLLnLLLnnkWk..',
  '..kvknLnLnnLnnnnLnLnLnnnLnnnnLnnLnnnLnnnnkWk..',
  '..kvknLLLnnLnnnnLnLnLLnnLLnnnLnnLnnnLLnnnkWk..',
  '..kvknLnLnnLnnnnLnLnLnnnLnnnnLnnLnnnLnnnnkWk..',
  '..kvkNLNLNLLLNNNLLLNLNNNLNNNLLLNLLLNLLLNNkWk..',
  '..kvkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkWk..',
  '..kvwwwwwwwwwwkaaaaaaaaaaaaaaaakwwwwwwwwWWWk..',
  '..kvwwwwwwwwwwkaAaAaAaAaAaAaAaAkwwwwwwwwWWWk..',
  '..kvwwwwwwwwwwwwwkkkkkkkkkkkkwwwwwwwwwwwWWWk..',
  '..kvwkkkkkkkkkkwwkDDDDkkDDDDkwwkkkkkkkkkkWWk..',
  '..kvwkffffffffkkwkddddkkddddkwkkffffffffkWWk..',
  '..kvwkfCCfCCCfkywkddddkkddddkwykfCCfCCCfkWWk..',
  '..kvwkfcchcchfkwwkddddkkddddkwwkfcchcchfkWWk..',
  '..kvwkfchfchcfkwwkddddkkddddkwwkfchfchcfkWWk..',
  '..kvwkffffffffkwwkdddhkkdddhkwwkffffffffkWWk..',
  '..kvwkfccfcccfkwwkddhdkkddhdkwwkfccfcccfkWWk..',
  '..kvwkfcchcchfkwwkdhddkkdhddkwwkfcchcchfkWWk..',
  '..kvwkfchfchcfkwwkddddkkddddkwwkfchfchcfkWWk..',
  '..kvwkffffffffkwwkdddykkydddkwwkffffffffkWWk..',
  '..kvwFFFFFFFFFFwwkddddkkddddkwwFFFFFFFFFFWWk..',
  '..kvkkkkkkkkkkgkwkddddkkddddkwkgkkkkkkkkkkWk..',
  '..kvwwwwwwwwwgegwkddddkkddddkwgegwwwwwwwWWWk..',
  '..kvwwwwwwwwgeeegkddddkkddddkgeeegwwwwwwWWWk..',
  '..kvwwwwwwwwkkkkkkddddkkddddkkkkkkwwwwwwWWWk..',
  '..kvwwwwwwwwkOookkddddkkddddkkOookwwwwwwWWWk..',
  '..bbbbbbbbbbkoookkDDDDDDDDDDkkoookbbbbbbbbbb..',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '................kbbbbbbbbbbbbk................',
  '...............kBBBBBBBBBBBBBBk...............',
  '...............kkkkkkkkkkkkkkkk...............',
  '..............................................',
];

/**
 * Lapis malam: kaca jadi cahaya hangat, papan nama dan lampu dinding menyala,
 * dan di jendela kiri seseorang masih bekerja di depan monitor (x = siluet,
 * s/S = layar yang berkedip di antara dua frame).
 */
const GEDUNG_MALAM = [
  [
    '...................z..........................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '.......L..LLL...LLL.LLL.LLL.LLL.LLL.LLL.......',
    '......L.L..L....L.L.L...L....L..L...L.........',
    '......LLL..L....L.L.LL..LL...L..L...LL........',
    '......L.L..L....L.L.L...L....L..L...L.........',
    '......L.L.LLL...LLL.L...L...LLL.LLL.LLL.......',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..................YYYY..YYYY..................',
    '..................yyyy..yyyy..................',
    '.......YY.YYY..u..yyyy..yyyy..u..YY.YYY.......',
    '.......yyuyyu.....yyyy..yyyy.....yyuyyu.......',
    '.......yu.yuy.....yyyy..yyyy.....yu.yuy.......',
    '..................yyyu..yyyu..................',
    '.......yx.yss.....yyuy..yyuy.....yy.yyy.......',
    '.......xxxxss.....yuyy..yuyy.....yyuyyu.......',
    '.......xx.xss.....yyyy..yyyy.....yu.yuy.......',
    '..................yyy....yyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................YYYYYYYYYY..................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
  ],
  [
    '...................z..........................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '.......L..LLL...LLL.LLL.LLL.LLL.LLL.LLL.......',
    '......L.L..L....L.L.L...L....L..L...L.........',
    '......LLL..L....L.L.LL..LL...L..L...LL........',
    '......L.L..L....L.L.L...L....L..L...L.........',
    '......L.L.LLL...LLL.L...L...LLL.LLL.LLL.......',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..................YYYY..YYYY..................',
    '..................yyyy..yyyy..................',
    '.......YY.YYY..u..yyyy..yyyy..u..YY.YYY.......',
    '.......yyuyyu.....yyyy..yyyy.....yyuyyu.......',
    '.......yu.yuy.....yyyy..yyyy.....yu.yuy.......',
    '..................yyyu..yyyu..................',
    '.......yx.ySS.....yyuy..yyuy.....yy.yyy.......',
    '.......xxxxSS.....yuyy..yuyy.....yyuyyu.......',
    '.......xx.xSS.....yyyy..yyyy.....yu.yuy.......',
    '..................yyy....yyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................yyyy..yyyy..................',
    '..................YYYYYYYYYY..................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
    '..............................................',
  ],
];

const PALET: Record<string, string> = {
  k: '#14111a',
  r: '#5b7f9a',
  R: '#8fb3cc',
  q: '#3e5a70',
  Q: '#2c4254',
  p: '#24406e',
  P: '#3a64a4',
  l: '#9cc8ff',
  m: '#b9bec9',
  M: '#e2e6ee',
  s: '#6b7080',
  S: '#8c92a3',
  z: '#ff4040',
  w: '#f1e6cc',
  W: '#d4c39c',
  v: '#fff8e6',
  b: '#9a8f80',
  B: '#c2b8a8',
  n: '#232a36',
  N: '#171c25',
  L: '#73f2ff',
  G: '#8a93a6',
  f: '#7a4a2a',
  F: '#a8703f',
  c: '#8fd3ef',
  C: '#4f9ec4',
  h: '#ffffff',
  d: '#7cc6e6',
  D: '#3f86ad',
  y: '#f2c94c',
  a: '#2f9f8f',
  A: '#57c9b4',
  g: '#3f9a3a',
  e: '#66c25a',
  o: '#b0643a',
  O: '#d38652',
};

const PALET_MALAM: Record<string, string> = {
  y: '#ffd68a',
  Y: '#ffb85c',
  u: '#fff6d8',
  L: '#a6fbff',
  z: '#ff6060',
  x: '#3a2a22',
  s: '#6fb8ff',
  S: '#b5ddff',
};

/**
 * Pintu kaca ganda, 10×17 piksel di (18, 38) gambar gedung. Tiap daun
 * selebar 4 piksel kaca + 1 piksel kusen di sisi tengah; membuka = keduanya
 * bergeser keluar 1 piksel per frame, masuk ke balik dinding, dan lobi di
 * dalam terlihat di celahnya: dinding krem dengan layar "AI" biru, meja
 * resepsionis teal, tanaman, lantai kayu.
 */
const PINTU = { x: 18, y: 38, w: 10, h: 17 };

const LOBI = [
  '1111111111',
  '1111111111',
  '2222222222',
  '22kkkkk222',
  '22kSSSk2g2',
  '22kSLSk2gG',
  '22kSSSk2gg',
  '22kkkkk2gg',
  '2222222oOo',
  '2222222oOo',
  '3333333333',
  '4tttttt444',
  '4TTTTTT454',
  '4TaaaaT444',
  '4TaaaaT454',
  '4444444444',
  '5454545454',
];

function bingkaiPintu() {
  return [0, 1, 2, 3, 4].map((f) =>
    LOBI.map((lobi, y) => {
      let baris = '';
      for (let x = 0; x < PINTU.w; x++) {
        // daun kiri: kaca 0..3-f, kusen di 4-f; daun kanan: kusen di 5+f, kaca 6+f..9
        const kusen = x === 4 - f || x === 5 + f;
        const kaca = x < 4 - f || x > 5 + f;
        if (kusen) baris += 'k';
        else if (kaca) {
          const kiri = x < 4 - f;
          const dx = kiri ? x : x - (6 + f);
          // kaca: pantulan gelap di atas & bawah, kilau miring, gagang kuning di kusen
          if (y === 0 || y === PINTU.h - 1) baris += 'D';
          else if (y === 9 && ((kiri && x === 3 - f) || (!kiri && x === 6 + f))) baris += 'y';
          else if (y >= 5 && y <= 7 && dx === 8 - y) baris += 'h';
          else baris += 'd';
        } else baris += lobi[x];
      }
      return baris;
    })
  );
}

const PALET_PINTU: Record<string, string> = {
  k: '#14111a', d: '#7cc6e6', D: '#3f86ad', h: '#ffffff', y: '#f2c94c',
  '1': '#5a4632', '2': '#e8d9b8', '3': '#b89c74', '4': '#a0703f', '5': '#8a5a30',
  S: '#4fb8d8', L: '#c8f6ff', g: '#3f9a3a', G: '#66c25a', o: '#b0643a', O: '#d38652',
  t: '#57c9b4', T: '#2f6f78', a: '#24555c',
};

/** Malam: kaca dan lobi diterangi lampu dalam, di atas tirai malam. */
const PALET_PINTU_MALAM: Record<string, string> = {
  ...PALET_PINTU,
  d: '#ffd68a', D: '#ffb85c', h: '#fff6d8',
  '1': '#8a6a42', '2': '#ffe9b8', '3': '#e0b878', '4': '#c88a4c', '5': '#a87038',
  S: '#7fe0ff', L: '#e8fdff', T: '#3f8f98', a: '#2f6f78', t: '#7fe0c8',
};

/** Lapis malam gedung tanpa kotak pintu — digantikan sprite pintu malam. */
function tanpaPintu(frame: string[]) {
  return frame.map((baris, y) =>
    y < PINTU.y || y >= PINTU.y + PINTU.h
      ? baris
      : baris.slice(0, PINTU.x) + '.'.repeat(PINTU.w) + baris.slice(PINTU.x + PINTU.w)
  );
}
