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
 * Layangannya meliuk seperti milik bukit taman — ekornya mengikuti jejak
 * layangan beberapa saat lalu — tapi warnanya lain dan benangnya berujung di
 * tangan si anak, bukan di patok.
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
    spritesheetTeks(
      s,
      'layangan_anak',
      [['.....k.....', '....kik....', '...kiiik...', '..kiiikjk..', '.kiiikjjjk.', 'kkkkkkkkkkk',
        '.kjjjkiiik.', '..kjjkiik..', '...kjkik...', '....kkk....', '.....k.....']],
      { k: '#3a2418', i: '#f2b233', j: '#5a8fe0' }
    );
    spritesheetTeks(s, 'pita_anak', [['.k.', 'kjk', '.k.'], ['.k.', 'kik', '.k.']], {
      k: '#3a2418',
      i: '#f2b233',
      j: '#5a8fe0',
    });
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
    const pita = [0, 1, 2, 3, 4, 5].map((i) => s.add.sprite(0, 0, 'pita_anak', i % 2).setDepth(depth - 0.5));
    const kunci = (v: number) => Math.round(v * z) / z;

    let t = Math.random() * 10;
    let angkat = 0; // naik sesaat sesudah benangnya ditarik
    let jedaTarik = 1500;
    const jejak: { x: number; y: number }[] = [];
    const semua = [anak, bayang, tali, layang, ...pita];

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
      layang.setPosition(kunci(lx), kunci(ly)).setAngle(Math.sin(t * 1.5) * 10);

      // ekor: simpul pita mengikuti posisi layangan beberapa saat lalu
      jejak.unshift({ x: lx, y: ly + 5 });
      if (jejak.length > 60) jejak.pop();
      const simpul = pita.map((p, i) => {
        const j = jejak[Math.min(jejak.length - 1, (i + 1) * 4)];
        const q = { x: j.x + Math.sin(t * 6 + i) * 1.1, y: j.y + (i + 1) * 2.6 };
        p.setPosition(kunci(q.x), kunci(q.y));
        if (Math.random() < 0.07) p.setFrame(p.frame.name === '0' ? 1 : 0);
        return q;
      });

      // benang melendut dari genggaman ke layangan; makin kendur saat tidak ditarik
      const lendut = 8 + (1 - angkat) * 5;
      tali.clear().lineStyle(1 / z, 0x3a2418, 0.9).beginPath().moveTo(lx, ly + 5);
      for (const q of simpul) tali.lineTo(q.x, q.y);
      tali.strokePath().lineStyle(1 / z, 0xf4ecd8, 0.95);
      new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(hx, hy),
        new Phaser.Math.Vector2((hx + lx) / 2 + 5, (hy + ly) / 2 + lendut),
        new Phaser.Math.Vector2(lx, ly + 5)
      ).draw(tali, 20);
    });
  }
}
