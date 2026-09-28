import Phaser from 'phaser';
import { byur, cicitKatrol, tetes } from '../bunyi';
import { ABOUT, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const PALET = {
  k: '#2a2420', r: '#d0643e', R: '#9a3e26', q: '#e88a5a', b: '#b07840', B: '#7a4a24', c: '#d6a06a',
  a: '#c9c3b6', A: '#8f897e', L: '#e0dace', n: '#aaa498', N: '#7d776c', w: '#1e3550', W: '#3a6a90',
  v: '#9ad8f5', s: '#9a9eaa', S: '#6a6e7a', h: '#5aa04a', H: '#3e7a36',
};

/**
 * Sumur 30×40, dibelah di garis tengah bibirnya: bagian belakang (atap,
 * tiang, palang, bibir belakang, air) dan dinding depan. Digambar di
 * scratchpad sumur2.py: bentuk dasar lalu garis tepi otomatis, lalu sisik
 * genteng, kilau tiang, batu bulat, dan rumput.
 */
const BELAKANG = [
    '..........kkkkkkkkkk..........',
    '........kkqqqqqqqqqqkk........',
    '......kkrqrqrqrqrqrqrqkk......',
    '....kkRrrRrrRrrRrrRrrRrrkk....',
    '...krrrrrrrrrrrrrrrrrrrrrrkk..',
    '.kkrRrrRrrRrrRrrRrrRrrRrrRrrk.',
    'krrrrrrrrrrrrrrrrrrrrrrrrrrrrk',
    'krRrrRrrRrrRrrRrrRrrRrrRrrRrrk',
    'kRRRRRRRRRRRRRRRRRRRRRRRRRRRRk',
    '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbk..',
    '..kcBBBBBBBBBBBBBBBBBBBBBBBk..',
    '..kcbBkkkkkkkkkkkkkkkkkkcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk................kcbBk..',
    '..kcbBk.kkkkkkkkkkkkkk.kcbBk..',
    '..kcbBkkaaaaaaaaaaaaaakkcbBk..',
    '..kcbBaaaaaaaaaaaaaaaaaacbBk..',
    '.kacbBawWWWWWWWWWWWWWWwacbBak.',
    '.kacbBwwwwwwwwwwwwwwwwwwcbBak.',
    '.kaaawwwwwwvvwwwwwwwwwwwwaaak.',
];
const DEPAN = [
    '.kaaaawwwwwwwwwwwwwvwwwwaaaak.',
    '.knnLLLLLwwwwwwwwwwwwLLLLLnnk.',
    '.kLLLLnnLLLLLLLLLLLLLLNNNNNNk.',
    '.kLLLLAnnnnnAnnnnnAnnnNNANNNk.',
    '.kLLLLAnnnnnAnnnnnAnnnNNANNNk.',
    '.kAAAAAAAAAAAAAAAAAAAAAAAAAAk.',
    '.kLALLnnnAnnnnnAnnnnnANNNNNAk.',
    '.kLALLnnnAnnnnnAnnnnnANNNNNAk.',
    '.khAAAAAAAAAAAAAAAAAAAAAAAAhk.',
    '.hHhLLnnnnnnnnnnnnnnnnNNNNhHh.',
    '...kkkknnnhnnnnnnnnnnnNkkkk...',
    '.......kkhHkkkkkkkkkhkk.......',
];

/** Jarak tali dari katrol ke ember, px: saat ember tergantung dan saat masuk ke air. */
const TALI = { atas: 2 };

const KATA = [
  'Cool, fresh well water. Nothing beats it on a hot afternoon.',
  'The whole village still draws water from this old well.',
  'Splash! The bucket comes up full every time.',
];

/**
 * Sumur timba di halaman barat daya rumah About: bibir batu, dua tiang kayu
 * beratap genteng, katrol, dan ember di ujung tali.
 *
 * Diklik, embernya diulur turun ke dalam sumur — katrolnya berputar, air
 * memercik — lalu ditarik naik penuh air yang menetes. Gambarnya dibelah
 * dua: bagian belakang (atap, tiang, bibir belakang, air) dan dinding depan.
 * Ember yang turun lewat di antara keduanya, jadi ia benar-benar hilang ke
 * dalam sumur, bukan menembus dindingnya.
 */
export class Sumur {
  private ember: Phaser.GameObjects.Sprite;
  private katrol: Phaser.GameObjects.Sprite;
  private tali: Phaser.GameObjects.Graphics;
  private sibuk = false;
  private kata = 0;
  private readonly x: number;
  private readonly kaki: number;
  /** Ujung bawah katrol, tempat tali mulai. */
  private readonly pangkal: number;
  /** Permukaan air di dalam sumur. */
  private readonly air: number;

  constructor(
    private scene: Phaser.Scene,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { x, kaki } = ABOUT.sumur;
    this.x = x;
    this.kaki = kaki;
    const d = kedalaman(kaki);
    const atas = kaki - DEPAN.length - BELAKANG.length;
    this.air = atas + 26;
    scene.add.image(x, kaki - DEPAN.length, 'sumur_belakang').setOrigin(0.5, 1).setDepth(d - 0.4);
    // katrol tergantung di bawah palang, tepat di tengah; talinya turun dari tepi bawahnya
    this.katrol = scene.add.sprite(x - 3, atas + 12, 'katrol', 0).setOrigin(0).setDepth(d - 0.3);
    this.pangkal = atas + 18;
    this.tali = scene.add.graphics().setDepth(d - 0.2);
    // ember 7 piksel: pusatnya di tengah piksel, segaris dengan tali
    this.ember = scene.add
      .sprite(x - 0.5, this.pangkal + TALI.atas, 'ember', 0)
      .setOrigin(0.5, 0)
      .setDepth(d - 0.1);
    scene.add.image(x, kaki, 'sumur_depan').setOrigin(0.5, 1).setDepth(d);
    this.gambarTali();

    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 6, 28, 10);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    const zona = scene.add
      .zone(x, kaki - 20, 30, 40)
      .setInteractive({ useHandCursor: true })
      .setDepth(d + 1);
    zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.timba();
    });
  }

  private buatTekstur() {
    const s = this.scene;
    spritesheetTeks(s, 'sumur_belakang', [BELAKANG], PALET);
    spritesheetTeks(s, 'sumur_depan', [DEPAN], PALET);
    // katrol 6×6 dengan dua jari-jari yang bergantian — terbaca berputar
    spritesheetTeks(
      s,
      'katrol',
      [
        ['.kkkk.', 'kssssk', 'ksSask', 'ksaSsk', 'kssssk', '.kkkk.'],
        ['.kkkk.', 'kssssk', 'ksaSsk', 'ksSask', 'kssssk', '.kkkk.'],
      ],
      PALET
    );
    // ember kayu berpelipit besi: kosong, lalu penuh air
    spritesheetTeks(
      s,
      'ember',
      [
        ['.kkkkk.', 'kbccbbk', 'kSSSSSk', 'kbccbbk', '.kbbbk.', '..kkk..'],
        ['.kkkkk.', 'kvWvWvk', 'kSSSSSk', 'kbccbbk', '.kbbbk.', '..kkk..'],
      ],
      PALET
    );
  }

  private gambarTali() {
    const panjang = this.ember.y - this.pangkal;
    this.tali.clear().fillStyle(0x6a4a2a, 1).fillRect(this.x - 1, this.pangkal, 1, panjang);
  }

  /** Ulur ember ke air, tunggu sebentar, tarik naik penuh air. */
  private timba() {
    if (this.sibuk) return;
    this.sibuk = true;
    const s = this.scene;
    const atas = this.pangkal + TALI.atas;
    // ember turun sampai seluruhnya di balik dinding depan
    const bawah = this.air + 3;
    // katrol berderit tiap setengah putaran
    const putar = s.time.addEvent({
      delay: 110,
      loop: true,
      callback: () => {
        const f = this.katrol.frame.name === '0' ? 1 : 0;
        this.katrol.setFrame(f);
        if (f) cicitKatrol(this.x, this.kaki - 20);
      },
    });
    s.tweens.add({
      targets: this.ember,
      y: bawah,
      duration: 1000,
      ease: 'Sine.easeIn',
      onUpdate: () => this.gambarTali(),
      onComplete: () => {
        putar.paused = true;
        this.percik();
        this.ember.setFrame(1);
        s.tweens.add({
          targets: this.ember,
          y: atas,
          delay: 600,
          duration: 1300,
          ease: 'Sine.easeOut',
          onStart: () => (putar.paused = false),
          onUpdate: () => this.gambarTali(),
          onComplete: () => {
            putar.remove();
            this.tetes();
            s.game.events.emit('mapporto:ucap', { msg: KATA[this.kata++ % KATA.length], siapa: this.ember, nama: 'Well' });
            s.time.delayedCall(2600, () => {
              this.ember.setFrame(0);
              this.sibuk = false;
            });
          },
        });
      },
    });
  }

  /** Cipratan kecil di permukaan air saat ember menyentuhnya. */
  private percik() {
    byur(this.x, this.kaki, 0.6);
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add
        .rectangle(this.x + Phaser.Math.Between(-5, 4), this.air, 1, 1, 0x9ad8f5)
        .setDepth(this.ember.depth + 0.05);
      this.scene.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(3, 6),
        x: p.x + Phaser.Math.Between(-2, 2),
        alpha: 0,
        duration: 450,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Air menetes dari dasar ember yang baru naik, jatuh kembali ke sumur. */
  private tetes() {
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 380, () => {
        this.scene.time.delayedCall(420, () => tetes(this.x, this.kaki));
        const t = this.scene.add
          .rectangle(this.x - 3 + Phaser.Math.Between(0, 4), this.ember.y + 6, 1, 1, 0x78c8f0)
          .setDepth(this.ember.depth);
        this.scene.tweens.add({
          targets: t,
          y: this.air + 1,
          duration: 420,
          ease: 'Quad.easeIn',
          onComplete: () => t.destroy(),
        });
      });
    }
  }
}
