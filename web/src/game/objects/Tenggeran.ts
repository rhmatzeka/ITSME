import Phaser from 'phaser';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Tinggi lompatan ayam dari tanah ke palang, px: kaki ayam yang tidur
 * (baris 14 gambarnya) jatuh tepat di palang bambu, baris 19-22 dari 34.
 */
export const TINGGI_PALANG = 12;

/**
 * Ayam kampung yang tidur bertengger, 16×16 menghadap kiri — ukuran frame
 * sama dengan lembar ayam berdiri, jadi skalanya ikut sama: badan
 * mengembang bulat, kepala tenggelam di bahu dengan jengger di atasnya,
 * paruh menyembul, mata terpejam (garis), sayap terlipat, ekor menjuntai
 * di belakang palang. Kakinya tidak digambar: tertutup palang di depannya.
 */
const AYAM_TIDUR = [
  '................',
  '................',
  '................',
  '...aba..........',
  '..abcca.........',
  '..EDDDDE........',
  '.HHDZZDDE...ETT.',
  '..EDDDDDDEEEDTGT',
  '..EDDDDDDDDDDETG',
  '.EDDDDDDDDDDDDEG',
  '.EDDDWWWWWWDDDET',
  '.EDDWWWWWWWWDDE.',
  '.ESDDWWWWWWDDSE.',
  '..ESSDDDDDDSSE..',
  '...EEEEEEEEEE...',
  '................',
];

const WARNA_AYAM: Record<string, Record<string, string>> = {
  ayam_merah: { a: '#801620', b: '#f6464e', c: '#eb262e', D: '#c41b24', S: '#801620', W: '#8e1520', E: '#1c0a18', H: '#ff9d0e', Z: '#47141d', T: '#04101b', G: '#0f6542' },
  ayam_hijau: { a: '#801620', b: '#f6464e', c: '#eb262e', D: '#f6ca9a', S: '#e6965b', W: '#be623b', E: '#2c1718', H: '#ff9d0e', Z: '#be623b', T: '#04101b', G: '#0f6542' },
};

/** Frame napas: kepala dan punggung turun sepiksel. */
function tarikNapas(rows: string[]) {
  const kosong = '.'.repeat(rows[0].length);
  return rows.map((_, y) => (y === 0 ? kosong : y <= 9 ? rows[y - 1] : rows[y]));
}

/** Pose tidur bertengger untuk ayam `key` — lihat Penghuni.aturTidur(). */
export function buatAyamTidur(scene: Phaser.Scene, key: string) {
  const warna = WARNA_AYAM[key];
  if (!warna) return;
  spritesheetTeks(scene, `${key}_tidur`, [AYAM_TIDUR, tarikNapas(AYAM_TIDUR)], warna);
}

/**
 * Kandang tenggeran ayam di pojok halaman rumah About: atap rumbia miring
 * dengan rumbai di tritisannya, dua tiang bambu beruas, sebatang palang
 * bambu yang diikat tali ke tiangnya, tangga ayam berpalang di sisi kanan,
 * dan jerami di tanah di bawahnya.
 *
 * Dua lapis: bagian belakang (atap, tiang, tangga, jerami) di belakang
 * ayam-ayamnya, palang di DEPAN perut mereka — jadi ayam yang tidur
 * terlihat mencengkeram palang, bukan duduk di atas meja.
 *
 * Siang hari kosong; begitu gelap ayam-ayam halaman berjalan ke bawahnya
 * satu per satu, melompat ke palang, dan tidur berjajar sampai pagi.
 */
export class Tenggeran {
  /** Titik kaki tiap ayam di tanah di bawah palang, kiri ke kanan. */
  readonly tempat: { x: number; y: number }[];

  constructor(scene: Phaser.Scene, x: number, kaki: number, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    const palet = { k: '#2a2420', b: '#c8a860', B: '#8a6a30', c: '#a88a48', Q: '#c9a55a', R: '#8a6a2a', r: '#a8843e', j: '#e0c060', J: '#b89838', p: '#9a6a3a', P: '#7a4a24', t: '#6a4a2a' };
    spritesheetTeks(scene, 'tenggeran', [[
        '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk......',
        '..kQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRk......',
        '..kQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQk......',
        '.kRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQk.....',
        '.kQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQRQQQk.....',
        '.kRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrk.....',
        'krrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRk....',
        'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk....',
        '.r.rRbRr.rR.Rr.rR.Rr.rR.Rr.rR.Rr.rR.Rr.rRkRr.r....',
        '...RkbR..R..R..R..R..R..R..R..R..R..R..RbkR..R....',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kBk................................kBk........',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kBk................................kBk........',
        '....kbk................................kbk........',
        '....kbk................................kbk........',
        '....kbk................................kbkpk......',
        '....kbk................................kPkpkP.....',
        '....kbk................................kbkkpk.....',
        '....kBk................................kBkkpk.....',
        '....kbk................................kbkPkpkP...',
        '....kbk................................kbk.kpk....',
        '....kbk................................kbk.kpk....',
        '....kbk................................kbk.PkpkP..',
        '....kbk................................kbk..kpk...',
        '....kBk.j..j..j..j..j..j..j..j..j..j...kBk...kpk..',
        '....kbkj.j.Jj.J.jJ.j.jj.j.Jj.J.jJ.j.jj.kbk..PkpkP.',
        '....kbkJj.J.jJ.j.jj.j.Jj.J.jJ.j.jj.j.Jjkbk...kpk..',
        '....kkk................................kkk........',
      ]], palet);
    // palang saja (baris 19-22 gambar kandang), ditaruh di depan ayam-ayamnya
    spritesheetTeks(scene, 'tenggeran_palang', [[
        '...kktkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkktkk.......',
        '..kbtbbbbBbbbbbbbbBbbbbbbbbBbbbbbbbbBbbtbbbk......',
        '..kccctccBccccccccBccccccccBccccccccBcccctck......',
        '...kktkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkktkk.......',
      ]], palet);
    const d = kedalaman(kaki);
    scene.add.image(x, kaki, 'tenggeran').setOrigin(0.5, 1).setDepth(d);
    // ayam yang bertengger di d + 0.3 (lihat Penghuni), palangnya di depan mereka
    scene.add.image(x, kaki - 34 + 19, 'tenggeran_palang').setOrigin(0.5, 0).setDepth(d + 0.5);
    // palang di x 3-42 gambar selebar 50: tiga ayam berjarak rata di atasnya
    const kiri = x - 25;
    this.tempat = [12, 23, 34].map((px) => ({ x: kiri + px, y: kaki }));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 46, 4);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
  }
}
