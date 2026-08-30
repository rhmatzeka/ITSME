import Phaser from 'phaser';
import { TOUCH, pakaiKontrolSentuh } from '../config';
import { VirtualJoystick } from '../objects/VirtualJoystick';
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
    this.buildPoiBubbles();
    this.buildTouchControls();
    this.buildMinimap();

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
    return pakaiKontrolSentuh();
  }

  private buildTouchControls() {
    if (!this.wantsTouch) return;
    this.joystick = new VirtualJoystick(this);
    this.touchUi = [this.joystick];
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
        wordWrap: { width: this.lebarBungkus() },
      })
      .setOrigin(0.5);
    this.bubble = this.add.container(0, 0, [this.bubbleBg, this.bubbleText]).setAlpha(0).setDepth(100);
    // layar diputar / jendela diubah ukurannya: gelembung ikut menyempit
    this.scale.on('resize', () => this.bubbleText.setWordWrapWidth(this.lebarBungkus()));
  }

  /** Gelembung tidak boleh lebih lebar dari layarnya sendiri. */
  private lebarBungkus() {
    return Math.min(300, this.scale.width - 56);
  }

  private ukuranBubble = { w: 0, h: 0 };

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

    this.ukuranBubble = { w, h };
    this.hideAt = this.time.now + ms;
    this.tweens.add({ targets: this.bubble, alpha: 1, y: '-=6', duration: 180, ease: 'Back.easeOut' });
  }

  /* ---------------- gelembung nama tiap tempat ---------------- */

  private poiBubbles: { box: Phaser.GameObjects.Container; wx: number; wy: number; h: number }[] = [];

  /**
   * Nama tiap tempat melayang di atas bangunannya, terus-menerus.
   *
   * Menggantikan penanda kotak emas. Kotak itu tidak memberi tahu apa pun —
   * orang harus mengkliknya dulu untuk tahu isinya apa; gelembung bernama
   * langsung terbaca dari jauh, dan bentuknya sama dengan gelembung ucapan
   * karakter sehingga terbaca sebagai bahasa yang sama.
   *
   * Dibangun di sini, bukan di WorldScene, karena scene itu di-zoom 3x: teks
   * apa pun di sana ikut membesar tiga kali dan pecah. Posisinya dihitung
   * ulang tiap frame dari koordinat dunia — cara yang sama dipakai gelembung
   * ucapan karakter.
   */
  private buildPoiBubbles() {
    const world = this.scene.get('World') as WorldScene;
    if (!world?.poiList?.length) return;

    for (const poi of world.poiList) {
      const teks = this.add
        .text(0, 0, poi.label.toUpperCase(), {
          fontFamily: 'Silkscreen, monospace',
          fontSize: '11px',
          color: '#1b2416',
        })
        .setOrigin(0.5);

      const pad = 6;
      const w = teks.width + pad * 2;
      const h = teks.height + pad * 2;
      const g = this.add
        .graphics()
        .fillStyle(0xffffff, 1)
        .lineStyle(3, 0x1b2416, 1)
        .fillRect(-w / 2, -h / 2, w, h)
        .strokeRect(-w / 2, -h / 2, w, h)
        .fillStyle(0xffffff, 1)
        .fillTriangle(-6, h / 2, 6, h / 2, 0, h / 2 + 8)
        .lineStyle(3, 0x1b2416, 1)
        .lineBetween(-6, h / 2 + 1, 0, h / 2 + 8)
        .lineBetween(6, h / 2 + 1, 0, h / 2 + 8);

      const box = this.add.container(0, 0, [g, teks]).setDepth(95);
      // titik gantungnya dihitung WorldScene dari puncak bangunannya sendiri
      const g0 = world.gantunganPoi(poi);
      this.poiBubbles.push({ box, wx: g0.x, wy: g0.y, h });
    }
  }

  private letakkanPoiBubbles(world: WorldScene) {
    if (!this.poiBubbles.length) return;
    const cam = world.cameras.main;
    for (const b of this.poiBubbles) {
      const x = Math.round((b.wx - cam.worldView.x) * cam.zoom);
      const y = Math.round((b.wy - cam.worldView.y) * cam.zoom);
      // di luar layar tidak perlu digambar sama sekali
      const tampak = x > -120 && x < this.scale.width + 120 && y > -60 && y < this.scale.height + 60;
      b.box.setVisible(tampak);
      if (tampak) b.box.setPosition(x, y - b.h / 2 - 8);
    }
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
    // Layar sentuh memakai versi 2 px/tile; versi desktop memakan hampir
    // separuh lebar layar ponsel.
    const key = this.wantsTouch ? 'map_mini_sm' : 'map_mini';
    const tex = this.textures.get(key).getSourceImage();
    const w = (tex as HTMLImageElement).width;
    const h = (tex as HTMLImageElement).height;

    this.mini = this.add.image(0, 0, key).setOrigin(0).setDepth(90);
    this.miniDots = this.add.graphics().setDepth(91);
    this.miniBox = { x: 0, y: 0, w, h };

    const frame = this.add.graphics().setDepth(89);

    const place = () => {
      const pad = 14;
      // Di perangkat sentuh sudut kiri-bawah milik joystick, jadi minimap
      // naik ke kanan atas — tepat di ruang bekas tombol MAP dan FX.
      const touch = this.wantsTouch;
      const x = Math.round(touch ? this.scale.width - w - pad : pad);
      const y = Math.round(touch ? 66 : this.scale.height - h - pad);
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

    /*
     * Tiap penanda diberi alas gelap pejal dulu, baru warnanya di atasnya.
     *
     * Dulu alasnya cuma garis tepi setebal 1px. Itu cukup waktu minimapnya
     * berupa bidang warna rata, tapi sekarang latarnya peta sungguhan yang
     * penuh detail — penanda kuning di atas atap oranye nyaris tidak terbaca.
     * Alas pejal memberi jarak warna yang sama di mana pun ia jatuh.
     */
    g.clear();
    const penanda = (x: number, y: number, warna: number) => {
      g.fillStyle(0x1b2416, 1).fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
      g.fillStyle(warna, 1).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    };
    for (const poi of world.poiList) {
      const q = toMini(poi.at[0] * 16 + 8, poi.at[1] * 16 + 8);
      penanda(q.x, q.y, 0xf2c438);
    }
    const me = toMini(world.hero.x, world.hero.y);
    penanda(me.x, me.y, 0xffffff);
    // cincin merah di luar alas: membedakan "kamu" dari tempat-tempat tujuan
    g.lineStyle(1, 0xe0563f, 1).strokeRect(Math.round(me.x) - 4, Math.round(me.y) - 4, 8, 8);
  }

  /**
   * Menaruh gelembung ucapan di atas kepala karakter — tapi tetap di dalam
   * layar, dan tidak pernah di atas minimap.
   *
   * Di ponsel minimap duduk di kanan atas, persis di jalur yang dipakai
   * gelembung waktu karakternya berada di paruh atas layar: gelembungnya
   * menutupi peta sepenuhnya. Kalau keduanya bertabrakan, yang mengalah
   * gelembungnya — ia turun ke bawah minimap. Minimap harus selalu terbaca;
   * gelembung cuma numpang lewat empat detik.
   */
  private tempatkanBubble(x: number, y: number) {
    const { w, h } = this.ukuranBubble;
    const px = Phaser.Math.Clamp(x, w / 2 + 10, this.scale.width - w / 2 - 10);

    let atas = 58 + h / 2; // di bawah bilah menu
    let bawah = this.scale.height - h / 2 - 10;
    const m = this.miniBox;
    const bertabrakan = m.w > 0 && px + w / 2 > m.x - 10 && px - w / 2 < m.x + m.w + 10;
    if (bertabrakan) {
      // minimap di atas (ponsel) → gelembung turun; di bawah (desktop) → naik
      if (m.y < this.scale.height / 2) atas = Math.max(atas, m.y + m.h + 14 + h / 2);
      else bawah = Math.min(bawah, m.y - 14 - h / 2);
    }
    this.bubble.setPosition(px, Phaser.Math.Clamp(y, atas, Math.max(atas, bawah)));
  }

  override update() {
    this.drawMiniDots();
    const dunia = this.scene.get('World') as WorldScene;
    if (dunia) this.letakkanPoiBubbles(dunia);

    // bubble mengikuti kepala karakter, dikonversi dari koordinat dunia ke layar
    const world = this.scene.get('World') as WorldScene;
    const hero = world?.hero;
    if (hero && this.bubble.alpha > 0) {
      const cam = world.cameras.main;
      const x = (hero.x - cam.worldView.x) * cam.zoom;
      const y = (hero.y - cam.worldView.y) * cam.zoom;
      this.tempatkanBubble(x, y - 46 * cam.zoom);
    }

    if (this.hideAt && this.time.now > this.hideAt) {
      this.hideAt = 0;
      this.tweens.add({ targets: this.bubble, alpha: 0, duration: 200 });
    }
  }
}
