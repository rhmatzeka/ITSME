import Phaser from 'phaser';
import { DEPTH, PERABOT, kedalaman } from '../config';
import { potongan } from './piksel';
import { pasangPot } from './TerasCV';

type Warna = (x: number, y: number) => [number, number, number] | null;

/** Jarak longgar di sekitar pintu rumah: di sana tidak ditaruh apa pun, px. */
const JAUH_PINTU = 16;

/** Peluang tiap titik tepi jalan diberi hiasan. */
const PELUANG = { kerikil: 0.16, daun: 0.07, bunga: 0.1, rumput: 0.1 };

/** Satu hiasan per kotak selebar ini paling banyak, px — supaya tidak menggerombol. */
const SEL = 7;

/** Gambar kecil tiap hiasan (titik = kosong); hurufnya dipetakan WARNA. */
const POLA = {
  kerikil: [
    ['lm.', 'mdd'],
    ['lm.....', 'dd.lm..', '...mdd.'],
    ['.lm', 'lmd', 'dd.'],
  ],
  daun: [
    ['aa.', 'abb', '.b.'],
    ['.aa', 'bba', 'b..'],
  ],
  bunga: [['.p.', 'pcp', '.p.', '.g.']],
  rumput: [
    ['g...g', '.g.g.', '.GgG.'],
    ['.g.', 'gGg', 'GgG'],
  ],
};

const WARNA: Record<string, string> = {
  l: '#d8d2c4',
  m: '#aaa396',
  d: '#6e685c',
  g: '#4f9a3a',
  G: '#3f7a2e',
};

/** [helai terang, helai gelap] daun kering. */
const DAUN = [
  ['#c8843a', '#8a5424'],
  ['#e0b04a', '#a8782a'],
];

const BUNGA = ['#f7f5ee', '#ffd34a', '#b48ae0', '#f29bc0'];

/**
 * Detail kecil di sepanjang tepi jalan tanah — dulu jalannya polos dari
 * ujung ke ujung: kerikil dan daun kering di sisi tanah, bunga liar dan
 * rumpun rumput yang lebih gelap di sisi rumput.
 *
 * Letaknya dicari dari peta sendiri, bukan daftar tetap: tiap titik yang
 * tanahnya jingga dan bersebelahan dengan rumput (atau sebaliknya) jadi
 * calon, lalu diundi dengan benih tetap — jadi susunannya sama di tiap
 * kunjungan dan ikut berubah sendiri kalau petanya diubah di Tiled. Petak
 * berpenghalang, petak berhias, dan depan pintu dilewati.
 *
 * Semuanya digambar SEKALI ke satu kanvas selebar peta: ratusan titik kecil
 * jadi satu gambar, satu kali gambar per frame.
 *
 * Ditambah perabot di depan rumah lain (lihat PERABOT): tong sampah, pot
 * bunga, dan pagar bambu pendek.
 */
export class Hiasan {
  constructor(
    scene: Phaser.Scene,
    lebar: number,
    tinggi: number,
    warna: Warna,
    /** Titik ini boleh diberi hiasan: tanpa penghalang dan tanpa benda peta. */
    kosong: (x: number, y: number) => boolean,
    pintu: { x: number; y: number }[],
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.gambarPinggir(scene, lebar, tinggi, warna, kosong, pintu);
    this.pasangPerabot(scene, blocked);
  }

  private gambarPinggir(scene: Phaser.Scene, lebar: number, tinggi: number, warna: Warna, kosong: (x: number, y: number) => boolean, pintu: { x: number; y: number }[]) {
    const tx = scene.textures;
    if (tx.exists('hiasan_pinggir')) {
      scene.add.image(0, 0, 'hiasan_pinggir').setOrigin(0).setDepth(DEPTH.ground + 0.5);
      return;
    }
    const tanah = (x: number, y: number) => {
      const w = warna(x, y);
      return !!w && w[0] > 200 && w[1] > 130 && w[1] < 180 && w[2] < 110;
    };
    const rumput = (x: number, y: number) => {
      const w = warna(x, y);
      return !!w && w[1] > w[0] + 40 && w[1] > w[2] + 60;
    };
    const dekat = (x: number, y: number, uji: (x: number, y: number) => boolean) =>
      [[4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dy]) => uji(x + dx, y + dy));

