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
  private bubbleEkor!: Phaser.GameObjects.Graphics;
  private ukuranBubble = { w: 0, h: 0 };
  private hideAt = 0;
  private joystick?: VirtualJoystick;
  private touchUi: { setVisible(v: boolean): void }[] = [];

  constructor() {
    super({ key: 'UI', active: false });
  }

  create() {
    // minimap lebih dulu: lebar gelembung dihitung dari letaknya
    this.buildMinimap();
    this.buildBubble();
    this.buildPoiBubbles();
    this.buildTouchControls();

    this.game.events.on('mapporto:greet', (msg: string) => this.say(msg));
    this.events.once('shutdown', () => this.game.events.off('mapporto:greet'));

    /*
     * Semua yang mengikuti dunia ditaruh SAAT prerender, bukan saat update.
     *
     * WorldScene digambar sebelum UIScene, dan kamera dunia baru menghitung
     * gulirnya di dalam langkah gambar itu. Saat update() UIScene berjalan,
     * angka kameranya masih milik frame sebelumnya — gelembungnya tertinggal
     * satu frame di belakang karakter yang diikutinya.
     */
    this.events.on('prerender', () => this.ikutiDunia());
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
    // Ekor digambar terpisah dari kotaknya supaya bisa digeser sendiri:
    // gelembung yang minggir menghindari minimap tetap harus menunjuk
    // karakternya, kalau tidak ia terbaca seperti ucapan milik orang lain.
    this.bubbleEkor = this.add
      .graphics()
      .fillStyle(0xffffff, 1)
      .fillTriangle(-7, 0, 7, 0, 0, 9)
      .lineStyle(3, 0x1b2416, 1)
      .lineBetween(-7, 1, 0, 9)
      .lineBetween(7, 1, 0, 9);
    this.bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '13px',
        color: '#1b2416',
        align: 'center',
        wordWrap: { width: this.lebarBungkus() },
      })
      .setOrigin(0.5);
    this.bubble = this.add
      .container(0, 0, [this.bubbleBg, this.bubbleEkor, this.bubbleText])
      .setAlpha(0)
      .setDepth(100);
    // layar diputar / jendela diubah ukurannya: gelembung ikut menyempit
    this.scale.on('resize', () => this.bubbleText.setWordWrapWidth(this.lebarBungkus()));
  }

  /**
   * Lebar maksimal gelembung.
   *
   * Selain tidak boleh melebihi layarnya sendiri: di layar sentuh minimap
   * duduk di kanan atas, persis di jalur gelembung. Gelembungnya dibuat cukup
   * sempit untuk lewat di sebelah kirinya — menggeser ke samping jauh lebih
   * baik daripada menurunkannya, karena satu-satunya ruang di bawah minimap
   * adalah tempat karakternya berdiri.
   */
  private lebarBungkus() {
    let maks = Math.min(300, this.scale.width - 56);
    const m = this.miniBox;
    if (m.w > 0 && m.y < this.scale.height / 2) maks = Math.min(maks, m.x - 44);
    return Math.max(150, maks);
  }

  say(msg: string, ms = 4200) {
    if (!msg) return;
    this.bubbleText.setWordWrapWidth(this.lebarBungkus());
    this.bubbleText.setText(msg);

    const pad = 10;
    const w = this.bubbleText.width + pad * 2;
    const h = this.bubbleText.height + pad * 2;

    this.bubbleBg
      .clear()
      .fillStyle(0xffffff, 1)
      .lineStyle(3, 0x1b2416, 1)
      .fillRect(-w / 2, -h / 2, w, h)
      .strokeRect(-w / 2, -h / 2, w, h);
    this.bubbleEkor.setY(h / 2);

    this.ukuranBubble = { w, h };
    this.hideAt = this.time.now + ms;
    // tanpa geser `y`: posisinya ditentukan ulang tiap frame, jadi tween-nya
    // cuma akan bertengkar dengan penempatan
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  /* ---------------- gelembung nama tiap tempat ---------------- */

  private poiBubbles: { box: Phaser.GameObjects.Container; wx: number; wy: number; w: number; h: number }[] = [];

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
      this.poiBubbles.push({ box, wx: g0.x, wy: g0.y, w, h });
    }
  }

  /**
   * Titik dunia → titik layar.
   *
   * TIDAK memakai `camera.worldView`. Phaser membulatkan worldView ke piksel
   * dunia bulat tanpa peduli setelan `roundPixels` (`Math.floor(midX - w/2 +
   * 0.5)` di Camera.preRender), sementara yang dipakai menggambar adalah
   * `scrollX` yang masih pecahan. Jadi dunianya bergeser mulus sedangkan
   * apa pun yang dihitung dari worldView melompat sebesar satu zoom —
   * terukur: karakter yang seharusnya terpaku di layar malah berayun 2 px
   * bolak-balik tiap empat frame. Itulah gelembung yang bergetar.
   *
   * Matriks kamera adalah yang sama persis dipakai renderer, jadi hasilnya
   * terkunci ke karakternya sampai sub-piksel.
   */
  private layar(cam: Phaser.Cameras.Scene2D.Camera, wx: number, wy: number) {
    // rumus yang sama dipakai matriks kamera di Camera.preRender:
    // (titik − gulir − titik-asal) × zoom + titik-asal yang dibulatkan
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    return this.titik.set(
      (wx - cam.scrollX - ox) * cam.zoomX + Math.floor(cam.x + ox + 0.5),
      (wy - cam.scrollY - oy) * cam.zoomY + Math.floor(cam.y + oy + 0.5)
    );
  }
  private titik = new Phaser.Math.Vector2();

  private letakkanPoiBubbles(world: WorldScene) {
    if (!this.poiBubbles.length) return;
    const cam = world.cameras.main;
    for (const b of this.poiBubbles) {
      const t = this.layar(cam, b.wx, b.wy);
      const x = Math.round(t.x);
      const y = Math.round(t.y);
      // di luar layar tidak perlu digambar sama sekali
      const cy = y - b.h / 2 - 8;
      let tampak = x > -120 && x < this.scale.width + 120 && y > -60 && y < this.scale.height + 60;
      // nama tempat yang kebetulan lewat di atas minimap disembunyikan dulu.
      // Namanya akan muncul lagi begitu karakternya bergeser; minimap tidak
      // punya kesempatan kedua semacam itu.
      const m = this.miniBox;
      if (tampak && m.w > 0)
        tampak =
          !(x + b.w / 2 > m.x - 6 && x - b.w / 2 < m.x + m.w + 6 &&
            cy + b.h / 2 + 8 > m.y - 6 && cy - b.h / 2 < m.y + m.h + 6);
      b.box.setVisible(tampak);
      if (tampak) b.box.setPosition(x, cy);
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
   * Menaruh gelembung ucapan di atas kepala karakter.
   *
   * Tegaknya tidak pernah ditawar: gelembung selalu DI ATAS kepala, tidak
   * pernah menutupi karakternya. Kalau ia sedang sejajar dengan minimap,
   * yang digeser posisi mendatarnya — menyingkir ke sisi lain minimap —
   * dan ekornya tetap menunjuk karakter. Hanya kalau memang tidak muat di
   * samping, barulah ia menjauh secara tegak.
   */
  private tempatkanBubble(x: number, y: number) {
    const { w, h } = this.ukuranBubble;
    const lebar = this.scale.width;
    let atas = 58 + h / 2; // di bawah bilah menu
    let bawah = this.scale.height - h / 2 - 10;
    const py0 = Phaser.Math.Clamp(y, atas, Math.max(atas, bawah));

    let kiri = w / 2 + 10;
    let kanan = lebar - w / 2 - 10;
    const m = this.miniBox;
    // hanya kalau tingginya memang bersinggungan dengan minimap
    const sejajar = m.w > 0 && py0 + h / 2 > m.y - 10 && py0 - h / 2 < m.y + m.h + 10;
    let muat = true;
    if (sejajar) {
      if (m.x + m.w / 2 > lebar / 2) kanan = Math.min(kanan, m.x - 10 - w / 2);
      else kiri = Math.max(kiri, m.x + m.w + 10 + w / 2);
      muat = kiri <= kanan;
      if (!muat) {
        kiri = w / 2 + 10;
        kanan = lebar - w / 2 - 10;
        if (m.y < this.scale.height / 2) atas = Math.max(atas, m.y + m.h + 14 + h / 2);
        else bawah = Math.min(bawah, m.y - 14 - h / 2);
      }
    }

    const px = Phaser.Math.Clamp(x, kiri, Math.max(kiri, kanan));
    const py = muat ? py0 : Phaser.Math.Clamp(y, atas, Math.max(atas, bawah));
    this.bubble.setPosition(px, py);
    // ekor tetap menunjuk karakter walau kotaknya sudah minggir
    this.bubbleEkor.setX(Phaser.Math.Clamp(x - px, -w / 2 + 12, w / 2 - 12));
  }

  /** Dipanggil tepat sebelum UIScene digambar, saat kamera dunia sudah pasti. */
  private ikutiDunia() {
    const world = this.scene.get('World') as WorldScene;
    if (!world) return;
    this.letakkanPoiBubbles(world);

    const hero = world.hero;
    if (!hero || (this.bubble.alpha <= 0 && !this.hideAt)) return;
    const cam = world.cameras.main;
    const t = this.layar(cam, hero.x, hero.y);
    this.tempatkanBubble(t.x, t.y - 46 * cam.zoom);
  }

  override update() {
    this.drawMiniDots();

    if (this.hideAt && this.time.now > this.hideAt) {
      this.hideAt = 0;
      this.tweens.add({ targets: this.bubble, alpha: 0, duration: 200 });
    }
  }
}
