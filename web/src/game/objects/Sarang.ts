import Phaser from 'phaser';
import { kedalaman } from '../config';

/** Frame Egg_And_Nest (Sprout Lands): 2 = sarang berisi telur, 3 = sarang kosong. */
const FRAME = { berisi: 2, kosong: 3 } as const;

/**
 * Sarang telur di halaman ayam. Sesekali telurnya bergoyang, retak, dan
 * seekor anak ayam keluar lalu ikut berkeliaran di halaman. Setelah beberapa
 * lama anak ayam itu "pergi" (memudar) dan sarangnya terisi telur lagi, jadi
 * halamannya tidak pernah penuh sesak.
 *
 * Anak ayamnya dibuat SEKALI dan dipakai ulang tiap menetas — kalau dibuat
 * baru setiap kali, penghuni yang tidak terlihat akan menumpuk selamanya.
 */
export class Sarang {
  private s: Phaser.GameObjects.Sprite;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private anak: Phaser.GameObjects.Sprite | undefined
  ) {
    this.s = scene.add.sprite(x, y, 'sarang', FRAME.berisi).setOrigin(0.5, 1).setDepth(kedalaman(y));
    this.anak?.setAlpha(0);
    this.jadwal();
  }

  private jadwal() {
    this.scene.time.delayedCall(Phaser.Math.Between(18000, 32000), () => this.menetas());
  }

  private menetas() {
    // telur bergoyang dulu — tanda sebentar lagi pecah
    this.scene.tweens.add({
      targets: this.s,
      angle: { from: -8, to: 8 },
      duration: 140,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.s.setAngle(0).setFrame(FRAME.kosong);
        this.cangkang();
        if (this.anak) {
          this.anak.setPosition(this.s.x, this.s.y - 1);
          this.scene.tweens.add({ targets: this.anak, alpha: 1, duration: 300 });
          // setelah berkeliaran sebentar, anak ayamnya pergi
          this.scene.time.delayedCall(40000, () =>
            this.scene.tweens.add({ targets: this.anak, alpha: 0, duration: 800 })
          );
        }
        // sarang terisi telur lagi
        this.scene.time.delayedCall(9000, () => {
          this.s.setFrame(FRAME.berisi).setScale(1, 0.6);
          this.scene.tweens.add({ targets: this.s, scaleY: 1, duration: 240, ease: 'Back.easeOut' });
          this.jadwal();
        });
      },
    });
  }

  /** Serpih cangkang kecil yang terlempar saat menetas. */
  private cangkang() {
    for (let i = 0; i < 4; i++) {
      const c = this.scene.add
        .rectangle(this.s.x, this.s.y - 6, 1, 1, i % 2 ? 0xf6ecd0 : 0xd9c79c)
        .setDepth(this.s.depth + 1);
      this.scene.tweens.add({
        targets: c,
        x: this.s.x + Phaser.Math.Between(-7, 7),
        y: this.s.y - Phaser.Math.Between(2, 10),
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }
}
