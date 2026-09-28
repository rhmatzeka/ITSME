import Phaser from 'phaser';
import { huhu } from '../bunyi';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Dahan dan burung hantunya di atas tajuk pohon (layer `di atas map 1` =
 * DEPTH.above), di bawah tirai malam. Dahannya lebih dulu, burung hantunya
 * di depan — cakarnya mencengkeram kulit dahan.
 */
const KEDALAMAN = DEPTH.above + 2;
/** Pendar mata: di atas tirai, bersama cahaya lampu. */
const KEDALAMAN_MATA = DEPTH.above + 62;

const F = { melek: 0, kedip: 1, lirik: 2, bersuara: 3 } as const;

const UCAP = ['Hoo... hooo.', 'Hoo-hoo! *blinks slowly*', 'Hooo. The night is young.'];

/**
 * Burung hantu di pohon sebelah barat rumah About.
 *
 * Ia bertengger di sebatang dahan yang menjulur dari sisi kiri tajuknya —
 * bukan di pucuk pohon: burung hantu yang ditaruh di atas tajuk terbaca
 * seperti kotak yang ditempel. Dahannya ada sepanjang hari; burung hantunya
 * datang begitu gelap. Jambul telinganya tegak, piringan wajahnya pucat,
 * matanya besar kuning dengan pupil hitam, dadanya berbintik, sayapnya
 * terlipat di sisi, cakarnya mencengkeram dahan.
 *
 * Sesekali ia mengedip dan melirik ke samping, dan tiap setengah menit
 * lebih ber-"hu-huu" — lehernya menggembung, paruhnya terbuka, matanya
 * menyala di kegelapan. Diklik, ia ber-"hu-huu" saat itu juga.
 */
export class BurungHantu {
  private s: Phaser.GameObjects.Sprite;
  private mata: Phaser.GameObjects.Image[];
  private hadir = 0;
  private jedaSuara = 6000;
  private jedaTingkah = 2000;
  private bersuara = false;
  private ucap = 0;

