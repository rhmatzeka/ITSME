import Phaser from 'phaser';
import { DEPTH, LAPANGAN } from '../config';
import { spritesheetTeks } from './piksel';

/** Menggantung di atas kepala, seperti lengan tiang lampunya; di bawah tirai malam. */
const KEDALAMAN = DEPTH.above + 3;

/** Jarak antar bendera segitiga di sepanjang tali, px. */
const JARAK = 6;

/** Tiga keadaan lendut tali: angin mengangkat dan menurunkannya satu piksel. */
const LENDUT = [-1, 0, 1];

const WARNA_TALI = '#4a3526';

interface Tali {
  img: Phaser.GameObjects.Image;
  dari: { x: number; y: number };
  ke: { x: number; y: number };
  lendut: number;
  bendera: { s: Phaser.GameObjects.Sprite; x: number; fase: number }[];
}

/**
 * Umbul-umbul tujuhbelasan: tali dengan bendera segitiga merah dan putih
 * berselang, direntangkan dari lengan tiang lampu barat ke tiang lampu
 * timur di atas bangku, lalu dari tiang itu ke tiang bendera lapangan.
 *
 * Talinya melengkung dan ikut diayun angin — lendutnya naik-turun satu
 * piksel pelan-pelan — dan tiap bendera berkibar dengan iramanya sendiri:
 * ujung bawahnya tertiup ke timur, searah awan. Semua keadaannya digambar
 * sekali saat dimuat; yang berubah selama main cuma frame dan posisi.
 */
export class Umbul {
  private tali: Tali[] = [];
  private lendutKe = 1;
  private waktu = Math.random() * 10;

  constructor(private scene: Phaser.Scene) {
    // bendera 5×5, ujungnya menunjuk ke bawah; frame 1-2 ujungnya tertiup ke kanan
    const segitiga = (a: string, b: string) => [
      [`${a}${a}${a}${a}${b}`, `${a}${a}${a}${a}${b}`, `.${a}${a}${b}.`, `.${a}${b}..`.padEnd(5, '.'), '..' + b + '..'],
      [`${a}${a}${a}${a}${b}`, `${a}${a}${a}${a}${b}`, `.${a}${a}${a}${b}`, `..${a}${b}.`, `...${b}.`],
      [`${a}${a}${a}${a}${b}`, `.${a}${a}${a}${b}`, `..${a}${a}${b}`, `...${a}${b}`, `....${b}`],
    ];
    spritesheetTeks(scene, 'umbul_merah', segitiga('r', 'R'), { r: '#e0463a', R: '#a82a22' });
    spritesheetTeks(scene, 'umbul_putih', segitiga('w', 'W'), { w: '#f7f5ee', W: '#c9c3b6' });

    LAPANGAN.umbul.forEach((u, i) => {
      for (const l of LENDUT) this.gambarTali(`umbul_tali_${i}_${l}`, u.dari, u.ke, u.lendut + l);
      const img = scene.add
        .image(Math.min(u.dari.x, u.ke.x), 0, `umbul_tali_${i}_0`)
        .setOrigin(0)
        .setDepth(KEDALAMAN);
      const t: Tali = { img, dari: u.dari, ke: u.ke, lendut: u.lendut, bendera: [] };
      const lebar = Math.abs(u.ke.x - u.dari.x);
      const n = Math.floor((lebar - 4) / JARAK);
      const mulai = (lebar - (n - 1) * JARAK) / 2;
      for (let k = 0; k < n; k++) {
        const x = Math.round(Math.min(u.dari.x, u.ke.x) + mulai + k * JARAK);
        const s = scene.add
          .sprite(x, 0, k % 2 ? 'umbul_putih' : 'umbul_merah', 0)
          .setOrigin(0.5, 0)
          .setDepth(KEDALAMAN + 0.1);
        t.bendera.push({ s, x, fase: Math.random() * Math.PI * 2 });
      }
      this.tali.push(t);
    });
    this.pasang();

    // angin: kibaran tiap 140 ms, lendut tali dicek bersamaan
    const kibar = scene.time.addEvent({ delay: 140, loop: true, callback: () => this.tiup() });
    scene.events.once('shutdown', () => kibar.remove());
  }

  /** Tali satu piksel per kolom — lengkung parabola di antara dua ujungnya. */
  private gambarTali(key: string, a: { x: number; y: number }, b: { x: number; y: number }, lendut: number) {
    const tx = this.scene.textures;
    if (tx.exists(key)) return;
    const x0 = Math.min(a.x, b.x);
    const w = Math.abs(b.x - a.x) + 1;
    const h = Math.max(a.y, b.y) + lendut + 2;
    const k = tx.createCanvas(key, w, h)!;
    const ctx = k.getContext();
    ctx.fillStyle = WARNA_TALI;
    let tadi = -1;
    for (let x = 0; x < w; x++) {
      const y = tinggiTali(x0 + x, a, b, lendut);
      // sambung tegak kalau lengkungnya melompat lebih dari satu piksel
      const atas = tadi < 0 ? y : Math.min(y, tadi + 1);
      const bawah = tadi < 0 ? y : Math.max(y, tadi - 1);
      ctx.fillRect(x, atas, 1, bawah - atas + 1);
      tadi = y;
    }
    k.refresh();
  }

  /** Taruh tali dan benderanya sesuai lendut sekarang. */
  private pasang() {
    const l = LENDUT[this.lendutKe];
    this.tali.forEach((t, i) => {
      t.img.setTexture(`umbul_tali_${i}_${l}`);
      for (const b of t.bendera) b.s.setY(tinggiTali(b.x, t.dari, t.ke, t.lendut + l) + 1);
    });
  }

  private tiup() {
    this.waktu += 0.14;
    // hembusan: gelombang pelan ditambah sesekali tiupan yang lebih kencang
    const angin = Math.sin(this.waktu * 0.8) * 0.6 + Math.sin(this.waktu * 2.3) * 0.4;
    const ke = angin > 0.45 ? 0 : angin < -0.45 ? 2 : 1;
    if (ke !== this.lendutKe) {
      this.lendutKe = ke;
      this.pasang();
    }
    const kencang = (angin + 1) / 2;
    for (const t of this.tali) {
      for (const b of t.bendera) {
        const f = Math.sin(this.waktu * 5 + b.fase) * 0.5 + 0.5 + kencang * 0.6;
        b.s.setFrame(f > 1.1 ? 2 : f > 0.6 ? 1 : 0);
      }
    }
  }
}

/** Tinggi tali (y dunia, dibulatkan) di kolom x. */
function tinggiTali(x: number, a: { x: number; y: number }, b: { x: number; y: number }, lendut: number) {
  const t = Phaser.Math.Clamp((x - a.x) / (b.x - a.x), 0, 1);
  return Math.round(a.y + (b.y - a.y) * t + 4 * lendut * t * (1 - t));
}
