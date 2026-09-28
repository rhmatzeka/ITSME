import Phaser from 'phaser';
import { tokek } from '../bunyi';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const UCAP = ['Tokek! ...tokek! ...tokek!', 'Tokek. Tokek. (It is counting something.)', 'Tok... kek.'];

/**
 * Tokek di dinding rumah Contact, di samping jendela yang terang — tempat
 * serangga malam berkumpul. Muncul setelah gelap. Sesekali ia merayap
 * sejengkal naik atau turun, dan kira-kira tiap menit berbunyi
 * "tok-kek… tok-kek…" beberapa kali, makin lambat; badannya menggembung di
 * tiap "tok-kek". Diklik, ia langsung bersuara.
 */
export class Tokek {
  private s: Phaser.GameObjects.Sprite;
  private hadir = 0;
  private jedaSuara = 15000;
  private jedaRayap = 4000;
  private bersuara = false;
  private ucap = 0;
  private readonly y0: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    dasar: number,
    private gelap: () => number
  ) {
    const badan = (leher: string, perut: string) => [
      '..kkk..',
      '.kegek.',
      leher,
      'k.kgk.k',
      'kkgsgkk',
      '..kgk..',
      perut,
      '..ksk..',
      'kkgggkk',
      'k.kgk.k',
      '..kgk..',
      '...gk..',
      '...k...',
    ];
    spritesheetTeks(scene, 'tokek', [badan('.kgggk.', '..kgk..'), badan('.kgwgk.', '.kgggk.')], {
      k: '#2a2a3a',
      g: '#8fa0b8',
      s: '#e0823a',
      e: '#f0d040',
      w: '#d8e0ea',
    });
    this.y0 = y;
    this.s = scene.add.sprite(x, y, 'tokek', 0).setDepth(kedalaman(dasar) + 0.5).setVisible(false);
    this.s.setInteractive({ useHandCursor: true });
    this.s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      if (this.hadir < 0.5) return;
      this.berbunyi(Phaser.Math.Between(3, 5));
      scene.game.events.emit('mapporto:ucap', { msg: UCAP[this.ucap++ % UCAP.length], siapa: this.s, nama: 'Gecko' });
    });
    scene.events.on('update', this.detak, this);
  }

  private berbunyi(ulang: number) {
    if (this.bersuara) return;
    this.bersuara = true;
    const jadwal = tokek(this.s.x, this.s.y, ulang);
    for (const w of jadwal) {
      const ms = w * 1000;
      this.scene.time.delayedCall(ms, () => this.s.setFrame(1));
      this.scene.time.delayedCall(ms + 300, () => this.s.setFrame(0));
    }
    this.scene.time.delayedCall(jadwal[jadwal.length - 1] * 1000 + 600, () => (this.bersuara = false));
  }

  private detak(_t: number, delta: number) {
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.6) / 0.25, 0, 1);
    this.s.setVisible(this.hadir > 0).setAlpha(this.hadir);
    if (this.hadir < 1 || this.bersuara) return;
    if ((this.jedaSuara -= delta) <= 0) {
      this.jedaSuara = Phaser.Math.Between(45000, 80000);
      this.berbunyi(Phaser.Math.Between(4, 7));
      return;
    }
    if ((this.jedaRayap -= delta) <= 0) {
      this.jedaRayap = Phaser.Math.Between(5000, 12000);
      // merayap sejengkal, tidak pernah jauh dari tempatnya
      const ke = this.y0 + Phaser.Math.Between(-3, 3);
      this.scene.tweens.add({ targets: this.s, y: ke, duration: Math.abs(ke - this.s.y) * 180 + 100, ease: 'Stepped', easeParams: [3] });
    }
  }
}
