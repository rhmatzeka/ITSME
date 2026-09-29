import Phaser from 'phaser';
import { DEPTH, POHON } from '../config';
import { cuaca } from '../cuaca';
import { spritesheetTeks } from './piksel';

/** Berapa helai daun yang boleh ada sekaligus — yang sudah mendarat ikut dihitung. */
const JUMLAH = 12;

interface Helai {
  s: Phaser.GameObjects.Sprite;
  x0: number;
  y: number;
  tanah: number;
  fase: number;
  ragam: number;
  jatuh: boolean;
}

/**
 * Daun yang gugur pelan dari tajuk pohon.
 *
 * Tiap helai melayang turun sambil berayun kiri-kanan dan berbalik
 * (dua frame: sisi atas dan sisi bawah daunnya), mendarat di rumput di
 * bawah pohonnya, diam sebentar, lalu memudar. Hijau, kuning, dan cokelat
 * bercampur. Hanya pohon yang sedang terlihat yang menggugurkan daun, dan
 * saat gerimis angin membawa lebih banyak.
 */
export class Daun {
  private helai: Helai[] = [];

  constructor(private scene: Phaser.Scene) {
    // tiga ragam × dua sisi, 3×2 piksel
    const d = (a: string, b: string) => [
      [`${a}${a}.`, `.${b}${a}`],
      [`.${b}${b}`, `${b}${a}.`],
    ];
    spritesheetTeks(scene, 'daun_gugur', [...d('g', 'G'), ...d('y', 'Y'), ...d('c', 'C')], {
      g: '#7ac04a',
      G: '#4f8a34',
      y: '#e8c24a',
      Y: '#b8902a',
      c: '#b8743a',
      C: '#7a4a24',
    });
    for (let i = 0; i < JUMLAH; i++) {
      const s = scene.add.sprite(0, 0, 'daun_gugur', 0).setVisible(false);
      this.helai.push({ s, x0: 0, y: 0, tanah: 0, fase: 0, ragam: 0, jatuh: false });
    }
    const jadwal = scene.time.addEvent({ delay: 650, loop: true, callback: () => this.gugurkan() });
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => jadwal.remove());
  }

  private gugurkan() {
    if (Math.random() > 0.45 + cuaca.hujan * 0.5) return;
    const v = this.scene.cameras.main.worldView;
    const tampak = POHON.filter((p) => p.x + p.r > v.left && p.x - p.r < v.right && p.y + p.r > v.top && p.y - p.r < v.bottom);
    if (!tampak.length) return;
    const h = this.helai.find((o) => !o.s.visible);
    if (!h) return;
    const p = Phaser.Utils.Array.GetRandom(tampak);
    h.x0 = p.x + Phaser.Math.Between(-p.r, p.r);
    h.y = p.y + Phaser.Math.Between(-Math.round(p.r / 2), Math.round(p.r / 3));
    h.tanah = p.y + p.r + Phaser.Math.Between(2, 12);
    h.fase = Math.random() * Math.PI * 2;
    h.ragam = Phaser.Math.Between(0, 2);
    h.jatuh = true;
    h.s.setVisible(true).setAlpha(1).setDepth(DEPTH.above + 4).setPosition(h.x0, h.y);
  }

  private detak(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const z = this.scene.cameras.main.zoom;
    for (const h of this.helai) {
      if (!h.jatuh) continue;
      h.y += (7 + cuaca.hujan * 6) * dt;
      h.fase += dt * 2.6;
      // berayun makin lebar di tengah jalan, angin sedikit mendorong ke timur
      const x = h.x0 + Math.sin(h.fase) * 4 + (h.y - h.tanah + 30) * 0.08;
      h.s
        .setPosition(Math.round(x * z) / z, Math.round(h.y * z) / z)
        .setFrame(h.ragam * 2 + (Math.cos(h.fase) > 0 ? 0 : 1));
      if (h.y < h.tanah) continue;
      // mendarat: berbaring di tanah, lalu memudar
      h.jatuh = false;
      h.s.setDepth(DEPTH.below + 0.5);
      this.scene.tweens.add({
        targets: h.s,
        alpha: 0,
        delay: Phaser.Math.Between(4000, 8000),
        duration: 900,
        onComplete: () => h.s.setVisible(false),
      });
    }
  }
}
