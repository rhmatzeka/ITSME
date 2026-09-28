import Phaser from 'phaser';
import { aliranSungai, krik } from '../bunyi';

/**
 * Sungai, px dunia: pita mendatar dan sungai tegak di barat — sama dengan
 * yang diukur Sungai.ts dari map_full.png.
 */
const AIR = { datar: { y0: 377, y1: 404 }, tegak: { x0: 15, x1: 32, y1: 377 } } as const;

/**
 * Tempat jangkrik berkumpul, px dunia: rumput yang rimbun dan sawah. Di
 * sawah paling ramai (`keras` lebih besar), di rumput lain lebih jarang.
 */
const SARANG_JANGKRIK = [
  { x: 530, y: 450, ekor: 3, keras: 1.3 },
  { x: 470, y: 470, ekor: 2, keras: 1.1 },
  { x: 200, y: 150, ekor: 2, keras: 1 },
  { x: 90, y: 250, ekor: 2, keras: 1 },
  { x: 150, y: 425, ekor: 2, keras: 0.9 },
  { x: 420, y: 425, ekor: 2, keras: 0.9 },
  { x: 100, y: 505, ekor: 2, keras: 1 },
  { x: 350, y: 505, ekor: 2, keras: 1 },
  { x: 590, y: 505, ekor: 2, keras: 1 },
  { x: 590, y: 120, ekor: 2, keras: 1 },
  { x: 600, y: 300, ekor: 2, keras: 1 },
  { x: 350, y: 30, ekor: 2, keras: 0.9 },
];

interface Jangkrik {
  x: number;
  y: number;
  nada: number;
  keras: number;
  /** Jarak antar "krik", ms. */
  irama: number;
  berikut: number;
  /** Jangkrik berderik bergelombang: sekian lama bersuara, lalu diam sebentar. */
  bunyiSampai: number;
  diamSampai: number;
}

/**
 * Suara latar desa yang tidak menempel ke satu benda: gemericik sungai yang
 * makin keras makin dekat pemain ke air, dan paduan jangkrik di malam hari.
 *
 * Jangkriknya tersebar di beberapa rumpun rumput dan sawah, tiap ekor
 * dengan nada dan iramanya sendiri, dan tiap ekor bergantian diam — jadi
 * paduannya terus berubah seperti malam sungguhan, bukan satu rekaman yang
 * diulang. Kerasnya ikut jarak, jadi berjalan melewati sawah di malam hari
 * terdengar makin riuh lalu mereda lagi.
 */
export class SuaraLatar {
  private jangkrik: Jangkrik[] = [];
  private jedaSungai = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => { x: number; y: number } | undefined
  ) {
    for (const s of SARANG_JANGKRIK) {
      for (let i = 0; i < s.ekor; i++) {
        this.jangkrik.push({
          x: s.x + Phaser.Math.Between(-24, 24),
          y: s.y + Phaser.Math.Between(-14, 14),
          nada: Phaser.Math.Between(3900, 5400),
          keras: s.keras * Phaser.Math.FloatBetween(0.7, 1),
          irama: Phaser.Math.Between(420, 900),
          berikut: 0,
          bunyiSampai: 0,
          diamSampai: 0,
        });
      }
    }
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.detak, this);
      aliranSungai.setel(0);
    });
  }

  private detak(t: number, delta: number) {
    const p = this.pemain();
    if ((this.jedaSungai -= delta) <= 0) {
      this.jedaSungai = 300;
      this.sungai(p);
    }
    // jangkrik mulai berderik menjelang gelap, penuh di malam hari
    const riuh = Phaser.Math.Clamp((this.gelap() - 0.45) / 0.4, 0, 1);
    if (riuh <= 0) return;
    for (const j of this.jangkrik) {
      if (t < j.diamSampai || t < j.berikut) continue;
      if (t > j.bunyiSampai) {
        // selesai satu gelombang: diam sebentar, lalu mulai lagi
        j.diamSampai = t + Phaser.Math.Between(1500, 6000);
        j.bunyiSampai = j.diamSampai + Phaser.Math.Between(5000, 14000);
        continue;
      }
      j.berikut = t + j.irama * Phaser.Math.FloatBetween(0.92, 1.08);
      krik(j.x, j.y, j.nada, 190, j.keras * riuh);
    }
  }

  /** Gemericik sungai: keras dari jarak ke air terdekat, kiri-kanan dari letaknya. */
  private sungai(p: { x: number; y: number } | undefined) {
    if (!p) return;
    const { datar, tegak } = AIR;
    const dDatar = p.y < datar.y0 ? datar.y0 - p.y : p.y > datar.y1 ? p.y - datar.y1 : 0;
    const dTegak = Math.hypot(
      p.x < tegak.x0 ? tegak.x0 - p.x : p.x > tegak.x1 ? p.x - tegak.x1 : 0,
      p.y > tegak.y1 ? p.y - tegak.y1 : 0
    );
    const d = Math.min(dDatar, dTegak);
    const k = Math.max(0, 1 - d / 150);
    // arah: sungai mendatar ada di mana-mana kiri-kanan, jadi di tengah;
    // sungai tegak selalu di kiri
    const pan = dTegak < dDatar ? -Math.min(0.7, (p.x - tegak.x1) / 150) : 0;
    aliranSungai.setel(0.22 * k * k, pan);
  }
}
