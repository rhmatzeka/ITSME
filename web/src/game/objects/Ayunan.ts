import Phaser from 'phaser';
import { deritTali } from '../bunyi';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';
import { buatPegangTali } from './Rupa';
import { bisaDiajak } from './Warga';

const KECIL = 0.7;

/**
 * Ayunan ban di pohon sebelah timur tanggul: dahan tebal berdaun yang
 * menjulur dari tajuknya, dua tali tambang membentuk V, ban bekas yang
 * digantung tidur, dan tanah botak terinjak di bawahnya. Anak yang berayun
 * duduk di lubang bannya — pinggir depan ban menutupi pangkuannya — sambil
 * berpegangan pada kedua tali.
 *
 * Tanpa siapa pun ia bergoyang pelan tertiup angin. Siang hari sesekali
 * seorang anak datang duduk di bannya dan berayun tinggi, lalu pergi lagi.
 * Diklik, bannya didorong dan berayun lebar sebelum pelan-pelan kembali tenang.
 */
export class Ayunan {
  private ban: Phaser.GameObjects.Image;
  private banDepan: Phaser.GameObjects.Image;
  private tali: Phaser.GameObjects.Graphics;
  private anak: Phaser.GameObjects.Sprite;
  private t = 0;
  /** Simpangan ayunan saat ini (radian) karena dorongan atau anak yang berayun. */
  private amp = 0;
  private ampTujuan = 0;
  private naik = 0;
  private jadwal = 0;
  /** Arah ayun pada frame lalu — berganti arah di ujung ayunan, saat talinya berderit. */
  private arahTadi = 0;
  private readonly tanah: number;
  private readonly sk: number;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    spritesheetTeks(scene, 'dahan_ayunan', [[
      '............kkkk..kllllk..',
      '...........kllllkkllggllk.',
      '..........kllggllkllllllk.',
      '.........kllllllllllllGlbk',
      '.........kkllllGlbbbbbbbbk',
      '...kkkkkkbbbllllbbbbbbbbbk',
      'kkkbbbbbbbbbbbBBBBBBkkkkk.',
      'bbbbbbbbbBBBBBkkkkkk......',
      'bbbBBBBBBkkkkk............',
      'BBBkkkkkk.................',
      'kkk.......................',
    ]], { B: '#7a4a24', G: '#3e7a36', b: '#a8703a', g: '#5aa04a', k: '#2a2420', l: '#6fbf5a' });
    // Ban tidur dilihat miring, dibelah di tengah lubangnya: bagian belakang
    // di balik anak yang duduk, pinggir depan menutupi pangkuannya.
    spritesheetTeks(
      scene,
      'ban_ayunan',
      [
        [
        '....kkkkddddkkkk....',
        '..kkffffffffffffkk..',
        '.kddddddhhhhddddddk.',
        'kddddhhhhhhhhhhddddk',
        'kddddhhhhhhhhhhddddk',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        ],
        [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        'kdddddhhhhhhhhdddddk',
        'kddddddddddddddddddk',
        '.kdDddDddDddDddDddk.',
        '..kkddddddddddddkk..',
        '....kkkkddddkkkk....',
        ],
      ],
      { k: '#1b1920', d: '#3a3a44', D: '#22222a', f: '#5f5f6c', h: '#141418' }
    );
    // tanah yang botak terinjak di bawah ayunan
    spritesheetTeks(
      scene,
      'tanah_ayunan',
      [['...ooooooo...', '.ooOooOoooOo.', 'oOoooooOooooo', '.ooooOooooOo.', '...ooooooo...']],
      { o: '#b0885a', O: '#8a6a42' }
    );
    buatPegangTali(scene, 'anak', 'anak_pegang');

