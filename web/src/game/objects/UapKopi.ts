import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Di atas tirai malam. Uap putih yang ikut digelapkan tirai jadi kelabu
 * biru pekat di atas bangku yang juga gelap — tidak kelihatan sama sekali.
 * Di atas tirai ia diberi warna malamnya sendiri (lihat WARNA_MALAM).
 */
const KEDALAMAN = DEPTH.above + 62;

/** Warna uap di malam hari: pucat kebiruan, disinari lampu dari jauh. */
const WARNA_MALAM = { r: 0xb8, g: 0xc4, b: 0xe0 };

/**
 * Gumpalan uap 5×8 yang meliuk: empat frame, liukannya merambat ke atas.
 * Pangkalnya (baris bawah) lebih tipis, pucuknya lebih pekat — uap yang
 * baru naik dari permukaan kopi masih bening.
 */
const LIUK = [
  ['..a..', '.a...', '.a...', '..a..', '...b.', '...b.', '..b..', '..b..'],
  ['.a...', '..a..', '...a.', '...a.', '..b..', '.b...', '.b...', '..b..'],
  ['..a..', '...a.', '...a.', '..a..', '.b...', '.b...', '..b..', '..b..'],
  ['...a.', '..a..', '.a...', '.a...', '..b..', '...b.', '...b.', '..b..'],
];

/**
 * Uap kopi panas yang mengepul dari gelas: gumpalan tipis bergelombang yang
 * naik, bergoyang, lalu hilang. Dua atau tiga sekaligus,
 * bergantian. Dipakai semua gelas kopi di desa — pakde di bangku CV, kakek
 * dan bapak di bangku utara, tamu pos ronda.
 */
export class UapKopi {
  private pool: Phaser.GameObjects.Sprite[] = [];
  private jeda = 0;

  constructor(
    private scene: Phaser.Scene,
    /** Titik permukaan kopinya sekarang, atau null kalau gelasnya tidak ada. */
    private mulut: () => { x: number; y: number } | null,
    private gelap: () => number
  ) {
    spritesheetTeks(scene, 'uap_kopi', LIUK, { a: '#ffffff', b: 'rgba(255,255,255,0.55)' });
    if (!scene.anims.exists('uap_kopi')) {
      scene.anims.create({ key: 'uap_kopi', frames: scene.anims.generateFrameNumbers('uap_kopi', {}), frameRate: 5, repeat: -1 });
    }
    for (let i = 0; i < 3; i++) {
      this.pool.push(scene.add.sprite(0, 0, 'uap_kopi', 0).setOrigin(0.5, 1).setDepth(KEDALAMAN).setVisible(false));
    }
    scene.events.on('update', this.detak, this);
  }

  private detak(_t: number, delta: number) {
    if ((this.jeda -= delta) > 0) return;
    this.jeda = Phaser.Math.Between(550, 800);
    const m = this.mulut();
    if (!m) return;
    const s = this.pool.find((o) => !o.visible);
    if (!s) return;
    const g = Phaser.Math.Clamp(this.gelap(), 0, 1);
    const warna = Phaser.Display.Color.GetColor(
      Math.round(255 + (WARNA_MALAM.r - 255) * g),
      Math.round(255 + (WARNA_MALAM.g - 255) * g),
      Math.round(255 + (WARNA_MALAM.b - 255) * g)
    );
    const x = m.x + Phaser.Math.Between(-1, 1);
    s.setPosition(x, m.y)
      .setTint(warna)
      .setAlpha(0)
      .setFlipX(Math.random() < 0.5)
      .setVisible(true)
      .play({ key: 'uap_kopi', startFrame: Phaser.Math.Between(0, 3) });
    const puncak = 0.85 - 0.3 * g;
    // muncul pelan dari permukaan, naik sambil bergoyang, lalu pudar di atas
    this.scene.tweens.add({ targets: s, alpha: puncak, duration: 350, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: s,
      y: m.y - Phaser.Math.Between(9, 13),
      x: x + Phaser.Math.Between(-2, 2),
      duration: 1900,
      ease: 'Sine.easeOut',
    });
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      delay: 900,
      duration: 1000,
      onComplete: () => s.setVisible(false).stop(),
    });
  }
}
