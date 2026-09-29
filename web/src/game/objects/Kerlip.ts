import Phaser from 'phaser';
import { DEPTH } from '../config';
import { lingkupGambar } from '../hemat';

/** Nyala bohlam: di atas tirai malam, bersama lampu jalan dan lentera. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/** Warna bohlam berurutan: merah, kuning, hijau, biru. */
const WARNA = [0xff5a4a, 0xffd34a, 0x6ae06a, 0x5aa8ff];

/** Jarak antar bohlam di sepanjang kabel, px. */
const JARAK = 4;

interface Bohlam {
  inti: Phaser.GameObjects.Rectangle;
  pendar: Phaser.GameObjects.Image;
  kelompok: number;
}

/**
 * Lampu kelap-kelip: seutas kabel yang melendut di antara beberapa titik
 * gantung, dengan bohlam kecil empat warna berselang tiap empat piksel.
 *
 * Siang hari bohlamnya cuma titik warna yang mati. Menjelang malam
 * menyala, dan nyalanya "berlari" — tiga kelompok bohlam bergantian
 * terang dan redup, seperti lampu hias tujuhbelasan di pos ronda dan
 * warung. Pendarnya ADD di atas tirai malam supaya benar-benar bercahaya.
 */
export class Kerlip {
  private bohlam: Bohlam[] = [];
  private langkah = 0;
  private jeda = 0;

  constructor(
    private scene: Phaser.Scene,
    titik: { x: number; y: number }[],
    lendut: number,
    /** Kedalaman kabel dan bohlam yang mati — ikut benda tempat ia digantung. */
    kedalaman: number,
    private gelap: () => number
  ) {
    this.buatTekstur();
    const g = scene.add.graphics().setDepth(kedalaman);
    g.fillStyle(0x2a2420, 1);
    let n = 0;
    for (let i = 0; i < titik.length - 1; i++) {
      const a = titik[i];
      const b = titik[i + 1];
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      for (let x = x0; x <= x1; x++) {
        const t = (x - a.x) / (b.x - a.x);
        const y = Math.round(a.y + (b.y - a.y) * t + 4 * lendut * t * (1 - t));
        g.fillRect(x, y, 1, 1);
        if ((x - titik[0].x) % JARAK !== 2) continue;
        const warna = WARNA[n % WARNA.length];
        const inti = scene.add.rectangle(x, y + 1, 1, 1, warna).setOrigin(0).setDepth(kedalaman + 0.01);
        const pendar = scene.add
          .image(x + 0.5, y + 1.5, 'kerlip_pendar')
          .setScale(0.25)
          .setTint(warna)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setVisible(false);
        this.bohlam.push({ inti, pendar, kelompok: n % 3 });
        n++;
      }
    }
    // kabelnya Graphics: beri tahu pemangkas di mana ia digambar
    const xs = titik.map((t) => t.x);
    const ys = titik.map((t) => t.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    lingkupGambar(g, cx, cy, (Math.max(...xs) - Math.min(...xs)) / 2 + lendut + 8);
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    if (tx.exists('kerlip_pendar')) return;
    // digambar 4× lebih rapat lalu dikecilkan, seperti pendar kunang-kunang
    const k = tx.createCanvas('kerlip_pendar', 24, 24)!;
    const ctx = k.getContext();
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    k.refresh();
  }

  private detak(_t: number, delta: number) {
    const nyala = Phaser.Math.Clamp((this.gelap() - 0.25) / 0.35, 0, 1);
    if (nyala <= 0) {
      if (this.bohlam[0]?.pendar.visible) for (const b of this.bohlam) b.pendar.setVisible(false).setAlpha(0);
      return;
    }
    if ((this.jeda -= delta) > 0) return;
    this.jeda = 380;
    this.langkah = (this.langkah + 1) % 3;
    for (const b of this.bohlam) {
      const terang = b.kelompok === this.langkah;
      b.pendar.setVisible(true).setAlpha(nyala * (terang ? 1 : 0.35));
      b.inti.setFillStyle(b.inti.fillColor, terang ? 1 : 0.7);
    }
  }
}