  /**
   * `pangkal` = titik dahan menempel di tepi tajuk (ujung kanan-bawah
   * gambarnya); dahannya menjulur ke kiri dari sana.
   */
  constructor(
    private scene: Phaser.Scene,
    pangkal: { x: number; y: number },
    private gelap: () => number
  ) {
    spritesheetTeks(
      scene,
      'burung_hantu',
      [
        [
          '..k.......k..',
          '..kk.....kk..',
          '..kbk...kbk..',
          '.kbbbkkkbbbk.',
          '.kbwwwbwwwbk.',
          'kbwEEwbwEEwbk',
          'kbwEPwbwPEwbk',
          '.kbwwwowwwbk.',
          '.kBbbbobbbBk.',
          'kBbbCbbbCbbBk',
          'kBbCbbCbbCbBk',
          'kBBbbCbCbbBBk',
          '.kBbbbbbbbBk.',
          '..kkykkkykk..',
        ],
        [
          '..k.......k..',
          '..kk.....kk..',
          '..kbk...kbk..',
          '.kbbbkkkbbbk.',
          '.kbwwwbwwwbk.',
          'kbwwwwbwwwwbk',
          'kbwccwbwccwbk',
          '.kbwwwowwwbk.',
          '.kBbbbobbbBk.',
          'kBbbCbbbCbbBk',
          'kBbCbbCbbCbBk',
          'kBBbbCbCbbBBk',
          '.kBbbbbbbbBk.',
          '..kkykkkykk..',
        ],
        [
          '..k.......k..',
          '..kk.....kk..',
          '..kbk...kbk..',
          '.kbbbkkkbbbk.',
          '.kbwwwbwwwbk.',
          'kbwEEwbwEEwbk',
          'kbwPEwbwPEwbk',
          '.kbwwwowwwbk.',
          '.kBbbbobbbBk.',
          'kBbbCbbbCbbBk',
          'kBbCbbCbbCbBk',
          'kBBbbCbCbbBBk',
          '.kBbbbbbbbBk.',
          '..kkykkkykk..',
        ],
        [
          '..k.......k..',
          '..kk.....kk..',
          '..kbk...kbk..',
          '.kbbbkkkbbbk.',
          '.kbwwwbwwwbk.',
          'kbwEEwbwEEwbk',
          'kbwEPwbwPEwbk',
          '.kbwwwOwwwbk.',
          '.kBbwwOwwbBk.',
          'kBbbCbbbCbbBk',
          'kBbCbbCbbCbBk',
          'kBBbbCbCbbBBk',
          '.kBbbbbbbbBk.',
          '..kkykkkykk..',
        ],
      ],
      { k: '#2a1c14', b: '#8a6038', B: '#5e3e22', w: '#e8d8b8', C: '#d8c090', E: '#ffc23a', P: '#1a1008', c: '#5e3e22', o: '#d89a3a', O: '#3a2418', y: '#e0a040' }
    );
    spritesheetTeks(scene, 'dahan_hantu', [[
        '.gg.......................',
        'gGGgg.....................',
        'gGlGGg....................',
        'gGGlgkkk..................',
        '.ggGgbbbkkkkkk............',
        '..kBbbbbbbbbbbkkkkkkkk....',
        '...kkBBBbbbbbbbbbbbbbbkk..',
        '......kkkkBBBBBBbbbbbbbbk.',
        '..........kkkkkkBBBBBBbbk.',
        '................kkkkkkkk..',
      ]], { k: '#2a2420', b: '#8a5a32', B: '#5e3a1c', g: '#3e7a36', G: '#5aa04a', l: '#6fbf5a' });
    const dahan = scene.add.image(pangkal.x, pangkal.y, 'dahan_hantu').setOrigin(1, 1).setDepth(KEDALAMAN);
    // di permukaan atas dahan, dekat pangkalnya (gambar dahan 26×10, bertengger di baris 5)
    const x = Math.round(dahan.x - 12);
    const kaki = dahan.y - 10 + 5;
    if (!scene.textures.exists('mata_pendar')) {
      const k = scene.textures.createCanvas('mata_pendar', 16, 16)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255, 220, 90, 0.95)');
      g.addColorStop(0.35, 'rgba(255, 190, 60, 0.35)');
      g.addColorStop(1, 'rgba(255, 170, 40, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
      k.refresh();
    }
    this.s = scene.add.sprite(x, kaki, 'burung_hantu', F.melek).setOrigin(0.5, 1).setDepth(KEDALAMAN + 1).setVisible(false);
    // mata di baris 5-6, kolom 3-4 dan 8-9 frame 13×14
    this.mata = [-2.5, 2.5].map((dx) =>
      scene.add
        .image(x + dx, kaki - 14 + 6, 'mata_pendar')
        .setScale(0.45)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(KEDALAMAN_MATA)
        .setVisible(false)
    );
    this.s.setInteractive({ useHandCursor: true });
    this.s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      if (this.hadir < 0.5) return;
      this.hu();
      scene.game.events.emit('mapporto:ucap', { msg: UCAP[this.ucap++ % UCAP.length], siapa: this.s, nama: 'Owl' });
    });
    scene.events.on('update', this.detak, this);
  }

  /** "Hu... huuu": leher menggembung dan paruh terbuka di tiap suku kata. */
  private hu() {
    if (this.bersuara) return;
    this.bersuara = true;
    huhu(this.s.x, this.s.y - 8);
    const s = this.scene;
    for (const [mulai, lama] of [
      [0, 260],
      [420, 640],
    ]) {
      s.time.delayedCall(mulai, () => this.s.setFrame(F.bersuara));
      s.time.delayedCall(mulai + lama, () => this.s.setFrame(F.melek));
    }
    s.time.delayedCall(1150, () => (this.bersuara = false));
  }

  private detak(t: number, delta: number) {
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.6) / 0.25, 0, 1);
    const ada = this.hadir > 0;
    this.s.setVisible(ada).setAlpha(this.hadir);
    const f = Number(this.s.frame.name);
    // melirik: pupilnya pindah ke sisi kiri mata
    const geser = f === F.lirik ? -0.7 : 0;
    this.mata.forEach((m, i) =>
      m
        .setVisible(ada && f !== F.kedip)
        .setX(this.s.x + (i ? 2.5 : -2.5) + geser)
        .setAlpha(this.hadir * (0.7 + 0.15 * Math.sin(t / 600)))
    );
    if (this.hadir < 1 || this.bersuara) return;
    if ((this.jedaSuara -= delta) <= 0) {
      this.jedaSuara = Phaser.Math.Between(22000, 42000);
      this.hu();
      return;
    }
    if ((this.jedaTingkah -= delta) <= 0) {
      this.jedaTingkah = Phaser.Math.Between(1200, 3500);
      if (Math.random() < 0.6) {
        this.s.setFrame(F.kedip);
        this.scene.time.delayedCall(160, () => !this.bersuara && this.s.setFrame(F.melek));
      } else {
        this.s.setFrame(F.lirik);
        this.scene.time.delayedCall(Phaser.Math.Between(900, 1800), () => !this.bersuara && this.s.setFrame(F.melek));
      }
    }
  }
}
