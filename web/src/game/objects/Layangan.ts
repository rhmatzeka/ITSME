import Phaser from 'phaser';
import { DEPTH, UTARA, kedalaman } from '../config';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { bisaDiajak, tanganTerangkat } from './Warga';

/** Anak digambar lebih kecil dari orang dewasa: 2/3 di zoom 3, 1/2 di zoom 2. */
const KECIL = 0.7;

/** Genggaman di frame `anak_tarik`, px dari pojok kiri atas frame 32×32. */
const GENGGAM = [
  { x: 24, y: 19 },
  { x: 25, y: 19 },
];

/**
 * Anak main layangan di rumput terbuka strip utara.
 *
 * Tangannya terangkat memegang benang; sesekali ia menarik (frame tangannya
 * berganti) dan layangannya ikut naik sedikit lalu turun lagi dibawa angin.
 * Layangannya merah-putih dengan rangka bambu, meliuk dibawa angin. Ekornya
 * pita panjang merah-putih yang mengikuti jejak ujung bawah layangan beberapa
 * saat lalu, jadi ia berkelok seperti kain sungguhan. Versi pertama ekornya
 * simpul-simpul kecil yang terbaca seperti manik-manik. Benangnya berujung
 * di tangan si anak, bukan di patok seperti layangan bukit taman.
 *
 * Menjelang malam anak itu pulang: ia dan layangannya memudar, dan baru
 * muncul lagi saat langit terang.
 */
export class Layangan {
  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    this.terbangkan();
  }

  private buatTekstur() {
    const s = this.scene;
    tanganTerangkat(s, 'anak', 'anak_tarik', '#d9a07a', '#e8743a');
    // digambar di scratchpad art3.py — merah-putih, rangka bambu
    spritesheetTeks(
      s,
      'layangan_anak',
      [
      [
        '......kk.......',
        '.....kLLk......',
        '....kLLqlk.....',
        '...kLLLqllkk...',
        '..kLLLLqllllk..',
        '.kLLLLLqlllllk.',
        'kLLLqqqqqqqlllk',
        'kLqqLLLqlllqqlk',
        'kLLLLLLqllllllk',
        'khhhhhhqxxxxxk.',
        '.khhhhhqxxxxk..',
        '.khhhhhqxxxxk..',
        '..khhhhqxxxk...',
        '...khhhqxxk....',
        '...khhhqxxk....',
        '....khhqxk.....',
        '.....khqk......',
        '.....khqk......',
        '......kk.......',
      ],
      ],
      { L: '#e0463a', h: '#fbf6e6', k: '#3a2418', l: '#b0302a', q: '#8a6a3a', x: '#fbf6e6' }
    );
  }

  private terbangkan() {
    const s = this.scene;
    const { x, kaki } = UTARA.anak;
    const z = s.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    const anak = s.add.sprite(x, kaki, 'anak_tarik', 0).setOrigin(0.5, 1).setScale(sk).setDepth(kedalaman(kaki));
    const bayang = s.add
      .sprite(x, kaki - sk, bayanganKaki(s))
      .setScale(sk)
      .setAlpha(BAYANGAN_KAKI)
      .setDepth(anak.depth - 0.5);
    bisaDiajak(s, anak, 'Kid', [
      'My kite flies higher than the one on the hill!',
      'Rahmat said he would make a kite game one day. I am holding him to it.',
    ]);

    const depth = DEPTH.above + 30;
    const tali = s.add.graphics().setDepth(depth - 1);
    const layang = s.add.image(0, 0, 'layangan_anak').setDepth(depth);
    const ekor = s.add.graphics().setDepth(depth - 0.5);
    const kunci = (v: number) => Math.round(v * z) / z;

    let t = Math.random() * 10;
    let angkat = 0; // naik sesaat sesudah benangnya ditarik
    let jedaTarik = 1500;
    const jejak: { x: number; y: number }[] = [];
    const semua = [anak, bayang, tali, ekor, layang];

    s.events.on('update', (_w: number, delta: number) => {
      // pulang menjelang malam, kembali saat terang
      const hadir = Phaser.Math.Clamp((0.55 - this.gelap()) / 0.25, 0, 1);
      for (const o of semua) o.setAlpha(o === bayang ? hadir * BAYANGAN_KAKI : hadir).setVisible(hadir > 0);
      if (anak.input) anak.input.enabled = hadir > 0.5;
      if (hadir <= 0) return;

      const dt = Math.min(delta, 100) / 1000;
      t += dt;
      if ((jedaTarik -= delta) <= 0) {
        jedaTarik = Phaser.Math.Between(1400, 3000);
        anak.setFrame(anak.frame.name === '0' ? 1 : 0);
        angkat = 1;
      }
      angkat = Math.max(0, angkat - dt * 1.4);

      const g = GENGGAM[Number(anak.frame.name)] ?? GENGGAM[0];
      const hx = x + (g.x - 16) * sk;
      const hy = kaki - (32 - g.y) * sk;
      // rendah dan ke samping: di tepi atas peta ia tertutup tombol menu
      const lx = hx + 42 + Math.sin(t * 0.8) * 7 + Math.sin(t * 2.1) * 2;
      const ly = hy - 27 + Math.cos(t * 1.1) * 4 + Math.sin(t * 2.7) * 1.5 - Math.sin(angkat * Math.PI) * 4;
      const sudut = Math.sin(t * 1.5) * 10;
      layang.setPosition(kunci(lx), kunci(ly)).setAngle(sudut);

      // ekor: pita dari ujung bawah layangan (9 px di bawah pusatnya, ikut miring),
      // tiap ruasnya mengikuti posisi ujung itu beberapa saat lalu
      const a = Phaser.Math.DegToRad(sudut);
      const ujung = { x: lx - Math.sin(a) * 9, y: ly + Math.cos(a) * 9 };
      jejak.unshift(ujung);
      if (jejak.length > 80) jejak.pop();
      ekor.clear();
      let dari = ujung;
      for (let i = 1; i <= 14; i++) {
        const j = jejak[Math.min(jejak.length - 1, i * 4)];
        const ke = { x: j.x + Math.sin(t * 5 + i * 0.7) * 1.4, y: j.y + i * 1.9 };
        ekor.lineStyle(1.2, Math.floor(i / 2) % 2 ? 0xfbf6e6 : 0xe0463a, 1).lineBetween(dari.x, dari.y, ke.x, ke.y);
        dari = ke;
      }

      // benang melendut dari genggaman ke persilangan rangka; makin kendur saat tidak ditarik
      const lendut = 8 + (1 - angkat) * 5;
      const ikat = { x: lx - Math.sin(a) * 1, y: ly + Math.cos(a) * 1 };
      tali.clear().lineStyle(1 / z, 0xf4ecd8, 0.95);
      new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(hx, hy),
        new Phaser.Math.Vector2((hx + ikat.x) / 2 + 5, (hy + ikat.y) / 2 + lendut),
        new Phaser.Math.Vector2(ikat.x, ikat.y)
      ).draw(tali, 20);
    });
  }
}
