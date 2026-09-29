import Phaser from 'phaser';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { tok } from '../bunyi';
import { spritesheetTeks } from './piksel';
import { buatDuduk } from './Rupa';
import type { Senter } from './Senter';
import { bisaDiajak } from './Warga';
import { sisiPemain } from './toleh';

/**
 * Pos ronda di pojok lapangan CV: gubuk panggung beratap rumbia bertritisan
 * lebar dengan rumbai di tepinya, tiang dan kaki bambu beruas, bale dari bilah
 * bambu, dinding gedek setinggi pinggang, termos merah dan segelas kopi di
 * bale, dan kentongan bambu bercelah tergantung di luar tiang kirinya.
 *
 * Siang harinya kosong. Malam hari seorang bapak ronda bersarung duduk di
 * bale, lenteranya menyala, dan sesekali ia memukul kentongan tiga kali —
 * "tok tok tok" yang makin pelan makin jauh pemainnya. Kentongannya bisa
 * dipukul sendiri dengan mengkliknya, siang maupun malam.
 */
export class Ronda {
  private bapak: Phaser.GameObjects.Sprite;
  private kentongan: Phaser.GameObjects.Sprite;
  private hadir = 0;
  private jedaTok = 8000;
  private memukul = false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Phaser.GameObjects.Components.Transform | undefined,
    senter?: Senter,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    spritesheetTeks(
      scene,
      'pos_ronda',
      [
        [
          '.............kkkzzzzazzzzakkk.............',
          '..........kkkahhhhahhhhahhhhakkk..........',
          '.......kkkhahhhhahhhhahhhhahhhhakkk.......',
          '.....kkHHHHHHHHHHHHHHHHHHHHHHHHHHHHkk.....',
          '...kkhhahhhhahhhhahhhhahhhhahhhhahhhhkk...',
          '.kkhhahhhhahhhhahhhhahhhhahhhhahhhhahhhk..',
          'kHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHk.',
          'hahhhhahhhhahhhhahhhhahhhhahhhhahhhhahhhhk',
          'hhhhahhhhahhhhahhhhahhhhahhhhahhhhahhhhahh',
          'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
          'HAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHA',
          'AkkAkejkkAkkAkkAkkAkkAkkAkkAkkAkkAkkeekAkk',
          '....kejkkkkkkkkkkkkkkkkkkkkkkkkkkkkkeek...',
          '....kejattaattaattaattaattaattaattaaeek...',
          '....kejtaattaattaattaattaattaattaatteek...',
          '....kJJtaattaattaattaattaattaattaattJJk...',
          '....kejattaattaattaattaattaattaattaaeek...',
          '....kejattaattaattaattaattaattaattaaeek...',
          '....kejtaattaattaattaattaattaattaatteek...',
          '....kejtaattaattaattaattaattaattaatteek...',
          '....kJJattaattaattaattaattaakkkattaaJJk...',
          '....kejattaattaattaattaattaadddattaaeek...',
          '....kejtaattaattaattaattaatkrrrkaatteek...',
          '....kejtaattaattaattaattaatkurrkaatteek...',
          '....kejattaattaattaattaattakrrrkiiaaeek...',
          '....kJJattaattaattaattaattakrrrkxxaaJJk...',
          '.kkkkejtaattaattaattaattaatkrrrkxxtteekkk.',
          'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeek',
          'kjjejejjjjjjjjjjjjjjejjjjjjjjjjjjjjjeejjjk',
          'kJJeJeJJJJJJJJJJJJJJeJJJJJJJJJJJJJJJeeJJJk',
          'kJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJk',
          '.kkejejkkkkkkkkkkkkkejkkkkkkkkkkkkkkeejkk.',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '..kJJJJk...........kJJk............kJJJk..',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '..kJJJJk...........kJJk............kJJJk..',
          '..kejejk...........kejk............keejk..',
          '..kejejk...........kejk............keejk..',
          '...kkkk.............kk..............kkk...',
        ],
      ],
      { A: '#7a5a2a', H: '#a8844a', J: '#9a7a3a', a: '#b89a5a', d: '#3a3a44', e: '#c9d06a', h: '#d9b870', i: '#6a4a22', j: '#c8a860', k: '#2a2420', r: '#e0463a', t: '#e8d9b0', u: '#ff7a66', x: '#e0dace', z: '#5a3a1a' }
    );
    spritesheetTeks(
      scene,
      'kentongan',
      [
        [
          '...k...',
          '...k...',
          '..kkk..',
          '.kjjjk.',
          'kejjjJk',
          'kejJjJk',
          'kekkkJk',
          'kekzkJk',
          'kekkkJk',
          'kejJjJk',
          'kejjjJk',
          'kejjjJk',
          'kJJJJJk',
          '.kkkkk.',
        ],
        [
          '...k...',
          '....k..',
          '..kkk..',
          '.kjjjk.',
          'kejjjJk',
          'kejJjJk',
          'kekkkJk',
          'kekzkJk',
          'kekkkJk',
          'kejJjJk',
          'kejjjJk',
          'kejjjJk',
          'kJJJJJk',
          '.kkkkk.',
        ],
      ],
      { J: '#9a7a3a', e: '#c9d06a', j: '#c8a860', k: '#2a2420', z: '#5a3a1a' }
    );
    spritesheetTeks(scene, 'tok', [['k...k', '.k.k.', '.....', '.k.k.', 'k...k']], { k: '#fff2b0' });
    buatDuduk(scene, 'ronda', 'ronda_duduk', { toleh: -1, kulit: '#c68b5e', celana: ['#8a3a4a', '#5a2030'] });