    const { dahan, poros, tali } = LAPANGAN.ayunan;
    this.tanah = poros.y + tali + 8;
    // dahan di atas tajuk pohon (layer `aset kedua` = DEPTH.above + 1)
    scene.add.image(dahan.x, dahan.y, 'dahan_ayunan').setOrigin(0).setDepth(DEPTH.above + 2);
    const d = kedalaman(this.tanah);
    scene.add.image(poros.x, poros.y + tali + 13, 'tanah_ayunan').setAlpha(0.7).setDepth(DEPTH.below + 1);
    this.ban = scene.add.image(poros.x, poros.y + tali, 'ban_ayunan', 0).setOrigin(0.5, 0).setDepth(d);
    this.tali = scene.add.graphics().setDepth(d + 0.05);
    const z = scene.cameras.main.zoom;
    this.sk = Math.max(1, Math.round(z * KECIL)) / z;
    this.anak = scene.add
      .sprite(poros.x, poros.y + tali, 'anak_pegang', 0)
      .setOrigin(0.5, 1)
      .setScale(this.sk)
      .setDepth(d + 0.1);
    this.banDepan = scene.add.image(poros.x, poros.y + tali, 'ban_ayunan', 1).setOrigin(0.5, 0).setDepth(d + 0.2);
    this.anak.setVisible(false).setAlpha(0);
    bisaDiajak(scene, this.anak, 'Kid', ['Wheee! Push me higher!', 'This tire swing is the best spot in the village.']);

    for (const b of [this.ban, this.banDepan]) {
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', (p: Phaser.Input.Pointer) => {
        p.event.preventDefault();
        this.amp = Math.max(this.amp, 0.6);
      });
    }
    this.jadwal = scene.time.now + Phaser.Math.Between(6000, 12000);
    scene.events.on('update', this.detak, this);
  }

  private detak(now: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    this.t += dt;
    this.kunjungan(now);
    // simpangan menuju sasarannya: anak yang berayun menjaga ayunan tetap tinggi,
    // dorongan tanpa anak pelan-pelan meredam
    if (this.ampTujuan > this.amp) this.amp = Math.min(this.ampTujuan, this.amp + dt * 0.25);
    else this.amp *= Math.exp(-dt * 0.35);
    const angin = 0.07 * Math.sin(this.t * 1.3) + 0.03 * Math.sin(this.t * 3.1);
    const sudut = this.amp * Math.sin(this.t * 2.3) + angin;
    // tali berderit di tiap ujung ayunan, makin keras makin tinggi ayunnya
    const arah = Math.sign(Math.cos(this.t * 2.3));
    if (arah !== this.arahTadi && this.amp > 0.18) {
      deritTali(LAPANGAN.ayunan.dahan.x, LAPANGAN.ayunan.dahan.y, Math.min(1, this.amp * 1.4));
    }
    this.arahTadi = arah;

    const { poros, tali } = LAPANGAN.ayunan;
    const bx = poros.x + Math.sin(sudut) * tali;
    const by = poros.y + Math.cos(sudut) * tali;
    // dikunci ke piksel dunia supaya ban tidak bergetar setengah piksel
    const x = Math.round(bx);
    const y = Math.round(by);
    this.ban.setPosition(x, y);
    this.banDepan.setPosition(x, y);
    // anak duduk di lubang ban: baris celananya (28 dari 32) setinggi pinggir depan ban
    this.anak.setPosition(x, y + 4 + Math.round(4 * this.sk));
    // dua tali membentuk V dari dahan ke kiri-kanan ban, lewat genggaman anak
    this.tali.clear().lineStyle(1, 0xc8b89a, 1);
    for (const sisi of [-6, 6]) this.tali.lineBetween(poros.x, poros.y, bx + sisi, by + 3);
  }

  /** Siang hari seorang anak datang berayun, lalu pergi; malam ayunannya kosong. */
  private kunjungan(now: number) {
    const siang = this.gelap() < 0.4;
    if (!siang && this.naik) {
      this.pergi();
      return;
    }
    if (now < this.jadwal) return;
    if (!this.naik && siang) {
      this.naik = 1;
      this.anak.setVisible(true);
      this.scene.tweens.add({ targets: this.anak, alpha: 1, duration: 400 });
      this.ampTujuan = 0.5;
      this.jadwal = now + Phaser.Math.Between(20000, 35000);
    } else if (this.naik) {
      this.pergi();
      this.jadwal = now + Phaser.Math.Between(15000, 30000);
    } else {
      this.jadwal = now + 5000;
    }
  }

  private pergi() {
    this.naik = 0;
    this.ampTujuan = 0;
    this.scene.tweens.add({ targets: this.anak, alpha: 0, duration: 400, onComplete: () => this.anak.setVisible(false) });
  }
}
