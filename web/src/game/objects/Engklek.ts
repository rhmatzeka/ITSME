import Phaser from 'phaser';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { Player } from './Player';
import { bisaDiajak } from './Warga';

/** Sama dengan anak layangan: dua pertiga tinggi orang dewasa. */
const KECIL = 0.7;

/**
 * Kotak engklek dari bawah ke atas, relatif ke dasar gambarnya: y tempat kaki
 * mendarat (sedikit di bawah tengah kotak). Kotak ganda (4-5, 7-8) dipijak
 * dengan dua kaki di tengahnya; paling atas "gunung" tempat berbalik.
 */
const KOTAK = [-3, -12, -21, -30, -39, -48];
const GUNUNG = -57;
/** Kotak mana yang boleh diisi gacuk — yang tunggal saja. */
const KOTAK_GACUK = [0, 1, 2, 4];

type Langkah = { y: number; balik?: boolean; ambil?: boolean };

/**
 * Engklek di lapangan CV: kotak-kotak kapur bernomor 1-8 di tanah (angkanya
 * berselang merah muda dan biru, garis kapurnya tidak rata seperti digores
 * tangan, "gunung"-nya diarsir) dan seorang anak perempuan yang memainkannya.
 *
 * Tiap putaran ia melempar gacuk (batu pipih) ke satu kotak, lalu melompat
 * kotak demi kotak sampai "gunung" dan kembali — kotak bergacuk dilompati,
 * dan dalam perjalanan pulang ia berhenti memungutnya. Menjelang malam ia
 * pulang, seperti anak layangan di utara.
 */
export class Engklek {
  private anak: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Sprite;
  private gacuk: Phaser.GameObjects.Image;
  private putaran = 0;
  private hadir = 1;
  private sibuk = false;
  private readonly x: number;
  private readonly kaki: number;
  private readonly mulaiY: number;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    spritesheetTeks(
      scene,
      'engklek_kapur',
      [
        [
          '.....................',
          '.....................',
          '.....................',
          '.....................',
          '......www..cwwv......',
          '....wv.c..c..c.vw....',
          '...w..c..c..c..c.w...',
          '..v..c..c..c..c..cw..',
          '..w.c..c..c..c..c.v..',
          '.w.c..c..c..c..c..cv.',
          '.wc..c..c..c..c..c.w.',
          '.vwwwwvwwwwvwwwwvwww.',
          '.w........w........w.',
          '.w..mmm...w...n....w.',
          '.w....m...w..n.n...v.',
          '.w...m....v...n....w.',
          '.v...m....w..n.n...w.',
          '.w...m....w...n....w.',
          '.w........w........w.',
          '.w........w........v.',
          '.wwwwvwwwwvwwwwvwwww.',
          '......v........w.....',
          '......w...nn...w.....',
          '......w..n.....w.....',
          '......w..nn....w.....',
          '......w..n.n...v.....',
          '......v...n....w.....',
          '......w........w.....',
          '......w........w.....',
          '.wwwvwwwwvwwwwvwwwwv.',
          '.w........v........w.',
          '.v..n.n...w..mmm...w.',
          '.w..n.n...w..m.....w.',
          '.w..nnn...w..mm....w.',
          '.w....n...w....m...v.',
          '.w....n...v..mm....w.',
          '.v........w........w.',
          '.w........w........w.',
          '.wwvwwwwvwwwwvwwwwvw.',
          '......w........w.....',
          '......w..mm....v.....',
          '......v....m...w.....',
          '......w...m....w.....',
          '......w....m...w.....',
          '......w..mm....w.....',
          '......w........v.....',
          '......v........w.....',
          '......wvwwwwvwww.....',
          '......w........w.....',
          '......w..nn....w.....',
          '......w....n...v.....',
          '......v...n....w.....',
          '......w..n.....w.....',
          '......w..nnn...w.....',
          '......w........w.....',
          '......w........v.....',
          '......vwwwwvwwww.....',
          '......w........w.....',
          '......w...m....w.....',
          '......w..mm....w.....',
          '......w...m....v.....',
          '......v...m....w.....',
          '......w..mmm...w.....',
          '......w........w.....',
          '......w........w...mm',
          '......wwwwvwwwwv..nn.',
        ],
      ],
      { c: '#8fd3f0', m: '#d9407a', n: '#3a7ad0', v: '#e8e2d2', w: '#f7f5ee' }
    );
    spritesheetTeks(scene, 'gacuk', [['.gg.', 'gGGg', '.gg.']], { g: '#9a948a', G: '#6a6458' });
    const { x, kaki } = LAPANGAN.engklek;
    this.x = x;
    this.kaki = kaki;
    this.mulaiY = kaki + 7;
    scene.add.image(x, kaki, 'engklek_kapur').setOrigin(0.5, 1).setAlpha(0.85).setDepth(DEPTH.below + 1);
    this.gacuk = scene.add.image(x, kaki + 9, 'gacuk').setDepth(DEPTH.below + 1.5);

