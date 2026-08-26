import Phaser from 'phaser';
import { TOUCH } from '../config';
import { VirtualJoystick, TouchButton } from '../objects/VirtualJoystick';
import type { WorldScene } from './WorldScene';

/**
 * Overlay yang berjalan BERSAMAAN dengan WorldScene (bukan menggantikannya),
 * supaya panel bisa dibuka tanpa menghentikan animasi map.
 *
 * Kameranya tidak di-zoom, jadi teks bubble tetap tajam 1:1 walau dunia di-zoom 3×.
 */
export class UIScene extends Phaser.Scene {
  private bubble!: Phaser.GameObjects.Container;
  private bubbleText!: Phaser.GameObjects.Text;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private hideAt = 0;
  private joystick?: VirtualJoystick;
  private touchUi: { setVisible(v: boolean): void }[] = [];

  constructor() {
    super({ key: 'UI', active: false });
  }

  create() {
    this.buildBubble();
    this.buildTouchControls();
    // di layar sentuh sudut kiri-bawah dipakai joystick; tombol MAP tetap ada
    if (!this.wantsTouch) this.buildMinimap();

    this.game.events.on('mapporto:greet', (msg: string) => this.say(msg));
    this.events.once('shutdown', () => this.game.events.off('mapporto:greet'));

  }

  /* ---------------- kontrol sentuh ---------------- */

