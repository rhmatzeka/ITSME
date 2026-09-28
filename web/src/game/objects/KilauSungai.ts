import Phaser from 'phaser';
import { DEPTH, LAMPU, TILE } from '../config';

/** Di atas tirai malam (ADD) supaya benar-benar berkilau, di bawah awan. */
const KEDALAMAN = DEPTH.above + 58;

/**
 * Sumber cahaya hangat yang terpantul di air, px dunia: lampu jalan yang
 * berdiri di tepi sungai, dan jendela rumah Contact di seberang selatan.
 * `jangkau` = lebar pantulannya di permukaan air.
 */
const HANGAT = [
  ...LAMPU.tiang
    .map(([tx, ty]) => ({ x: tx * TILE + LAMPU.lentera.x, y: ty * TILE + LAMPU.lentera.y }))
    .filter((l) => (l.y > 330 && l.y < 460) || l.x < 90),
  { x: 279, y: 446 },
  { x: 323, y: 446 },
].map((l) => ({ ...l, jangkau: 20 }));

interface Kilau {
  garis: Phaser.GameObjects.Rectangle;
  x: number;
  fase: number;
  laju: number;
  hangat: boolean;
}

/**
 * Pantulan cahaya di sungai saat malam.
 *
 * Siang hari sungainya biru rata dan itu cukup; malam hari biru rata
 * terlihat mati. Di sini permukaannya diberi garis-garis cahaya pendek
 * yang beriak: kilau bulan biru-putih yang tersebar di sepanjang sungai,
 * dan pantulan kuning hangat yang merapat di depan lampu jalan dan jendela
 * yang menyala. Tiap garis memanjang-memendek dan bergeser sepiksel ke
 * kiri-kanan dengan iramanya sendiri, jadi airnya terlihat bergerak.
 *
 * Garisnya hanya ditaruh di piksel yang benar-benar air (dibaca dari peta),
 * jadi tidak ada kilau di atas papan jembatan atau batu.
 */
export class KilauSungai {
  private kilau: Kilau[] = [];

  constructor(
    private scene: Phaser.Scene,
    air: (x: number, y: number) => boolean,
    private gelap: () => number,
    lebar: number
  ) {
    const acak = new Phaser.Math.RandomDataGenerator(['kilau-sungai']);
    const taruh = (x: number, y: number, hangat: boolean) => {
      if (!air(x, y) || !air(x + 2, y) || !air(x - 2, y)) return false;
      const garis = scene.add
        .rectangle(x, y, hangat ? 3 : 2, 1, hangat ? 0xffd890 : 0xcfe2ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(KEDALAMAN)
        .setVisible(false);
      this.kilau.push({ garis, x, fase: acak.frac() * 10, laju: acak.realInRange(1.2, 3), hangat });
      return true;
    };
    // kilau bulan: tersebar di sungai mendatar dan sungai tegak di barat
    for (let n = 0, coba = 0; n < 46 && coba < 600; coba++) {
      const tegak = acak.frac() < 0.25;
      const x = tegak ? acak.between(17, 30) : acak.between(0, lebar);
      const y = tegak ? acak.between(20, 370) : acak.between(385, 402);
      if (taruh(x, y, false)) n++;
    }
    // pantulan hangat: merapat di depan tiap sumber cahaya, makin jarang makin jauh
    for (const h of HANGAT) {
      const tegak = h.x < 90;
      for (let n = 0, coba = 0; n < 9 && coba < 120; coba++) {
        const x = tegak ? acak.between(17, 30) : Math.round(h.x + acak.normal() * h.jangkau * 0.5);
        const y = tegak ? Math.round(h.y + acak.normal() * 14) : acak.between(385, 402);
        if (taruh(x, y, true)) n++;
      }
    }
    scene.events.on('update', this.detak, this);
  }

  private detak(t: number) {
    const g = Phaser.Math.Clamp((this.gelap() - 0.35) / 0.5, 0, 1);
    const tampak = g > 0;
    const v = this.scene.cameras.main.worldView;
    const s = t / 1000;
    for (const k of this.kilau) {
      const ada = tampak && v.contains(k.x, k.garis.y);
      k.garis.setVisible(ada);
      if (!ada) continue;
      const denyut = Math.sin(s * k.laju + k.fase);
      // riak: garisnya memanjang-memendek dan bergeser sepiksel
      k.garis
        .setX(k.x + Math.round(Math.sin(s * 0.9 + k.fase * 2)))
        .setScale(1 + Math.max(0, denyut) * (k.hangat ? 1.5 : 1), 1)
        .setAlpha(g * Phaser.Math.Clamp(0.25 + denyut * 0.75, 0, 1) * (k.hangat ? 0.95 : 0.7));
    }
  }
}
