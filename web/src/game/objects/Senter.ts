import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

type Arah = 'down' | 'left' | 'right' | 'up';
const URUT_ARAH: Arah[] = ['down', 'left', 'right', 'up'];

/** Di atas tirai malam, bersama cahaya lampu jalan — lihat Suasana.ts. */
const KEDALAMAN_SOROT = DEPTH.above + 61;

/**
 * Tangan pemegang senter per arah hadap, px dari pusat frame 32×32, dan ke
 * mana sorotnya menghadap. Dibaca dari blonde_man.png: tangan kanan
 * menggantung di x 21 baris 27 saat menghadap bawah; saat menghadap samping
 * tangan depannya di x 12 (kiri) atau 19 (kanan).
 */
const TANGAN: Record<Arah, { x: number; y: number; sudut: number }> = {
  down: { x: 5, y: 11, sudut: 90 },
  left: { x: -5, y: 10, sudut: 180 },
  right: { x: 5, y: 10, sudut: 0 },
  up: { x: -5, y: 8, sudut: -90 },
};

interface Pemegang {
  s: Phaser.GameObjects.Sprite;
  arah: () => Arah;
  aktif: () => boolean;
  sorot: Phaser.GameObjects.Image;
  alat: Phaser.GameObjects.Image;
}

/** Arah hadap dari nomor frame, untuk lembar 4 kolom × (diam, jalan) seperti blonde_man.png. */
export function arahDariFrame(s: Phaser.GameObjects.Sprite): Arah {
  const n = Number(s.frame.name);
  return Number.isFinite(n) ? URUT_ARAH[Math.floor(n / 4) % 4] : 'down';
}

/**
 * Senter di malam hari: tiap warga dan pemain mengeluarkan senter begitu
 * langitnya gelap. Senternya kelihatan di tangan, sorotnya jatuh ke tanah di
 * depan mereka mengikuti arah hadap — jadi di malam hari tiap orang yang
 * berjalan membawa lingkaran terangnya sendiri, dan pemain bisa melihat ke
 * mana warga lain sedang menghadap dari jauh.
 *
 * Kecerahannya ikut `gelap()` (0 siang, 1 malam): senja memunculkannya
 * pelan-pelan, bukan menyalakannya mendadak.
 */
export class Senter {
  private daftar: Pemegang[] = [];

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    if (!tx.exists('senter_sorot')) {
      // kerucut cahaya mengarah ke kanan, pangkalnya di tepi kiri tengah
      const W = 64;
      const H = 44;
      const kanvas = tx.createCanvas('senter_sorot', W, H)!;
      const ctx = kanvas.getContext();
      const img = ctx.createImageData(W, H);
      const buka = 0.42;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dy = y + 0.5 - H / 2;
          const jarak = Math.hypot(x, dy);
          const sudut = Math.abs(Math.atan2(dy, x + 2));
          if (sudut > buka || jarak > W) continue;
          const a = Math.pow(1 - jarak / W, 1.1) * Math.pow(1 - sudut / buka, 0.7);
          const i = (y * W + x) * 4;
          img.data[i] = 255;
          img.data[i + 1] = 238;
          img.data[i + 2] = 186;
          img.data[i + 3] = Math.round(a * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
      kanvas.refresh();
    }
    // senternya sendiri: badan abu-abu, kaca kuning menyala di ujung
    spritesheetTeks(this.scene, 'senter_datar', [['kkkk.', 'kggyY', 'kkkk.']], {
      k: '#23232e',
      g: '#8a8f9c',
      y: '#ffe27a',
      Y: '#fff6c8',
    });
    spritesheetTeks(this.scene, 'senter_tegak', [['kgk', 'kgk', 'kgk', 'kyk', '.Y.']], {
      k: '#23232e',
      g: '#8a8f9c',
      y: '#ffe27a',
      Y: '#fff6c8',
    });
  }

  /**
   * Beri seseorang senter. `arah` default dibaca dari nomor frame-nya;
   * `aktif` = false menyimpan senternya (pemain yang sedang tidur atau main HP).
   */
  pegang(s: Phaser.GameObjects.Sprite, arah: () => Arah = () => arahDariFrame(s), aktif: () => boolean = () => true) {
    const sorot = this.scene.add
      .image(0, 0, 'senter_sorot')
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_SOROT)
      .setVisible(false);
    const alat = this.scene.add.image(0, 0, 'senter_datar').setVisible(false);
    this.daftar.push({ s, arah, aktif, sorot, alat });
  }

  private detak() {
    const g = this.gelap();
    for (const p of this.daftar) {
      const nyala = g > 0.08 && p.s.active && p.s.visible && p.aktif();
      p.sorot.setVisible(nyala);
      p.alat.setVisible(nyala);
      if (!nyala) continue;
      const arah = p.arah();
      const t = TANGAN[arah];
      // pusat frame, apa pun origin sprite-nya
      const cx = p.s.x + (0.5 - p.s.originX) * p.s.displayWidth;
      const cy = p.s.y + (0.5 - p.s.originY) * p.s.displayHeight;
      const hx = cx + t.x;
      const hy = cy + t.y;
      p.sorot
        .setPosition(hx, hy)
        .setAngle(t.sudut)
        .setAlpha(Math.min(1, g) * 0.6);
      const tegak = arah === 'down' || arah === 'up';
      p.alat
        .setTexture(tegak ? 'senter_tegak' : 'senter_datar')
        .setFlipX(arah === 'left')
        .setFlipY(arah === 'up')
        .setPosition(hx, hy + (tegak ? 0 : 0))
        .setAlpha(Math.min(1, g * 2))
        // menghadap atas: senternya di depan badan, jadi tertutup punggung
        .setDepth(p.s.depth + (arah === 'up' ? -0.1 : 0.1));
    }
  }
}
