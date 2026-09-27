import Phaser from 'phaser';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Frame sarang jerami: 0 tiga telur, 1 telur tengah retak, 2 telur tengah sudah pecah. */
const FRAME = { penuh: 0, retak: 1, pecah: 2 } as const;

/**
 * Sarang jerami berisi tiga telur di halaman ayam. Sesekali telur tengahnya
 * bergoyang, retak, lalu pecah — seekor anak ayam keluar dan ikut berkeliaran
 * di halaman. Setelah beberapa lama anak ayam itu "pergi" (memudar) dan
 * sarangnya kembali berisi tiga telur, jadi halamannya tidak pernah sesak.
 *
 * Sarangnya digambar di kode, bukan diambil dari aset pihak ketiga: sarang
 * bawaan aset terlalu kecil dan pucat untuk terbaca di halaman yang ramai.
 * Anak ayamnya dibuat SEKALI dan dipakai ulang tiap menetas.
 */
export class Sarang {
  private s: Phaser.GameObjects.Sprite;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private anak: Phaser.GameObjects.Sprite | undefined
  ) {
    this.buatTekstur();
    // bayangan lembut di tanah supaya sarangnya tidak terlihat mengambang
    scene.add.ellipse(x, y - 1, 18, 5, 0x1b2416, 0.22).setDepth(kedalaman(y) - 1);
    this.s = scene.add.sprite(x, y, 'sarang_jerami', FRAME.penuh).setOrigin(0.5, 1).setDepth(kedalaman(y));
    this.anak?.setAlpha(0);
    this.jadwal();
  }

  private buatTekstur() {
    const bawah = [
      'kSSdSSSdSSSdSSSk',
      'kdSSSdSSSdSSSdSk',
      'kSdSdSdSdSdSdSSk',
      '.kddsddsddsddsk.',
      '..kkkkkkkkkkkk..',
    ];
    spritesheetTeks(
      this.scene,
      'sarang_jerami',
      [
        ['......kkk.......', '.....keeEk......', '..kkkeeeEkkkk...', '.keeEkeeEkeeEk..', '.keeEkeeEkeeEk..', ...bawah],
        ['......kkk.......', '.....keceEk.....', '..kkkecEEkkkk...', '.keeEkeceEkeeEk.', '.keeEkeeEkeeEk..', ...bawah],
        ['................', '................', '..kkk....kkkk...', '.keeEkekEkeeEk..', '.keeEkeeEkeeEk..', ...bawah],
      ],
      {
        k: '#3b2412',
        e: '#fbf3e2',
        E: '#e2d3b3',
        c: '#6b4a2a',
        S: '#e8b85a',
        d: '#a8742e',
        s: '#8a5a24',
      }
    );
  }

  private jadwal() {
    this.scene.time.delayedCall(Phaser.Math.Between(18000, 32000), () => this.menetas());
  }

  private goyang(kali: number, sudut: number, selesai: () => void) {
    this.scene.tweens.add({
      targets: this.s,
      angle: { from: -sudut, to: sudut },
      duration: 120,
      yoyo: true,
      repeat: kali,
      onComplete: () => {
        this.s.setAngle(0);
        selesai();
      },
    });
  }

  menetas() {
    // goyang pelan → retak → goyang kencang → pecah
    this.goyang(3, 5, () => {
      this.s.setFrame(FRAME.retak);
      this.scene.time.delayedCall(500, () =>
        this.goyang(4, 8, () => {
          this.s.setFrame(FRAME.pecah);
          this.cangkang();
          if (this.anak) {
            this.anak.setPosition(this.s.x, this.s.y - 2);
            this.scene.tweens.add({ targets: this.anak, alpha: 1, duration: 300 });
            this.scene.time.delayedCall(40000, () =>
              this.scene.tweens.add({ targets: this.anak, alpha: 0, duration: 800 })
            );
          }
          // sarang terisi tiga telur lagi
          this.scene.time.delayedCall(9000, () => {
            this.s.setFrame(FRAME.penuh).setScale(1, 0.7);
            this.scene.tweens.add({ targets: this.s, scaleY: 1, duration: 240, ease: 'Back.easeOut' });
            this.jadwal();
          });
        })
      );
    });
  }

  /** Serpih cangkang yang terlempar saat menetas. */
  private cangkang() {
    for (let i = 0; i < 6; i++) {
      const c = this.scene.add
        .rectangle(this.s.x, this.s.y - 8, i < 2 ? 2 : 1, 1, i % 2 ? 0xfbf3e2 : 0xe2d3b3)
        .setDepth(this.s.depth + 1);
      this.scene.tweens.add({
        targets: c,
        x: this.s.x + Phaser.Math.Between(-9, 9),
        y: this.s.y - Phaser.Math.Between(4, 14),
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.scene.tweens.add({
            targets: c,
            y: this.s.y - 1,
            alpha: 0,
            duration: 380,
            ease: 'Quad.easeIn',
            onComplete: () => c.destroy(),
          }),
      });
    }
  }
}