    const { x, kaki } = LAPANGAN.ronda;
    const d = kedalaman(kaki);
    scene.add.image(x, kaki, 'pos_ronda').setOrigin(0.5, 1).setDepth(d);
    // duduk di bale (baris 27-30 gambar pos), pangkuannya menutupi tepi bale;
    // termos dan gelas kopinya di sebelah kanannya, lentera di kirinya
    this.bapak = scene.add
      .sprite(x + 1, kaki - 12, 'ronda_duduk', 0)
      .setOrigin(0.5, 1)
      .setDepth(d + 0.2)
      .setVisible(false);
    bisaDiajak(scene, this.bapak, 'Night watch', [
      'Keeping watch tonight. Sleep well — the village is safe.',
      'Three knocks on the kentongan means all is well.',
    ]);
    // kentongan tergantung dari lis atap, di luar tiang kiri
    this.kentongan = scene.add.sprite(x - 19, kaki - 33, 'kentongan', 0).setOrigin(0.5, 0).setDepth(d + 0.3);
    this.kentongan.setInteractive({ useHandCursor: true });
    this.kentongan.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.pukul(2);
    });
    // lentera di ujung kiri bale, menyala sendiri saat gelap
    senter?.lentera(x - 12, kaki - 17, kaki);
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 3, 40, 6);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    scene.events.on('update', this.detak, this);
  }

  private detak(_t: number, delta: number) {
    // bapak ronda datang setelah gelap dan pulang saat fajar
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.45) / 0.25, 0, 1);
    this.bapak.setAlpha(this.hadir).setVisible(this.hadir > 0);
    if (this.bapak.input) this.bapak.input.enabled = this.hadir > 0.5;
    // menoleh ke pemain yang lewat (frame 1 menoleh ke kiri; ke kanan = dicerminkan)
    if (!this.memukul) {
      const sisi = sisiPemain(this.bapak.x, this.bapak.y);
      this.bapak.setFrame(sisi ? 1 : 0).setFlipX(sisi > 0);
    }
    if (this.hadir < 1 || this.memukul) return;
    if ((this.jedaTok -= delta) > 0) return;
    this.jedaTok = Phaser.Math.Between(14000, 26000);
    this.pukul(3);
  }

  /** Pukul kentongan `kali` kali; bapak ronda (kalau ada) ikut bergerak. */
  private pukul(kali: number) {
    if (this.memukul) return;
    this.memukul = true;
    let n = 0;
    this.scene.time.addEvent({
      delay: 340,
      repeat: kali - 1,
      callback: () => {
        n++;
        this.kentongan.setFrame(1);
        if (this.hadir > 0.5) this.bapak.setFrame(4);
        this.scene.time.delayedCall(150, () => {
          this.kentongan.setFrame(0);
          this.bapak.setFrame(0);
        });
        this.bekas();
        tok(this.kentongan.x, this.kentongan.y);
        if (n >= kali) this.scene.time.delayedCall(200, () => (this.memukul = false));
      },
    });
  }

  /** Tanda pukulan kecil yang memudar di samping kentongan. */
  private bekas() {
    const t = this.scene.add
      .image(this.kentongan.x - 6, this.kentongan.y + 7, 'tok')
      .setDepth(DEPTH.above + 20)
      .setScale(0.5);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 0, duration: 380, onComplete: () => t.destroy() });
  }
}
