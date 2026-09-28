import Phaser from 'phaser';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';
import { buatDuduk } from './Rupa';
import { bisaDiajak } from './Warga';

const KECIL = 0.7;

/**
 * Ayunan ban di pohon sebelah timur tanggul: dahan tebal berdaun yang
 * menjulur dari tajuknya, seutas tali tambang, ban bekas beralur dengan
 * simpul di atasnya, dan tanah botak terinjak di bawahnya.
 *
 * Tanpa siapa pun ia bergoyang pelan tertiup angin. Siang hari sesekali
 * seorang anak datang duduk di bannya dan berayun tinggi, lalu pergi lagi.
 * Diklik, bannya didorong dan berayun lebar sebelum pelan-pelan kembali tenang.
 */
export class Ayunan {
  private ban: Phaser.GameObjects.Image;
  private tali: Phaser.GameObjects.Graphics;
  private anak: Phaser.GameObjects.Sprite;
  private t = 0;
  /** Simpangan ayunan saat ini (radian) karena dorongan atau anak yang berayun. */
  private amp = 0;
  private ampTujuan = 0;
  private naik = 0;
  private jadwal = 0;
  private readonly tanah: number;

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
    spritesheetTeks(scene, 'ban_ayunan', [[
      '..kkdddWdddkk..',
      '.kdffffWffffdk.',
      'kdddddddddddddk',
      'kdDdddkkkdddDdk',
      'ddddkk...kkdddd',
      'dDddk.....kddDd',
      'ddddk.....kdddd',
      'kdDddkkkkkddDdk',
      'kdddddddddddddk',
      '.kdddDdddDdddk.',
      '..kkdddddddkk..',
    ]], { D: '#22222a', W: '#cfcabd', d: '#3a3a44', f: '#5a5a66', k: '#2a2420' });
    // tanah yang botak terinjak di bawah ayunan
    spritesheetTeks(
      scene,
      'tanah_ayunan',
      [['...ooooooo...', '.ooOooOoooOo.', 'oOoooooOooooo', '.ooooOooooOo.', '...ooooooo...']],
      { o: '#b0885a', O: '#8a6a42' }
    );
    buatDuduk(scene, 'anak', 'anak_duduk', { toleh: 1, kulit: '#d9a07a', celana: ['#3f7fd6', '#2a5aa0'] });

    const { dahan, poros, tali } = LAPANGAN.ayunan;
    this.tanah = poros.y + tali + 8;
    // dahan di atas tajuk pohon (layer `aset kedua` = DEPTH.above + 1)
    scene.add.image(dahan.x, dahan.y, 'dahan_ayunan').setOrigin(0).setDepth(DEPTH.above + 2);
    const d = kedalaman(this.tanah);
    scene.add.image(poros.x, poros.y + tali + 13, 'tanah_ayunan').setAlpha(0.7).setDepth(DEPTH.below + 1);
    this.tali = scene.add.graphics().setDepth(d - 0.1);
    this.ban = scene.add.image(poros.x, poros.y + tali, 'ban_ayunan').setOrigin(0.5, 0).setDepth(d);
    const z = scene.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    this.anak = scene.add.sprite(poros.x, poros.y + tali, 'anak_duduk', 0).setOrigin(0.5, 1).setScale(sk).setDepth(d + 0.1);
    this.anak.setVisible(false).setAlpha(0);
    bisaDiajak(scene, this.anak, 'Kid', ['Wheee! Push me higher!', 'This tire swing is the best spot in the village.']);

    this.ban.setInteractive({ useHandCursor: true });
    this.ban.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.amp = Math.max(this.amp, 0.6);
    });
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

    const { poros, tali } = LAPANGAN.ayunan;
    const bx = poros.x + Math.sin(sudut) * tali;
    const by = poros.y + Math.cos(sudut) * tali;
    // dikunci ke piksel dunia supaya ban tidak bergetar setengah piksel
    this.ban.setPosition(Math.round(bx), Math.round(by));
    this.anak.setPosition(Math.round(bx), Math.round(by) + 4);
    this.tali.clear().lineStyle(1, 0xc8b89a, 1).lineBetween(poros.x, poros.y, bx, by + 1);
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
