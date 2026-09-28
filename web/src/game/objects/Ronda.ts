import Phaser from 'phaser';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { tok } from '../suara';
import { spritesheetTeks } from './piksel';
import { buatDuduk } from './Rupa';
import type { Senter } from './Senter';
import { bisaDiajak } from './Warga';

/** Seberapa jauh bunyi kentongan masih terdengar, px dunia. */
const JANGKAU_TOK = 200;

/**
 * Pos ronda di pojok lapangan CV: gubuk panggung beratap dengan bale bambu,
 * dinding anyaman setinggi pinggang, dan kentongan bambu tergantung di tiang
 * kirinya.
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
          '...........kkkkkkkkkkkk...........',
          '........kkkqqqqqqqqqqqqkkk........',
          '.....kkkaaAaaaAaaaAaaaAaaakkk.....',
          '...kkaaaaaaaaaaaaaaaaaaaaaaaakk...',
          '.kkaAaaaAaaaAaaaAaaaAaaaAaaaAaakk.',
          'kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak',
          'aaAaaaAaaaAaaaAaaaAaaaAaaaAaaaAaaa',
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          'kkkbbkkkkkkkkkkkkkkkkkkkkkkkkbbkkk',
          '..kcbk......................kcbk..',
          '..kcbk......................kcbk..',
          '..kcbkkkkkkkkkkkkkkkkkkkkkkkkcbk..',
          '..kcbnNNnnNNnnNNnnNNnnNNnnNNncbk..',
          '..kcbnNNnnNNnnNNnnNNnnNNnnNNncbk..',
          '..kcbNnnNNnnNNnnNNnnNNnnNNnnNcbk..',
          '..kcbNnnNNnnNNnnNNnnNNnnNNnnNcbk..',
          '..kcbnNNnnNNnnNNnnNNnnNNnnNNncbk..',
          '..kcbnNNnnNNnnNNnnNNnnNNnnNNncbk..',
          '..kcbNnnNNnnNNnnNNnnNNnnNNnnNcbk..',
          '..kcbNnnNNnnNNnnNNnnNNnnNNnnNcbk..',
          '..kcbnNNnnNNnnNNnnNNnnNNnnNNncbk..',
          '.kkcbnNNnnNNnnNNnnNNnnNNnnNNncbkk.',
          'kMMcMMMMMMMMMMMMMMMMMMMMMMMMMcMMMk',
          'kmmcmmmmmmmmmmmmmmmmmmmmmmmmmcmmmk',
          'kmmcmmMmmMmmMmmMmmMmmMmmMmmMmcMmmk',
          'kmmcmmmmmmmmmmmmmmmmmmmmmmmmmcmmmk',
          '.kbcbkkkkkkkkkkkBBkkkkkkkkkkkcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk.........kBBk.........kcbbk.',
          '.kbcbk..........kk..........kcbbk.',
          '..kkk........................kkk..',
          '..................................',
        ],
      ],
      { A: '#6a4a30', B: '#7a4a24', M: '#b8904a', N: '#a8884a', a: '#8a6a4a', b: '#a8703a', c: '#c89060', k: '#2a2420', m: '#d9b870', n: '#c8a860', q: '#b08a5a' }
    );
    spritesheetTeks(
      scene,
      'kentongan',
      [
        [
          '..k..',
          '..k..',
          '..k..',
          '.kkk.',
          'kbBbk',
          'kbkbk',
          'kbkbk',
          'kbBbk',
          'kbBbk',
          '.kkk.',
        ],
        [
          '..k..',
          '..k..',
          '...k.',
          '.kkk.',
          'kbBbk',
          'kbkbk',
          'kbkbk',
          'kbBbk',
          'kbBbk',
          '.kkk.',
        ],
      ],
      { B: '#7a4a24', b: '#a8703a', k: '#2a2420' }
    );
    spritesheetTeks(scene, 'tok', [['k...k', '.k.k.', '.....', '.k.k.', 'k...k']], { k: '#fff2b0' });
    buatDuduk(scene, 'ronda', 'ronda_duduk', { toleh: -1, kulit: '#c68b5e', celana: ['#8a3a4a', '#5a2030'] });

    const { x, kaki } = LAPANGAN.ronda;
    const d = kedalaman(kaki);
    scene.add.image(x, kaki, 'pos_ronda').setOrigin(0.5, 1).setDepth(d);
    // duduk di bale (baris 22-25 gambar pos), pangkuannya menutupi tepi bale
    this.bapak = scene.add
      .sprite(x + 5, kaki - 9, 'ronda_duduk', 0)
      .setOrigin(0.5, 1)
      .setDepth(d + 0.2)
      .setVisible(false);
    bisaDiajak(scene, this.bapak, 'Night watch', [
      'Keeping watch tonight. Sleep well — the village is safe.',
      'Three knocks on the kentongan means all is well.',
    ]);
    // kentongan tergantung dari lis atap, di luar tiang kiri
    this.kentongan = scene.add.sprite(x - 17, kaki - 28, 'kentongan', 0).setOrigin(0.5, 0).setDepth(d + 0.3);
    this.kentongan.setInteractive({ useHandCursor: true });
    this.kentongan.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.pukul(2);
    });
    // lentera di ujung kiri bale, menyala sendiri saat gelap
    senter?.lentera(x - 9, kaki - 13, kaki);
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 3, 32, 6);
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
        const p = this.pemain();
        const jarak = p ? Phaser.Math.Distance.Between(p.x, p.y, this.kentongan.x, this.kentongan.y) : Infinity;
        tok(1 - jarak / JANGKAU_TOK);
        if (n >= kali) this.scene.time.delayedCall(200, () => (this.memukul = false));
      },
    });
  }

  /** Tanda pukulan kecil yang memudar di samping kentongan. */
  private bekas() {
    const t = this.scene.add
      .image(this.kentongan.x - 5, this.kentongan.y + 6, 'tok')
      .setDepth(DEPTH.above + 20)
      .setScale(0.5);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 0, duration: 380, onComplete: () => t.destroy() });
  }
}
