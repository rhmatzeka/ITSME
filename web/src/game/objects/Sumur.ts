import Phaser from 'phaser';
import { ABOUT, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

const PALET = {
  k: '#2a2420',
  r: '#c65a3a',
  R: '#8a3a26',
  b: '#a8703a',
  c: '#c89060',
  a: '#b9b3a6',
  A: '#8a847a',
  w: '#233a52',
  n: '#9a948a',
  N: '#77716a',
  s: '#8a8e9c',
  l: '#c4c8d4',
};

/** Jarak tali dari katrol ke ember, px: saat ember tergantung dan saat masuk ke air. */
const TALI = { atas: 2, bawah: 15 };

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

  constructor(
    private scene: Phaser.Scene,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { x, kaki } = ABOUT.sumur;
    this.x = x;
    this.kaki = kaki;
    const d = kedalaman(kaki);
    const bibir = kaki - 9;
    scene.add.image(x, bibir, 'sumur_belakang').setOrigin(0.5, 1).setDepth(d - 0.4);
    this.katrol = scene.add.sprite(x, bibir - 13, 'katrol', 0).setOrigin(0.5, 0).setDepth(d - 0.3);
    this.pangkal = bibir - 10;
    this.tali = scene.add.graphics().setDepth(d - 0.2);
    this.ember = scene.add.sprite(x, this.pangkal + TALI.atas, 'ember', 0).setOrigin(0.5, 0).setDepth(d - 0.1);
    scene.add.image(x, kaki, 'sumur_depan').setOrigin(0.5, 1).setDepth(d);
    this.gambarTali();

    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 5, 24, 10);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    const zona = scene.add
      .zone(x, kaki - 17, 26, 34)
      .setInteractive({ useHandCursor: true })
      .setDepth(d + 1);
    zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.timba();
    });
  }

  private buatTekstur() {
    const s = this.scene;
    spritesheetTeks(
      s,
      'sumur_belakang',
      [
        [
          '.........kkkkkk.........',
          '.......kkrrrrrrkk.......',
          '.....kkrrRrrRrrRrkk.....',
          '...kkrrRrrRrrRrrRrrkk...',
          '.kkrRrrRrrRrrRrrRrrRrkk.',
          'kRRRRRRRRRRRRRRRRRRRRRRk',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          '..kbk.kkkkkkkkkkkk.kbk..',
          '..kbk.kcccccccccck.kbk..',
          '..kbk.kkkkkkkkkkkk.kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '..kbk..............kbk..',
          '.kkbkkkkkkkkkkkkkkkkbkk.',
          'kaaAaaaAaaaaAaaaAaaaAaak',
          'kaAwwwwwwwwwwwwwwwwwwAak',
          'kaAwwwwwwwwwwwwwwwwwwAak',
        ],
      ],
      PALET
    );
    spritesheetTeks(
      s,
      'sumur_depan',
      [
        [
          'kaaaaAaaaaAaaaaaAaaaaAak',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          'knnnkNnnnnkNnnnnkNnnnnNk',
          'knnnkNnnnnkNnnnnkNnnnnNk',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          'kNnnnnkNnnnnkNnnnnkNnnnk',
          'kNnnnnkNnnnnkNnnnnkNnnnk',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          '.kkkkkkkkkkkkkkkkkkkkkk.',
        ],
      ],
      PALET
    );
    // katrol 4×4 dengan dua jari-jari yang bergantian — terbaca berputar
    spritesheetTeks(
      s,
      'katrol',
      [
        ['.kk.', 'kslk', 'klsk', '.kk.'],
        ['.kk.', 'klsk', 'kslk', '.kk.'],
      ],
      PALET
    );
    // ember kayu berpelipit besi: kosong, lalu penuh air
    spritesheetTeks(
      s,
      'ember',
      [
        ['kkkkkk', 'kbccbk', 'kssssk', 'kbccbk', '.kkkk.'],
        ['kkkkkk', 'kWWWWk', 'kssssk', 'kbccbk', '.kkkk.'],
      ],
      { ...PALET, W: '#78c8f0' }
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
    const bawah = this.kaki - 6;
    const putar = s.time.addEvent({ delay: 110, loop: true, callback: () => this.katrol.setFrame(this.katrol.frame.name === '0' ? 1 : 0) });
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
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add
        .rectangle(this.x + Phaser.Math.Between(-4, 4), this.kaki - 11, 1, 1, 0x9ad8f5)
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
        const t = this.scene.add
          .rectangle(this.x - 2 + Phaser.Math.Between(0, 3), this.ember.y + 5, 1, 1, 0x78c8f0)
          .setDepth(this.ember.depth);
        this.scene.tweens.add({
          targets: t,
          y: this.kaki - 12,
          duration: 420,
          ease: 'Quad.easeIn',
          onComplete: () => t.destroy(),
        });
      });
    }
  }
}
