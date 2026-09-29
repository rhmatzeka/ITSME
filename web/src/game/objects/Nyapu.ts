import Phaser from 'phaser';
import { srek } from '../bunyi';
import { NYAPU, PLAYER, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatRupa } from './Rupa';
import { bisaDiajak } from './Warga';

/** Jam menyapu: pagi dan sore, menurut jam desa. */
const JAM = [
  [5.5, 10.5],
  [15, 17.5],
];

/** Maju sambil menyapu, px/detik — pelan. */
const LAJU = 5;

/** Satu ayunan sapu, ms. */
const AYUN = 300;

/**
 * Nenek yang menyapu halaman tanah di timur rumah Projects dengan sapu
 * lidi, pagi dan sore — kebiasaan di desa sebelum tamu datang dan sebelum
 * magrib. Ia maju pelan menyusuri halaman, sapunya berayun kiri-kanan di
 * depan kakinya, debu dan daun kering terdorong ke tumpukan di ujung, lalu
 * berbalik. Di luar jam itu (dan saat gerimis) ia di dalam rumah.
 */
export class Nyapu {
  private s: Phaser.GameObjects.Sprite;
  private sapu: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Sprite;
  private tumpukan: Phaser.GameObjects.Image;
  private debu: Phaser.GameObjects.Rectangle[] = [];
  private arah = 1;
  private hadir = 0;
  private berhenti = 0;
  private jedaAyun = 0;
  private ayun = 0;

  constructor(
    private scene: Phaser.Scene,
    private jam: () => number,
    private gelap: () => number
  ) {
    this.buatTekstur();
    const { x0, kaki } = NYAPU;
    this.s = scene.add.sprite(x0, kaki - PLAYER.baseY, 'nenek', 8).setDepth(kedalaman(kaki));
    this.bayang = scene.add.sprite(x0, kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(kaki) - 0.5);
    this.sapu = scene.add.sprite(x0, kaki, 'sapu_lidi', 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki) + 0.1);
    this.tumpukan = scene.add.image(NYAPU.x1 + 9, kaki, 'tumpukan_daun').setOrigin(0.5, 1).setDepth(kedalaman(kaki) - 1);
    for (let i = 0; i < 6; i++) this.debu.push(scene.add.rectangle(0, 0, 1, 1, 0xd9b27a).setVisible(false));
    bisaDiajak(scene, this.s, 'Grandma', [
      'Good morning, dear! A clean yard is a welcoming yard.',
      'The leaves fall every day, so I sweep every day. That is village life.',
    ]);
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    // nenek: rambut putih disanggul, kebaya hijau, kain batik cokelat
    buatRupa(s, 'player', 'nenek', {
      tukar: {
        '#f79617': '#e6e6ea',
        '#fb6b1d': '#b9b9c2',
        '#f9c22b': '#f7f7fa',
        '#fdcbb0': '#d9a07a',
        '#fca790': '#b98260',
        '#e83b3b': '#4f8a5a',
        '#ae2334': '#356644',
        '#ffffff': '#e8e0c8',
        '#cd683d': '#8a5a36',
        '#9e4539': '#5e3a1f',
      },
    });
    Player.registerAnimations(s, 'nenek');
    // sapu lidi: gagang miring ke tangan, ikatan merah, lidi mengembang di tanah
    spritesheetTeks(
      s,
      'sapu_lidi',
      [
        ['..........kk', '.........kk.', '........kk..', '.......kk...', '......rr....', '....yYyY....', '..yYyYy.....', 'yYyYyY......', '.y.y.y......'],
        ['.........kk.', '........kk..', '.......kk...', '......kk....', '.....rr.....', '....yYyY....', '...yYyYy....', '..yYyYyY....', '...y.y.y....'],
      ],
      { k: '#7a4a24', r: '#c8322a', y: '#d9b870', Y: '#a8844a' }
    );
    spritesheetTeks(s, 'tumpukan_daun', [['...cy.g..', '.cyCgyc..', 'cCygcCyc.', 'CcyCgcCyc']], {
      c: '#b8743a',
      C: '#7a4a24',
      y: '#e8c24a',
      g: '#7ac04a',
    });
  }

  private jamMenyapu() {
    const j = this.jam();
    return JAM.some(([a, b]) => j >= a && j < b) && this.gelap() < 0.3 && cuaca.hujan < 0.2;
  }

  private detak(t: number, delta: number) {
    this.hadir = Phaser.Math.Clamp(this.hadir + (this.jamMenyapu() ? 1 : -1) * (delta / 800), 0, 1);
    const ada = this.hadir > 0;
    this.s.setVisible(ada).setAlpha(this.hadir);
    this.sapu.setVisible(ada).setAlpha(this.hadir);
    this.bayang.setVisible(ada).setAlpha(this.hadir * BAYANGAN_KAKI);
    if (this.s.input) this.s.input.enabled = this.hadir > 0.5;
    if (!ada) return;

    const kaki = NYAPU.kaki;
    if (t < this.berhenti) {
      this.s.play(`nenek_idle_${this.arah > 0 ? 'right' : 'left'}`, true);
      this.pasangSapu(kaki);
      return;
    }
    // maju pelan; di ujung halaman berhenti sebentar lalu berbalik
    this.s.x += this.arah * LAJU * (Math.min(delta, 50) / 1000);
    if (this.s.x > NYAPU.x1 || this.s.x < NYAPU.x0) {
      this.s.x = Phaser.Math.Clamp(this.s.x, NYAPU.x0, NYAPU.x1);
      this.arah *= -1;
      this.berhenti = t + Phaser.Math.Between(1500, 3000);
    }
    this.s.play(`nenek_walk_${this.arah > 0 ? 'right' : 'left'}`, true);
    this.s.anims.timeScale = 0.35;
    if ((this.jedaAyun -= delta) <= 0) {
      this.jedaAyun = AYUN;
      this.ayun ^= 1;
      if (this.ayun && this.hadir > 0.9) {
        srek(this.s.x + this.arah * 8, kaki);
        this.kepul(this.s.x + this.arah * 10, kaki);
      }
    }
    this.pasangSapu(kaki);
  }

  /** Sapu di depan kaki, lidinya menyentuh tanah; ikut dicerminkan ke arah hadap. */
  private pasangSapu(kaki: number) {
    const x = this.s.x;
    this.sapu.setPosition(x + this.arah * 7, kaki).setFrame(this.ayun).setFlipX(this.arah > 0);
    this.bayang.setPosition(x, kaki - 1);
  }

  /** Debu tanah yang tersapu ke depan. */
  private kepul(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const d = this.debu.find((r) => !r.visible);
      if (!d) return;
      d.setPosition(x + Phaser.Math.Between(-2, 2), y - 1).setVisible(true).setAlpha(0.7).setDepth(kedalaman(y) + 0.2);
      this.scene.tweens.add({
        targets: d,
        x: d.x + this.arah * Phaser.Math.Between(3, 7),
        y: d.y - Phaser.Math.Between(1, 3),
        alpha: 0,
        duration: 450,
        onComplete: () => d.setVisible(false),
      });
    }
  }
}