    Player.registerAnimations(scene, 'anak_engklek');
    const z = scene.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    this.anak = scene.add.sprite(x, this.mulaiY, 'anak_engklek', 12).setOrigin(0.5, 1).setScale(sk);
    this.bayang = scene.add.sprite(x, this.mulaiY - sk, bayanganKaki(scene)).setScale(sk).setAlpha(BAYANGAN_KAKI);
    this.tanah(this.mulaiY);
    bisaDiajak(scene, this.anak, 'Girl', [
      'Want to play engklek? Hop on one foot and skip the square with the stone!',
      'I threw my stone into the next square. Watch me!',
    ]);
    scene.events.on('update', this.detak, this);
    scene.time.delayedCall(1200, () => this.main());
  }

  /** Posisi kaki anak di tanah: urutan gambar dan bayangannya ikut. */
  private tanah(y: number, lompat = 0) {
    this.anak.setPosition(this.x, y - lompat).setDepth(kedalaman(y));
    this.bayang.setPosition(this.x, y - this.anak.scaleY).setDepth(kedalaman(y) - 0.5);
  }

  private detak() {
    // pulang menjelang malam: memudar, dan tidak bisa diajak bicara
    this.hadir = Phaser.Math.Clamp((0.55 - this.gelap()) / 0.25, 0, 1);
    this.anak.setAlpha(this.hadir).setVisible(this.hadir > 0);
    this.bayang.setAlpha(this.hadir * BAYANGAN_KAKI).setVisible(this.hadir > 0);
    this.gacuk.setAlpha(this.hadir);
    if (this.anak.input) this.anak.input.enabled = this.hadir > 0.5;
  }

  /** Satu putaran: lempar gacuk, lompat ke gunung, kembali sambil memungutnya. */
  private main() {
    if (this.hadir < 0.5) {
      this.scene.time.delayedCall(3000, () => this.main());
      return;
    }
    const s = this.scene;
    const isi = KOTAK_GACUK[this.putaran++ % KOTAK_GACUK.length];
    this.anak.setFrame(12);
    // lempar: gacuk melengkung dari tangan ke kotak tujuannya
    const tujuan = this.kaki + KOTAK[isi] - 2;
    this.gacuk.setPosition(this.x + 3, this.mulaiY - 10).setVisible(true);
    s.tweens.add({
      targets: this.gacuk,
      x: this.x + Phaser.Math.Between(-2, 2),
      duration: 600,
    });
    s.tweens.add({
      targets: this.gacuk,
      y: tujuan,
      duration: 600,
      ease: 'Quad.easeIn',
    });
    const jalan: Langkah[] = [];
    KOTAK.forEach((y, i) => i !== isi && jalan.push({ y: this.kaki + y }));
    jalan.push({ y: this.kaki + GUNUNG, balik: true });
    for (let i = KOTAK.length - 1; i >= 0; i--) {
      if (i === isi) continue;
      jalan.push({ y: this.kaki + KOTAK[i], ambil: i === isi + 1 });
    }
    // kotak pertama bergacuk: dipungut dari luar, sebelum keluar
    jalan.push({ y: this.mulaiY, ambil: isi === 0 });
    s.time.delayedCall(900, () => this.lompat(jalan, 0, this.mulaiY));
  }

  private lompat(jalan: Langkah[], i: number, dari: number) {
    const s = this.scene;
    const l = jalan[i];
    if (!l) {
      this.anak.setFrame(12);
      s.time.delayedCall(Phaser.Math.Between(2200, 4200), () => this.main());
      return;
    }
    const p = { t: 0 };
    s.tweens.add({
      targets: p,
      t: 1,
      duration: 260,
      onUpdate: () => this.tanah(dari + (l.y - dari) * p.t, Math.sin(p.t * Math.PI) * 5),
      onComplete: () => {
        this.tanah(l.y);
        if (l.balik) this.anak.setFrame(0);
        let jeda = Phaser.Math.Between(120, 220);
        if (l.ambil) {
          // membungkuk memungut gacuk dari kotak di depannya
          jeda = 650;
          s.time.delayedCall(300, () => this.gacuk.setVisible(false));
        }
        s.time.delayedCall(jeda, () => this.lompat(jalan, i + 1, l.y));
      },
    });
  }
}