    const k = tx.createCanvas('hiasan_pinggir', lebar, tinggi)!;
    const ctx = k.getContext();
    const acak = new Phaser.Math.RandomDataGenerator(['desa-pinggir-jalan']);
    const gambar = (x: number, y: number, pola: string[], ganti: Record<string, string> = {}) =>
      pola.forEach((baris, dy) =>
        [...baris].forEach((c, dx) => {
          if (c === '.') return;
          ctx.fillStyle = ganti[c] ?? WARNA[c];
          ctx.fillRect(x + dx, y + dy, 1, 1);
        })
      );
    const terisi = new Set<string>();
    for (let y = 4; y < tinggi - 6; y += 2) {
      for (let x = 4; x < lebar - 8; x += 2) {
        const px = x + acak.between(-1, 1);
        const py = y + acak.between(-1, 1);
        const sel = `${Math.floor(px / SEL)},${Math.floor(py / SEL)}`;
        if (terisi.has(sel) || !kosong(px, py) || !kosong(px + 6, py + 3)) continue;
        if (pintu.some((p) => Math.abs(p.x - px) < JAUH_PINTU && Math.abs(p.y - py) < JAUH_PINTU)) continue;
        const u = acak.frac();
        if (tanah(px, py) && tanah(px + 4, py + 2) && dekat(px, py, rumput)) {
          if (u < PELUANG.kerikil) gambar(px, py, acak.pick(POLA.kerikil));
          else if (u < PELUANG.kerikil + PELUANG.daun) {
            const [a, b] = acak.pick(DAUN);
            gambar(px, py, acak.pick(POLA.daun), { a, b });
          } else continue;
        } else if (rumput(px, py) && rumput(px + 4, py + 3) && dekat(px, py, tanah)) {
          if (u < PELUANG.bunga) {
            const [p, c] = acak.frac() < 0.5 ? [acak.pick(BUNGA), '#ffd34a'] : ['#f7f5ee', '#e8a02a'];
            gambar(px, py, POLA.bunga[0], { p, c });
          } else if (u < PELUANG.bunga + PELUANG.rumput) gambar(px, py, acak.pick(POLA.rumput));
          else continue;
        } else continue;
        terisi.add(sel);
      }
    }
    k.refresh();
    scene.add.image(0, 0, 'hiasan_pinggir').setOrigin(0).setDepth(DEPTH.ground + 0.5);
  }

  private pasangPerabot(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    /*
     * Tong sampah: tong kayu Market Pack (11×13 di y 18 lembar `pasar_16`),
     * diambil bersama tiga baris kosong di atasnya lalu diberi sampah yang
     * menyembul dari mulutnya — kertas kusut dan daun sayur — supaya terbaca
     * sebagai tong sampah, bukan tong air. Tong seng gambar sendiri yang
     * dulu terlihat seperti balok kelabu.
     */
    potongan(scene, 'pasar_16', 'tong_sampah', [243, 15, 11, 16], {}, 1, (ctx) => {
      ctx.clearRect(0, 0, 11, 3);
      const titik = (x: number, y: number, w: string) => {
        ctx.fillStyle = w;
        ctx.fillRect(x, y, 1, 1);
      };
      for (const [x, y, w] of [
        [3, 0, '#3b2630'], [4, 0, '#3b2630'], [5, 1, '#3b2630'], [2, 2, '#3b2630'],
        [3, 1, '#f7f5ee'], [4, 1, '#f7f5ee'], [3, 2, '#f7f5ee'], [4, 2, '#c9c3b6'], [5, 2, '#c9c3b6'],
        [6, 0, '#3f7a2e'], [7, 0, '#3f7a2e'], [6, 1, '#6ab04a'], [7, 1, '#6ab04a'], [7, 2, '#4f9a3a'], [8, 2, '#3f7a2e'],
      ] as [number, number, string][]) titik(x, y, w);
    });
    for (const t of PERABOT.tong) {
      scene.add.image(t.x, t.kaki, 'tong_sampah').setOrigin(0.5, 1).setDepth(kedalaman(t.kaki));
      if (blocked) {
        const r = scene.add.rectangle(t.x, t.kaki - 2, 7, 3);
        scene.physics.add.existing(r, true);
        blocked.add(r);
      }
    }
    PERABOT.pot.forEach((p, i) => pasangPot(scene, p.x, p.kaki, i % 2 ? 'pot_bunga_biru' : 'pot_bunga_jingga', blocked));
    for (const p of PERABOT.pagar) this.pagar(scene, p.x0, p.x1, p.kaki, blocked);
  }

  /** Pagar bambu pendek: tiang tiap 5 px, dua palang melintang, buku-bukunya lebih gelap. */
  private pagar(scene: Phaser.Scene, x0: number, x1: number, kaki: number, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    const w = x1 - x0 + 1;
    const key = `pagar_bambu_${w}`;
    const tx = scene.textures;
    if (!tx.exists(key)) {
      const k = tx.createCanvas(key, w, 10)!;
      const c = k.getContext();
      const px = (x: number, y: number, warna: string) => {
        c.fillStyle = warna;
        c.fillRect(x, y, 1, 1);
      };
      // palang di baris 3 dan 6
      for (let x = 0; x < w; x++) {
        for (const y of [3, 6]) {
          px(x, y - 1, '#3a2e18');
          px(x, y, x % 7 === 3 ? '#8a8a3a' : '#c9c46a');
          px(x, y + 1, '#3a2e18');
        }
      }
      // tiang bambu 2 piksel dengan ujung dipotong miring
      for (let x = 1; x < w - 1; x += 5) {
        for (let y = 0; y < 10; y++) {
          const ruas = y === 5;
          px(x - 1, y, '#3a2e18');
          px(x, y, y === 0 ? '#e8e0a0' : ruas ? '#8a8a3a' : '#c9c46a');
          px(x + 1, y, y === 0 ? '#3a2e18' : ruas ? '#6a6a2a' : '#a8a44a');
          px(x + 2, y, '#3a2e18');
        }
      }
      k.refresh();
    }
    scene.add.image(x0, kaki, key).setOrigin(0, 1).setDepth(kedalaman(kaki));
    if (blocked) {
      const r = scene.add.rectangle(x0 + w / 2, kaki - 2, w, 3);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
  }
}
