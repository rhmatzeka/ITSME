import Phaser from 'phaser';
import { DEPTH, SAWAH, TILE, kedalaman } from '../config';

/**
 * Warna gundukan tanah bawaan Sprout Lands (krem) diganti warna tanah sawah
 * yang sedikit lebih gelap. Aslinya krem pucat di atas tanah oranye — tiap
 * tanaman terlihat berdiri di atas bercak asing, bukan tumbuh dari petaknya.
 */
const GANTI_WARNA: [number[], number[]][] = [[[0xdc, 0xb9, 0x8a], [0xcf, 0x78, 0x3a]]];

/** Tanah guludan: punggung terang dan alur gelap, diambil dari tanah petaknya. */
const GULUDAN = { alur: 0xc96f35, punggung: 0xf6ad62 } as const;

interface Tanaman {
  s: Phaser.GameObjects.Sprite;
  /** Jeda riak: tanaman di satu petak berubah berurutan, bukan serentak. */
  riak: number;
}

interface Petak {
  frame: number[];
  /** Frame hasil panen yang melompat keluar saat dipanen. */
  hasil: number;
  tahap: number;
  sisa: number;
  sibuk: boolean;
  tanaman: Tanaman[];
}

/**
 * Empat petak sawah yang ditanami.
 *
 * Satu petak tumbuh BERSAMA — seperti sawah sungguhan yang ditanam di hari
 * yang sama — tapi perubahannya merambat dari tanaman ke tanaman, jadi
 * terlihat seperti riak, bukan gambar yang diganti. Keempat petak mulai di
 * tahap berbeda, sehingga sekali lihat ada yang baru ditanam, sedang tumbuh,
 * dan siap panen. Waktu dipanen, hasilnya melompat keluar dari tanah.
 */
