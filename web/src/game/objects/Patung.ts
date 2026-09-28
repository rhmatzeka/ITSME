import Phaser from 'phaser';
import { ABOUT, DEPTH, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Tulisan di kaki patung — kata-kata Rahmat sendiri dari halaman About,
 * bukan kutipan karangan.
 */
const PRASASTI = [
  'The plaque reads: "From bug to debug, then to product."',
  'The plaque reads: "Build apps that people actually use — not ones that stop at the demo."',
  'The plaque reads: "Web, mobile, and Web3 — the most interesting apps touch all three."',
];

/** Sedekat apa pemain boleh datang sebelum pipitnya kabur, px dari kaki ke patung. */
const KAGET = 36;

/**
 * Patung batu di halaman rumah About. Tile-nya sudah ada di peta; yang
 * ditambahkan di sini cuma kehidupannya.
 *
 * Diklik, patungnya "bicara" lewat prasasti di kakinya. Sesekali seekor
 * pipit terbang hinggap di kepalanya, menoleh ke sana-sini dan merapikan
 * bulu, lalu pergi lagi — lebih cepat kalau pemain mendekat atau patungnya
 * diklik.
 */
export class Patung {
  private jangkar: Phaser.GameObjects.Image;
  private pipit?: Phaser.GameObjects.Sprite;
  private hinggap = false;
  private pergiPada = 0;
  private tingkahPada = 0;
  private prasasti = 0;

  constructor(
    private scene: Phaser.Scene,
    private pengganggu: () => (Phaser.GameObjects.Components.Transform | undefined)[]
  ) {
    const { x, kepala, kaki } = ABOUT.patung;
    // titik gantung gelembung di puncak kepala patung (gambar 1×1 kosong)
    spritesheetTeks(scene, 'titik_kosong', [['.']], {});
    this.jangkar = scene.add.image(x, kepala, 'titik_kosong').setOrigin(0.5, 1);
    const zona = scene.add
      .zone(x, (kepala + kaki) / 2, 14, kaki - kepala + 2)
      .setInteractive({ useHandCursor: true })
      .setDepth(kedalaman(kaki) + 1);
    zona.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', {
        msg: PRASASTI[this.prasasti++ % PRASASTI.length],
        siapa: this.jangkar,
        nama: 'Statue',
      });
      if (this.hinggap) this.pergi();
    });

    // pipitnya memakai lembar yang sama dengan kawanan burung di desa
    if (scene.textures.exists('burung')) {
      this.pipit = scene.add.sprite(0, 0, 'burung', 0).setOrigin(0.5, 1).setVisible(false);
      scene.time.delayedCall(Phaser.Math.Between(4000, 9000), () => this.datang());
      scene.events.on('update', this.detak, this);
    }
  }

  private terganggu() {
    const { x, kaki } = ABOUT.patung;
    return this.pengganggu().some((o) => o && Phaser.Math.Distance.Between(o.x, o.y + 15, x, kaki) < KAGET);
  }

  /** Terbang turun dari kiri atas, sayap mengepak, lalu menjejak kepala patung. */
  private datang() {
    const b = this.pipit!;
    if (this.terganggu()) {
      this.scene.time.delayedCall(4000, () => this.datang());
      return;
    }
    const { x, kepala } = ABOUT.patung;
    b.setPosition(x - 44, kepala - 40)
      .setFlipX(true)
      .setAlpha(0)
      .setVisible(true)
      .setDepth(DEPTH.above + 30);
    this.scene.tweens.add({
      targets: b,
      x,
      y: kepala + 1,
      alpha: 1,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: () => b.setFrame(Math.floor(this.scene.time.now / 90) % 2 ? 2 : 3),
      onComplete: () => {
        b.setFrame(0).setDepth(kedalaman(ABOUT.patung.kaki) + 0.5);
        this.hinggap = true;
        this.pergiPada = this.scene.time.now + Phaser.Math.Between(9000, 16000);
        this.tingkahPada = this.scene.time.now + 800;
      },
    });
  }

  /** Terbang ke kanan atas sambil memudar, lalu kembali beberapa saat lagi. */
  private pergi() {
    const b = this.pipit!;
    this.hinggap = false;
    b.setFlipX(true).setDepth(DEPTH.above + 30);
    this.scene.tweens.add({
      targets: b,
      x: b.x + 60,
      y: b.y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeIn',
      onUpdate: () => b.setFrame(Math.floor(this.scene.time.now / 80) % 2 ? 2 : 3),
      onComplete: () => {
        b.setVisible(false);
        this.scene.time.delayedCall(Phaser.Math.Between(10000, 25000), () => this.datang());
      },
    });
  }

  private detak(t: number) {
    if (!this.hinggap) return;
    if (t > this.pergiPada || this.terganggu()) {
      this.pergi();
      return;
    }
    if (t < this.tingkahPada) return;
    this.tingkahPada = t + Phaser.Math.Between(700, 1800);
    const b = this.pipit!;
    // menoleh, atau merunduk merapikan bulu
    if (Math.random() < 0.55) b.setFlipX(!b.flipX);
    else {
      b.setFrame(1);
      this.scene.time.delayedCall(280, () => this.hinggap && b.setFrame(0));
    }
  }
}