  /**
   * `pointer: coarse` = alat tunjuk utamanya jari, bukan mouse. Ini pembeda yang
   * benar; `device.input.touch` bernilai true juga di laptop layar-sentuh yang
   * dipakai dengan mouse, dan di situ joystick cuma menghalangi.
   */
  private get wantsTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return coarse || this.scale.width < 700;
  }

  private buildTouchControls() {
    if (!this.wantsTouch) return;
    const world = () => this.scene.get('World') as WorldScene;

    this.joystick = new VirtualJoystick(this);

    const right = (n: number) => () => ({
      x: this.scale.width - TOUCH.margin - TOUCH.buttonSize / 2 - n * (TOUCH.buttonSize + 12),
      y: this.scale.height - TOUCH.margin - TOUCH.buttonSize / 2 - (n === 0 ? 0 : 10),
    });

    // A = masuk ke tempat terdekat, B = buka peta
    const a = new TouchButton(this, 'joy_a', right(0), () => world()?.enterNearest());
    const b = new TouchButton(this, 'joy_b', right(1), () =>
      document.querySelector<HTMLButtonElement>('[data-open-map]')?.click()
    );

    this.touchUi = [this.joystick, a, b];
    this.scale.on('resize', () => this.touchUi.forEach((c) => c.setVisible(this.wantsTouch)));
  }

  /* ---------------- bubble chat ---------------- */

  private buildBubble() {
    this.bubbleBg = this.add.graphics();
    this.bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '13px',
        color: '#1b2416',
        align: 'center',
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5);
    this.bubble = this.add.container(0, 0, [this.bubbleBg, this.bubbleText]).setAlpha(0).setDepth(100);
  }

  say(msg: string, ms = 4200) {
    if (!msg) return;
    this.bubbleText.setText(msg);

    const pad = 10;
    const w = this.bubbleText.width + pad * 2;
    const h = this.bubbleText.height + pad * 2;

    this.bubbleBg
      .clear()
      .fillStyle(0xffffff, 1)
      .lineStyle(3, 0x1b2416, 1)
      .fillRect(-w / 2, -h / 2, w, h)
      .strokeRect(-w / 2, -h / 2, w, h)
      // ekor bubble
      .fillStyle(0xffffff, 1)
      .fillTriangle(-7, h / 2, 7, h / 2, 0, h / 2 + 9)
      .lineStyle(3, 0x1b2416, 1)
      .lineBetween(-7, h / 2 + 1, 0, h / 2 + 9)
      .lineBetween(7, h / 2 + 1, 0, h / 2 + 9);

    this.hideAt = this.time.now + ms;
    this.tweens.add({ targets: this.bubble, alpha: 1, y: '-=6', duration: 180, ease: 'Back.easeOut' });
  }

  /* ---------------- minimap ---------------- */

  private mini?: Phaser.GameObjects.Image;
  private miniDots?: Phaser.GameObjects.Graphics;
  private miniBox = { x: 0, y: 0, w: 0, h: 0 };

  /**
   * Minimap dari kamera kedua Phaser selalu berderau: memperkecil dunia 624×528
   * ke ~130 px dengan nearest-neighbour membuang 4 dari 5 piksel. Ini memakai
   * gambar yang sudah diperkecil rapi oleh pipeline (lanczos), ditampilkan 1:1
   * sehingga tetap jernih — dan jauh lebih murah daripada kamera kedua.
   */
  private buildMinimap() {
    const tex = this.textures.get('map_mini').getSourceImage();
    const w = (tex as HTMLImageElement).width;
    const h = (tex as HTMLImageElement).height;

    this.mini = this.add.image(0, 0, 'map_mini').setOrigin(0).setDepth(90);
    this.miniDots = this.add.graphics().setDepth(91);
    this.miniBox = { x: 0, y: 0, w, h };

    const frame = this.add.graphics().setDepth(89);

    const place = () => {
      const pad = 14;
      const x = Math.round(pad);
      const y = Math.round(this.scale.height - h - pad);
      this.miniBox.x = x;
      this.miniBox.y = y;
      this.mini!.setPosition(x, y);
      // bingkai dua lapis: garis terang tipis di dalam garis gelap tebal,
      // supaya minimap terbaca di atas rumput maupun jalan
      frame
        .clear()
        .fillStyle(0x1b2416, 1)
        .fillRect(x - 4, y - 4, w + 8, h + 8)
        .fillStyle(0xeff1e8, 1)
        .fillRect(x - 2, y - 2, w + 4, h + 4)
        .fillStyle(0x1b2416, 1)
        .fillRect(x - 1, y - 1, w + 2, h + 2);
    };
    place();
    this.scale.on('resize', place);

    // klik minimap → buka peta besar (bukan langsung pindah:
    // di ukuran sekecil ini jari/kursor tidak bisa memilih tujuan dengan akurat)
    this.mini
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => {
        p.event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-open-map]')?.click();
      });
  }

  private drawMiniDots() {
    const world = this.scene.get('World') as WorldScene;
    const g = this.miniDots;
    if (!g || !world?.hero) return;
    const size = world.mapPixelSize;
    const { x: bx, y: by, w, h } = this.miniBox;
    const toMini = (wx: number, wy: number) => ({ x: bx + (wx / size.w) * w, y: by + (wy / size.h) * h });

    g.clear();
    for (const poi of world.poiList) {
      const q = toMini(poi.at[0] * 16 + 8, poi.at[1] * 16 + 8);
      g.fillStyle(0xf2c438, 1).fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4);
      g.lineStyle(1, 0x1b2416, 1).strokeRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4);
    }
    const me = toMini(world.hero.x, world.hero.y);
    g.fillStyle(0xffffff, 1).fillRect(Math.round(me.x) - 2, Math.round(me.y) - 2, 4, 4);
    g.lineStyle(1, 0xe0563f, 1).strokeRect(Math.round(me.x) - 3, Math.round(me.y) - 3, 6, 6);
  }

  override update() {
    this.drawMiniDots();

    // bubble mengikuti kepala karakter, dikonversi dari koordinat dunia ke layar
    const world = this.scene.get('World') as WorldScene;
    const hero = world?.hero;
    if (hero && this.bubble.alpha > 0) {
      const cam = world.cameras.main;
      const x = (hero.x - cam.worldView.x) * cam.zoom;
      const y = (hero.y - cam.worldView.y) * cam.zoom;
      this.bubble.setPosition(
        Phaser.Math.Clamp(x, this.bubble.getBounds().width / 2 + 8, this.scale.width - 160),
        Math.max(y - 46 * cam.zoom, 60)
      );
    }

    if (this.hideAt && this.time.now > this.hideAt) {
      this.hideAt = 0;
      this.tweens.add({ targets: this.bubble, alpha: 0, duration: 200 });
    }
  }
}
