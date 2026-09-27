import Phaser from 'phaser';
import { SAWAH, TILE, kedalaman } from '../config';

interface Tanaman {
  s: Phaser.GameObjects.Sprite;
  frame: number[];
  tahap: number;
  /** Sisa waktu sebelum tahap berikutnya, ms. */
  sisa: number;
  sibuk: boolean;
}

/**
 * Empat petak sawah yang benar-benar ditanami.
 *
 * Petaninya sudah mencangkul sejak lama, tapi petaknya kosong — seolah ia
 * mencangkul untuk tidak ada apa-apa. Sekarang tiap petak berisi delapan
 * tanaman yang tumbuh sendiri tahap demi tahap, berdiri matang sebentar,
 * lalu "dipanen" dan mulai lagi dari tunas.
 *
 * Tiap petak mulai dari tahap yang berbeda, dan tiap tanaman diberi acakan
 * waktunya sendiri: sawah yang tumbuh serempak seperti satu gambar yang
 * diganti terasa mekanis, bukan hidup.
 */
export class Sawah {
  private daftar: Tanaman[] = [];

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists('tanaman')) return;

    SAWAH.petak.forEach((p, pi) => {
      // jagung dan bit berselang-seling antar petak
      const frame = SAWAH.jenis[pi % SAWAH.jenis.length];
      for (let kol = 0; kol < SAWAH.lebar; kol++) {
        for (let bar = 0; bar < SAWAH.tinggi; bar++) {
          const x = (p.x + kol) * TILE + TILE / 2;
          const y = (p.y + bar + 1) * TILE - 2; // titik pijak: dasar tile, sedikit naik
          const tahap = (pi + (Math.random() < 0.3 ? 1 : 0)) % frame.length;
          const s = scene.add
            .sprite(x, y, 'tanaman', frame[tahap])
            .setOrigin(0.5, 1)
            .setDepth(kedalaman(y));
          this.daftar.push({ s, frame, tahap, sisa: this.lama(tahap) * Math.random(), sibuk: false });
        }
      }
    });

    const langkah = 250;
    scene.time.addEvent({ delay: langkah, loop: true, callback: () => this.detak(langkah) });
  }

  /** Lama tahap ini, dengan acakan ±30% supaya tidak serempak. */
  private lama(tahap: number) {
    const dasar = tahap === SAWAH.jenis[0].length - 1 ? SAWAH.matang : SAWAH.tahap;
    return dasar * Phaser.Math.FloatBetween(0.7, 1.3);
  }

  private detak(ms: number) {
    for (const t of this.daftar) {
      if (t.sibuk) continue;
      t.sisa -= ms;
      if (t.sisa > 0) continue;
      if (t.tahap < t.frame.length - 1) this.tumbuh(t);
      else this.panen(t);
    }
  }

  /** Naik satu tahap, dengan hentakan kecil supaya perubahannya tertangkap mata. */
  private tumbuh(t: Tanaman) {
    t.tahap++;
    t.s.setFrame(t.frame[t.tahap]);
    t.sisa = this.lama(t.tahap);
    t.s.setScale(1, 0.8);
    this.scene.tweens.add({ targets: t.s, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** Dipanen: menghilang, lalu tunas baru muncul dari tanah. */
  private panen(t: Tanaman) {
    t.sibuk = true;
    this.scene.tweens.add({
      targets: t.s,
      alpha: 0,
      scaleY: 0.4,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        t.tahap = 0;
        t.s.setFrame(t.frame[0]).setScale(1, 0);
        this.scene.tweens.add({
          targets: t.s,
          alpha: 1,
          scaleY: 1,
          delay: Phaser.Math.Between(600, 1800),
          duration: 260,
          ease: 'Back.easeOut',
          onComplete: () => {
            t.sisa = this.lama(0);
            t.sibuk = false;
          },
        });
      },
    });
  }
}