export class Sawah {
  private petak: Petak[] = [];

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists('tanaman')) return;
    this.siapkanTekstur();
    this.gambarGuludan();

    SAWAH.petak.forEach((p, pi) => {
      const jenis = pi % SAWAH.jenis.length;
      const frame = SAWAH.jenis[jenis];
      const tahap = (frame.length - 1 - pi + frame.length) % frame.length;
      const petak: Petak = {
        frame,
        hasil: frame[frame.length - 1] + 1,
        tahap,
        sisa: this.lama(tahap, frame) * Phaser.Math.FloatBetween(0.2, 1),
        sibuk: false,
        tanaman: [],
      };
      for (let bar = 0; bar < SAWAH.tinggi; bar++) {
        for (let kol = 0; kol < SAWAH.lebar; kol++) {
          const x = (p.x + kol) * TILE + TILE / 2;
          const y = (p.y + bar + 1) * TILE - 3;
          const s = scene.add
            .sprite(x, y, 'tanaman_sawah', frame[tahap])
            .setOrigin(0.5, 1)
            .setDepth(kedalaman(y));
          // riak dari kiri atas ke kanan bawah petak
          petak.tanaman.push({ s, riak: (bar * SAWAH.lebar + kol) * 90 + Phaser.Math.Between(0, 60) });
        }
      }
      this.petak.push(petak);
    });

    const langkah = 250;
    scene.time.addEvent({ delay: langkah, loop: true, callback: () => this.detak(langkah) });
  }

  /** Salinan spritesheet dengan warna gundukan yang sudah diganti. */
  private siapkanTekstur() {
    const tx = this.scene.textures;
    if (tx.exists('tanaman_sawah')) return;
    const src = tx.get('tanaman').getSourceImage() as HTMLImageElement;
    const kanvas = tx.createCanvas('tanaman_sawah', src.width, src.height)!;
    const ctx = kanvas.getContext();
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, src.width, src.height);
    for (let i = 0; i < data.data.length; i += 4) {
      for (const [dari, jadi] of GANTI_WARNA) {
        if (data.data[i] === dari[0] && data.data[i + 1] === dari[1] && data.data[i + 2] === dari[2]) {
          data.data[i] = jadi[0];
          data.data[i + 1] = jadi[1];
          data.data[i + 2] = jadi[2];
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    const kolom = Math.floor(src.width / 16);
    const baris = Math.floor(src.height / 16);
    for (let f = 0; f < kolom * baris; f++) {
      kanvas.add(f, 0, (f % kolom) * 16, Math.floor(f / kolom) * 16, 16, 16);
    }
    kanvas.refresh();
  }

  /**
   * Guludan: satu punggung tanah per baris tanaman, digambar sekali di bawah
   * semua benda. Tanpa ini petaknya cuma bidang oranye rata dengan tanaman
   * yang ditaruh di atasnya — dengan guludan ia terbaca sebagai tanah yang
   * memang dicangkul berbaris.
   */
  private gambarGuludan() {
    const g = this.scene.add.graphics().setDepth(DEPTH.below + 0.5);
    for (const p of SAWAH.petak) {
      const x0 = p.x * TILE + 4;
      const lebar = SAWAH.lebar * TILE - 8;
      for (let bar = 0; bar < SAWAH.tinggi; bar++) {
        const yDasar = (p.y + bar + 1) * TILE - 3;
        g.fillStyle(GULUDAN.punggung, 1).fillRect(x0, yDasar - 3, lebar, 1);
        g.fillStyle(GULUDAN.alur, 1).fillRect(x0, yDasar - 2, lebar, 2);
      }
    }
  }

  private lama(tahap: number, frame: number[]) {
    const dasar = tahap === frame.length - 1 ? SAWAH.matang : SAWAH.tahap;
    return dasar * Phaser.Math.FloatBetween(0.85, 1.15);
  }

  private detak(ms: number) {
    for (const p of this.petak) {
      if (p.sibuk) continue;
      p.sisa -= ms;
      if (p.sisa > 0) continue;
      if (p.tahap < p.frame.length - 1) this.tumbuh(p);
      else this.panen(p);
    }
  }

  /** Seluruh petak naik satu tahap, merambat dari tanaman ke tanaman. */
  private tumbuh(p: Petak) {
    p.tahap++;
    p.sisa = this.lama(p.tahap, p.frame);
    for (const t of p.tanaman) {
      this.scene.time.delayedCall(t.riak, () => {
        t.s.setFrame(p.frame[p.tahap]).setScale(1, 0.75);
        this.scene.tweens.add({ targets: t.s, scaleY: 1, duration: 240, ease: 'Back.easeOut' });
      });
    }
  }

  /** Dipanen: tiap tanaman menghilang, hasilnya melompat keluar, lalu tunas baru muncul. */
  private panen(p: Petak) {
    p.sibuk = true;
    let sisa = p.tanaman.length;
    for (const t of p.tanaman) {
      this.scene.time.delayedCall(t.riak, () => {
        this.lompatHasil(t.s.x, t.s.y - 6, p.hasil, t.s.depth + 1);
        this.scene.tweens.add({
          targets: t.s,
          alpha: 0,
          scaleY: 0.4,
          duration: 220,
          ease: 'Quad.easeIn',
          onComplete: () => {
            t.s.setFrame(p.frame[0]).setScale(1, 0);
            this.scene.tweens.add({
              targets: t.s,
              alpha: 1,
              scaleY: 1,
              delay: 1400,
              duration: 260,
              ease: 'Back.easeOut',
              onComplete: () => {
                if (--sisa > 0) return;
                p.tahap = 0;
                p.sisa = this.lama(0, p.frame);
                p.sibuk = false;
              },
            });
          },
        });
      });
    }
  }

  /** Jagung atau bit kecil yang terangkat dari tanah lalu memudar. */
  private lompatHasil(x: number, y: number, frame: number, depth: number) {
    // skala kelipatan piksel kamera (2/3 di zoom 3), sama seperti kupu-kupu:
    // skala sembarang membuat piksel gambarnya tidak sama lebar
    const z = this.scene.cameras.main.zoom;
    const h = this.scene.add
      .sprite(x, y, 'tanaman_sawah', frame)
      .setDepth(depth)
      .setScale(Math.max(1, Math.round(z * 0.7)) / z);
    this.scene.tweens.add({
      targets: h,
      y: y - 12,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.scene.tweens.add({ targets: h, alpha: 0, y: y - 16, duration: 320, onComplete: () => h.destroy() }),
    });
  }
}
