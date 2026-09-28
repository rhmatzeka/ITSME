import Phaser from 'phaser';
import { huhu } from '../bunyi';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Di atas tajuk pohon (layer `di atas map 1` = DEPTH.above), di bawah tirai malam. */
const KEDALAMAN = DEPTH.above + 3;
/** Pendar mata: di atas tirai, bersama cahaya lampu. */
const KEDALAMAN_MATA = DEPTH.above + 62;

const F = { melek: 0, kedip: 1, toleh: 2, bersuara: 3 } as const;

const UCAP = ['Hoo... hooo.', 'Hoo-hoo! *blinks slowly*', 'Hooo. The night is young.'];

/**
 * Burung hantu di tajuk pohon sebelah barat rumah About. Siang hari tidak
 * ada; begitu malam ia hinggap di dahannya, sesekali mengedip dan menoleh,
 * dan tiap setengah menit atau lebih ber-"hu-huu" — matanya yang kuning
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

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private gelap: () => number
  ) {
    const tubuh = (baris3: string, baris4: string, baris5: string, baris6: string) => [
      '..k.....k..',
      '..kk...kk..',
      '..kbbbbbk..',
      baris3,
      baris4,
      baris5,
      baris6,
      '.kbBbBbBbk.',
      '.kbbBbBbbk.',
      '.kbBbBbBbk.',
      '..kbbbbbk..',
      'nnnkykykNnn',
      '.NnnnnnnnN.',
    ];
    spritesheetTeks(
      scene,
      'burung_hantu',
      [
        tubuh('.kbwwbwwbk.', '.kwEwbwEwk.', '.kbwwowwbk.', '..kbbobbk..'),
        tubuh('.kbwwbwwbk.', '.kwcwbwcwk.', '.kbwwowwbk.', '..kbbobbk..'),
        tubuh('.kwwbwwbbk.', '.kEwbwEwbk.', '.kbwowwwbk.', '..kbobbbk..'),
        tubuh('.kbwwbwwbk.', '.kwEwbwEwk.', '.kbwwowwbk.', '.kbwwOwwbk.'),
      ],
      {
        k: '#2a1c14', b: '#8a6038', B: '#5e3e22', w: '#e8d8b8', E: '#ffc23a', c: '#5e3e22',
        o: '#d89a3a', O: '#3a2418', y: '#e0a040', n: '#6a4a2a', N: '#4a321c',
      }
    );
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
    this.s = scene.add.sprite(x, y, 'burung_hantu', F.melek).setOrigin(0.5, 1).setDepth(KEDALAMAN).setVisible(false);
    // mata di baris 4 frame 11×13, kolom 3 dan 7
    this.mata = [-2, 2].map((dx) =>
      scene.add
        .image(x + dx, y - 13 + 4.5, 'mata_pendar')
        .setScale(0.5)
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

  /** "Hu... huuu": bulu lehernya menggembung di tiap suku kata. */
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

  private detak(_t: number, delta: number) {
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.6) / 0.25, 0, 1);
    const ada = this.hadir > 0;
    this.s.setVisible(ada).setAlpha(this.hadir);
    const f = Number(this.s.frame.name);
    const melek = f !== F.kedip;
    // mata menoleh ke kiri sepiksel di frame toleh
    const geser = f === F.toleh ? -1 : 0;
    this.mata.forEach((m, i) =>
      m
        .setVisible(ada && melek)
        .setX(this.s.x + (i ? 2 : -2) + geser)
        .setAlpha(this.hadir * (0.75 + 0.15 * Math.sin(_t / 600)))
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
        this.s.setFrame(F.toleh);
        this.scene.time.delayedCall(Phaser.Math.Between(900, 1800), () => !this.bersuara && this.s.setFrame(F.melek));
      }
    }
  }
}
