import Phaser from 'phaser';
import { mulai } from '../suara';

/**
 * Layar judul. Latarnya map sendiri yang di-render besar lalu diburamkan
 * lewat overlay gelap — tidak perlu art baru.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width: w, height: h } = this.scale;

    // potongan map sebagai latar
    const map = this.make.tilemap({ key: 'map' });
    const tiles = map.addTilesetImage('atlas', 'atlas', 16, 16, 1, 2)!;
    const layers = map.layers.map((l) => map.createLayer(l.name, tiles, 0, 0)!);
    // WAJIB bilangan bulat: skala pecahan pada tilemap nearest-neighbour
    // menyisakan garis jahitan tipis antar tile.
    const scale = Math.max(2, Math.ceil(Math.max(w / map.widthInPixels, h / map.heightInPixels) * 1.6));
    // scrollFactor 0 membuat centerOn tidak berefek — layer diposisikan langsung
    const offX = w / 2 - (map.widthInPixels * scale) / 2;
    const offY = h / 2 - (map.heightInPixels * scale) / 2;
    layers.forEach((l) => l.setScale(scale).setScrollFactor(0).setPosition(offX, offY));

    this.add.rectangle(w / 2, h / 2, w, h, 0x0d1409, 0.55).setScrollFactor(0);

    const title = this.add
      .text(w / 2, h * 0.3, 'RAHMAT\nPORTOFOLIO', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: `${Math.round(Math.min(w * 0.093, 66))}px`,
        color: '#ffffff',
        align: 'center',
        stroke: '#1b2416',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.add
      .text(w / 2, title.y + title.height * 0.62, 'PORTFOLIO', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '20px',
        color: '#e7ecdc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // ---- tombol PLAY ----
    const bw = 260;
    const bh = 74;
    const btn = this.add.container(w / 2, h * 0.66).setScrollFactor(0);
    const shadow = this.add.rectangle(5, 5, bw, bh, 0x1b2416).setOrigin(0.5);
    const face = this.add.rectangle(0, 0, bw, bh, 0xe0563f).setOrigin(0.5).setStrokeStyle(3, 0x1b2416);
    const text = this.add
      .text(0, 0, 'PLAY', { fontFamily: 'Silkscreen, monospace', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    btn.add([shadow, face, text]);

    face.setInteractive({ useHandCursor: true });
    face.on('pointerover', () => face.setFillStyle(0xe86c56));
    face.on('pointerout', () => face.setFillStyle(0xe0563f));
    face.on('pointerdown', () => btn.setPosition(btn.x + 3, btn.y + 3));
    face.on('pointerup', () => this.start());
    this.input.keyboard?.once('keydown-ENTER', () => this.start());
    this.input.keyboard?.once('keydown-SPACE', () => this.start());

    this.add
      .text(w / 2, h * 0.66 + 76, 'Enter / Spasi juga bisa', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '12px',
        color: '#c6cfb6',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  private start() {
    /*
     * Satu-satunya tempat yang benar untuk menyalakan suara.
     *
     * Browser cuma memberi izin berbunyi di dalam penanganan sentuhan atau
     * tekan tombol, dan tombol PLAY adalah gerbang yang memang sudah ada:
     * yang menekannya jelas sedang bersiap main, bukan kebetulan lewat.
     */
    mulai();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
