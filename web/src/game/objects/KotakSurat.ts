import Phaser from 'phaser';
import { ABOUT, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Sudut bendera: tegak = ada surat, mendatar = kosong. */
const BENDERA = { naik: 0, turun: 90 };

/**
 * Kotak surat di depan rumah About, di sebelah kiri tempat kurir berdiri.
 *
 * Kurir yang sampai di pintu About tidak lagi sekadar memunculkan amplop di
 * atas kepalanya: ia menoleh ke kotak surat, amplopnya melayang masuk ke
 * celah, kotaknya bergoyang, dan bendera merahnya naik. Bendera itu tetap
 * tegak sampai kotaknya diklik — surat diambil, benderanya turun lagi.
 */
export class KotakSurat {
  private kotak: Phaser.GameObjects.Image;
  private bendera: Phaser.GameObjects.Image;
  private adaSurat = false;

  constructor(
    private scene: Phaser.Scene,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { x, kaki } = ABOUT.kotakSurat;
    const d = kedalaman(kaki);
    this.kotak = scene.add.image(x, kaki, 'kotak_surat').setOrigin(0.5, 1).setDepth(d);
    // poros bendera di pangkal tiangnya, menempel ke sisi kanan kotak
    this.bendera = scene.add
      .image(x + 5, kaki - 13, 'bendera_surat')
      .setOrigin(0, 1)
      .setAngle(BENDERA.turun)
      .setDepth(d + 0.1);
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 4, 3);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    this.kotak.setInteractive({ useHandCursor: true });
    this.kotak.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.klik();
    });
  }

  private buatTekstur() {
    // kotak hijau serupa atap rumahnya, pintu melengkung di depan, di atas tiang kayu
    spritesheetTeks(
      this.scene,
      'kotak_surat',
      [
        [
          '..kkkkk..',
          '.kGGGGGk.',
          'kGggggggk',
          'kgkkkkkdk',
          'kgk...kdk',
          'kgkkkkkdk',
          'kgggggddk',
          'kkkkkkkkk',
          '...kbk...',
          '...kbk...',
          '...kbk...',
          '...kbk...',
          '...kbk...',
          '...kbk...',
          '..kBBBk..',
          '..kkkkk..',
        ],
      ],
      { k: '#1b2416', G: '#9ee8c8', g: '#4fae8a', d: '#2f7a5e', b: '#a8703a', B: '#7a4a24' }
    );
    spritesheetTeks(this.scene, 'bendera_surat', [['krrr', 'kRRr', 'k...', 'k...', 'k...']], {
      k: '#1b2416',
      r: '#e0463a',
      R: '#b0302a',
    });
  }

  /**
   * Kurir di pintu About: menoleh ke kotak, amplop melayang masuk ke celah
   * pintunya, lalu bendera naik.
   */
  terima(kurir: Phaser.GameObjects.Sprite) {
    if (this.scene.anims.exists('kurir_idle_left')) kurir.play('kurir_idle_left', true);
    const celah = { x: this.kotak.x, y: this.kotak.y - 12 };
    const amplop = this.scene.add
      .image(kurir.x - 7, kurir.y + 4, 'amplop')
      .setDepth(this.kotak.depth + 1)
      .setScale(0.8);
    this.scene.tweens.add({
      targets: amplop,
      x: celah.x,
      y: celah.y,
      scale: 0.3,
      delay: 500,
      duration: 550,
      ease: 'Sine.easeIn',
      onComplete: () => {
        amplop.destroy();
        this.scene.tweens.add({ targets: this.kotak, x: this.kotak.x + 1, duration: 60, yoyo: true, repeat: 2 });
        this.naikkan(true);
      },
    });
  }

  private naikkan(naik: boolean) {
    this.adaSurat = naik;
    this.scene.tweens.add({
      targets: this.bendera,
      angle: naik ? BENDERA.naik : BENDERA.turun,
      duration: 320,
      ease: naik ? 'Back.easeOut' : 'Sine.easeIn',
    });
  }

  private klik() {
    const msg = this.adaSurat
      ? "New mail for Rahmat! Want to send him a message too? The Contact house is at the bottom of the village."
      : "Rahmat's mailbox. The courier drops letters in here on his rounds.";
    if (this.adaSurat) this.naikkan(false);
    this.scene.game.events.emit('mapporto:ucap', { msg, siapa: this.kotak, nama: 'Mailbox' });
  }
}
