import Phaser from 'phaser';
import { tok } from '../bunyi';
import { DEPTH, PLAYER, TILE, kedalaman, type Dir } from '../config';
import { Player } from './Player';
import { BAYANGAN_KAKI, Kisi, bayanganKaki } from './piksel';
import { buatRupa } from './Rupa';
import type { Senter } from './Senter';
import { bisaDiajak } from './Warga';

/** Laju berjalan hansip, px/detik: pelan, sedang berkeliling, bukan mengejar. */
const LAJU = 26;

/**
 * Hansip yang berkeliling desa di malam hari.
 *
 * Bapak ronda tetap duduk di posnya; yang ini berjalan. Tiap satu-dua
 * menit ia berangkat dari pos ronda, menyusuri jalan dari pintu rumah ke
 * pintu rumah — rutenya dicari di atas grid tabrakan yang sama dengan kurir,
 * jadi ia selalu lewat jalan dan jembatan — senternya menyorot ke depan,
 * dan tiap beberapa langkah ia memukul kentongan kecil di tangannya:
 * "tok-tok". Selesai berkeliling ia kembali ke pos, lalu menghilang ke
 * dalamnya sampai giliran berikutnya.
 */
export class Hansip {
  readonly s: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Sprite;
  private rute: Phaser.Math.Vector2[] = [];
  private ke = 0;
  private jalan = false;
  private berikut = 0;
  private jedaTok = 0;

  constructor(
    private scene: Phaser.Scene,
    private kisi: Kisi,
    /** Petak-petak yang disinggahi berurutan; yang pertama = pos ronda (awal dan akhir). */
    private singgah: [number, number][],
    private gelap: () => number,
    senter?: Senter
  ) {
    // hansip: topi dan seragam hijau tua, lencana kuning, celana hijau
    buatRupa(scene, 'player', 'hansip', {
      topi: ['#3e4a28', '#2a3318'],
      kumis: '#1b1920',
      tukar: {
        '#f79617': '#2d2a33',
        '#fb6b1d': '#1b1920',
        '#f9c22b': '#4d4857',
        '#fdcbb0': '#c68b5e',
        '#fca790': '#a46d45',
        '#e83b3b': '#56703a',
        '#ae2334': '#3c5228',
        '#ffffff': '#e0c050',
        '#cd683d': '#3e4a28',
        '#9e4539': '#2a3318',
      },
    });
    Player.registerAnimations(scene, 'hansip');
    const [tx, ty] = singgah[0];
    const a = this.tengah(tx, ty);
    this.s = scene.add.sprite(a.x, a.y, 'hansip', 0).setVisible(false);
    this.bayang = scene.add.sprite(a.x, a.y + PLAYER.baseY - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setVisible(false);
    senter?.pegang(this.s);
    bisaDiajak(scene, this.s, 'Hansip', [
      'Evening! Just doing my rounds. Every house is safe tonight — even the one with all the code.',
      'Tok-tok! That is how we tell the village all is well.',
    ]);
    this.berikut = scene.time.now + 12000;
    scene.events.on('update', this.detak, this);
  }

  /** Pusat sprite untuk berdiri di sebuah petak (kakinya di dasar petak). */
  private tengah(tx: number, ty: number) {
    return new Phaser.Math.Vector2(tx * TILE + TILE / 2, (ty + 1) * TILE - 2 - PLAYER.baseY);
  }

  /** Susun rute lengkap: pos → tiap pintu → kembali ke pos. */
  private rencanakan() {
    const titik = [...this.singgah, this.singgah[0]];
    this.rute = [];
    for (let i = 0; i < titik.length - 1; i++) {
      const j = this.kisi.jalur(titik[i], titik[i + 1]);
      if (!j) continue;
      this.rute.push(...j.slice(i ? 1 : 0).map(([x, y]) => this.tengah(x, y)));
    }
    this.ke = 0;
  }

  private detak(t: number, delta: number) {
    const s = this.s;
    const malam = this.gelap() > 0.6;
    if (!this.jalan) {
      if (!malam || t < this.berikut) return;
      this.rencanakan();
      if (this.rute.length < 2) {
        this.berikut = t + 60000;
        return;
      }
      this.jalan = true;
      s.setPosition(this.rute[0].x, this.rute[0].y).setVisible(true).setAlpha(0);
      this.bayang.setVisible(true);
      this.scene.tweens.add({ targets: s, alpha: 1, duration: 500 });
      this.jedaTok = 800;
    }

    const target = this.rute[this.ke];
    if (!target) {
      // kembali di pos: masuk, menghilang sampai giliran berikutnya
      this.jalan = false;
      this.berikut = t + Phaser.Math.Between(60000, 120000);
      s.play('hansip_idle_down', true);
      this.scene.tweens.add({
        targets: s,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          s.setVisible(false);
          this.bayang.setVisible(false);
        },
      });
      return;
    }
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const jarak = Math.hypot(dx, dy);
    const langkah = (LAJU * Math.min(delta, 100)) / 1000;
    if (jarak <= langkah) {
      s.setPosition(target.x, target.y);
      this.ke++;
    } else {
      s.x += (dx / jarak) * langkah;
      s.y += (dy / jarak) * langkah;
      const arah: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      s.play(`hansip_walk_${arah}`, true);
    }
    const d = kedalaman(s.y + PLAYER.baseY);
    s.setDepth(d);
    this.bayang.setPosition(s.x, s.y + PLAYER.baseY - 1).setDepth(d - 0.5).setAlpha(BAYANGAN_KAKI * s.alpha);

    // "tok-tok" tiap beberapa langkah
    if ((this.jedaTok -= delta) <= 0) {
      this.jedaTok = Phaser.Math.Between(2600, 3600);
      this.tokTok();
    }
  }

  private tokTok() {
    for (let i = 0; i < 2; i++) {
      this.scene.time.delayedCall(i * 300, () => {
        if (!this.s.visible) return;
        tok(this.s.x, this.s.y, 240);
        if (!this.scene.textures.exists('tok')) return;
        const m = this.scene.add
          .image(this.s.x + 7, this.s.y + 2, 'tok')
          .setDepth(DEPTH.above + 20)
          .setScale(0.5);
        this.scene.tweens.add({ targets: m, scale: 1, alpha: 0, duration: 380, onComplete: () => m.destroy() });
      });
    }
  }
}
