import Phaser from 'phaser';
import { MINI_BINGKAI, TOUCH, pakaiKontrolSentuh, diKanvas } from '../config';
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
  /** Bidang sentuh seukuran gelembung: diketuk = gelembungnya ditutup. */
  private bubbleTutup!: Phaser.GameObjects.Zone;
  /** Kepekatan isi gelembung, 1 = penuh; menipis selagi karakternya berjalan. */
  private tembus = 1;
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
    // warga yang diklik: gelembungnya di atas kepala warga itu, bukan pemain
    this.game.events.on('mapporto:ucap', (e: { msg: string; siapa: Phaser.GameObjects.Sprite; nama?: string }) =>
      this.say(e.msg, undefined, e.siapa, e.nama)
    );
    this.events.once('shutdown', () => {
      this.game.events.off('mapporto:greet');
      this.game.events.off('mapporto:ucap');
    });

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
    // terminal terbuka (termasuk duduk otomatis di kursi): jempol yang masih
    // menahan joystick tidak boleh terus menggerakkan karakternya
    const lepasJoystick = () => this.joystick?.lepas();
    this.game.events.on('mapporto:terminal', lepasJoystick);
    this.game.events.on('mapporto:ke-terminal', lepasJoystick);
    this.events.once('shutdown', () => {
      this.game.events.off('mapporto:terminal', lepasJoystick);
      this.game.events.off('mapporto:ke-terminal', lepasJoystick);
    });
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
    // label nama pembicara (khusus warga): tab kuning di pojok kiri atas
    this.bubbleNamaBg = this.add.graphics();
    this.bubbleNamaTeks = this.add
      .text(0, 0, '', { fontFamily: 'Silkscreen, monospace', fontSize: '10px', color: '#1b2416' })
      .setOrigin(0, 0.5);
    this.bubbleNama = this.add.container(0, 0, [this.bubbleNamaBg, this.bubbleNamaTeks]).setVisible(false);
    /*
     * Gelembung bisa menutupi tempat yang mau dituju — pintu rumah, label
     * TERMINAL — dan dulu ia tetap di situ sampai waktunya habis (sampai 12
     * detik). Sekarang diketuk sekali, gelembungnya pergi. Ketukan itu tidak
     * ikut menggerakkan karakter: scene UI yang kena lebih dulu, sama seperti
     * label nama tempat.
     */
    this.bubbleTutup = this.add.zone(0, 0, 1, 1).setInteractive({ useHandCursor: true });
    this.bubbleTutup.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event?.preventDefault();
      this.tutupBubble();
    });
    this.bubbleTutup.disableInteractive();
    this.bubble = this.add
      .container(0, 0, [this.bubbleTutup, this.bubbleBg, this.bubbleEkor, this.bubbleText, this.bubbleNama])
      .setAlpha(0)
      .setDepth(100);
    // layar diputar / jendela diubah ukurannya: gelembung ikut menyempit
    this.scale.on('resize', () => {
      this.bubbleText.setWordWrapWidth(this.lebarBungkus());
      this.ukurBilah();
    });
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
  /**
   * Layar HP (lebar di bawah 600 px): gelembung ucapan dibuat lebih kecil —
   * huruf 11 px, lebar paling banyak 230 px, tepi lebih rapat. Ukuran desktop
   * (13 px, 300 px) di layar 390 px membuat satu gelembung hampir selebar
   * layar dan menutupi desa di sekitar pembicaranya.
   */
  private get layarKecil() {
    return this.scale.width < 600;
  }

  private lebarBungkus() {
    let maks = Math.min(this.layarKecil ? 230 : 300, this.scale.width - 56);
    const m = this.miniLuar;
    if (m.w > 0 && m.y < this.scale.height / 2) maks = Math.min(maks, m.x - 44);
    return Math.max(this.layarKecil ? 140 : 150, maks);
  }

  /**
   * Tepi bawah bilah menu, dibaca langsung dari halamannya.
   *
   * Angka tetap salah di sini: di layar selebar ~760 px deretan tombolnya
   * membungkus jadi dua baris dan bilahnya jadi dua kali lebih tinggi, jadi
   * gelembung yang mengira bilahnya setinggi 58 px akan tertimpa tombol.
   * Kanvasnya menutupi seluruh jendela dan kamera UI tidak di-zoom, jadi
   * koordinat DOM dan koordinat scene ini memang satu ukuran.
   *
   * Dibaca saat mulai bicara dan saat layar berubah ukuran, bukan tiap frame:
   * getBoundingClientRect memaksa browser menghitung ulang tata letak.
   */
  private batasAtas = 58;
  /** Tombol DOM yang melayang di atas kanvas (gir Setelan di ponsel). */
  private rintangan: DOMRect | null = null;
  private ukurBilah() {
    const b = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    this.batasAtas = (b > 0 ? b : 52) + 8;
    const gir = document.querySelector<HTMLElement>('.girlepas');
    const r = gir && getComputedStyle(gir).display !== 'none' ? gir.getBoundingClientRect() : null;
    this.rintangan = r && r.width > 0 ? r : null;
  }

  /**
   * Lama gelembung tampil, mengikuti panjang kalimatnya.
   *
   * Dulu semuanya 4,2 detik. Cukup untuk "Rumah saya. Masuk, kenalan dulu.",
   * tapi sapaan pembuka yang tiga baris sudah hilang sebelum selesai dibaca.
   * Patokannya kira-kira 14 huruf per detik (pembaca santai, ditambah waktu
   * menemukan gelembungnya dulu), minimal 5 detik, maksimal 12 detik.
   */
  private lamaBaca(msg: string) {
    return Phaser.Math.Clamp(2500 + msg.length * 70, 5000, 12000);
  }

  /** Pemilik gelembung yang sedang tampil; kosong = karakter pemain. */
  private sasaran?: Phaser.GameObjects.Sprite;
  private bubbleNama!: Phaser.GameObjects.Container;
  private bubbleNamaBg!: Phaser.GameObjects.Graphics;
  private bubbleNamaTeks!: Phaser.GameObjects.Text;

  say(msg: string, ms = this.lamaBaca(msg), siapa?: Phaser.GameObjects.Sprite, nama?: string) {
    if (!msg) return;
    this.sasaran = siapa;
    this.ukurBilah();
    const kecil = this.layarKecil;
    this.bubbleText.setFontSize(kecil ? 11 : 13).setLineSpacing(kecil ? 1 : 0);
    this.bubbleNamaTeks.setFontSize(kecil ? 9 : 10);
    this.bubbleText.setWordWrapWidth(this.lebarBungkus());
    this.bubbleText.setText(msg);

    const pad = kecil ? 7 : 10;
    const w = this.bubbleText.width + pad * 2;
    const h = this.bubbleText.height + pad * 2;

    this.bubbleBg
      .clear()
      .fillStyle(0xffffff, 1)
      .lineStyle(3, 0x1b2416, 1)
      .fillRect(-w / 2, -h / 2, w, h)
      .strokeRect(-w / 2, -h / 2, w, h);
    this.bubbleEkor.setY(h / 2);

    // tab nama menempel di tepi atas, menjorok keluar setengah tingginya
    this.bubbleNama.setVisible(!!nama);
    if (nama) {
      this.bubbleNamaTeks.setText(nama.toUpperCase());
      const tw = this.bubbleNamaTeks.width + (kecil ? 10 : 12);
      const th = kecil ? 15 : 18;
      this.bubbleNamaBg
        .clear()
        .fillStyle(0xf2c438, 1)
        .lineStyle(2, 0x1b2416, 1)
        .fillRect(0, -th / 2, tw, th)
        .strokeRect(0, -th / 2, tw, th);
      this.bubbleNamaTeks.setPosition(kecil ? 5 : 6, 0);
      this.bubbleNama.setPosition(-w / 2 + 8, -h / 2);
    }

    this.ukuranBubble = { w, h };
    this.bubbleTutup.setSize(w, h).setInteractive({ useHandCursor: true });
    this.hideAt = this.time.now + ms;
    // tanpa geser `y`: posisinya ditentukan ulang tiap frame, jadi tween-nya
    // cuma akan bertengkar dengan penempatan
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  /* ---------------- gelembung nama tiap tempat ---------------- */

  private poiBubbles: {
    box: Phaser.GameObjects.Container;
    wx: number;
    wy: number;
    w: number;
    h: number;
    pantul?: boolean;
    /** Untuk label yang ikut benda bergerak (MATS-BOT): titik gantung tiap frame, undefined = sembunyikan. */
    ikut?: () => { x: number; y: number } | undefined;
  }[] = [];

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
    this.buildLabelTerminal(world);
    this.buildLabelBot(world);
  }

  /**
   * Label "TERMINAL" di atas komputer Rahmat: bentuk yang sama dengan nama
   * rumah — pengunjung sudah belajar bahwa label putih bertepi tinta berarti
   * "bisa diklik" — tapi dengan tanda prompt hijau di depannya, dan sedikit
   * memantul supaya kelihatan dari jauh. Diklik, terminalnya terbuka.
   */
  private buildLabelTerminal(world: WorldScene) {
    const titik = world.titikTerminal;
    if (!titik) return;
    const teks = this.add
      .text(0, 0, 'TERMINAL', { fontFamily: 'Silkscreen, monospace', fontSize: '11px', color: '#1b2416' })
      .setOrigin(0, 0.5);
    const prompt = this.add
      .text(0, 0, '>_', { fontFamily: 'Silkscreen, monospace', fontSize: '11px', color: '#1f8a3a' })
      .setOrigin(0, 0.5);
    const pad = 6;
    const w = prompt.width + 5 + teks.width + pad * 2;
    const h = teks.height + pad * 2;
    prompt.setX(-w / 2 + pad);
    teks.setX(-w / 2 + pad + prompt.width + 5);
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
    const box = this.add.container(0, 0, [g, prompt, teks]).setDepth(95).setSize(w, h + 8);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event?.preventDefault();
      // ke komputernya dulu (petir kalau jauh), baru monitornya menyala
      this.game.events.emit('mapporto:ke-terminal');
    });
    box.on('pointerover', () => g.setAlpha(0.85));
    box.on('pointerout', () => g.setAlpha(1));
    // kursor prompt berkedip
    this.time.addEvent({ delay: 530, loop: true, callback: () => prompt.setText(prompt.text === '>_' ? '> ' : '>_') });
    this.poiBubbles.push({ box, wx: titik.x, wy: titik.y, w, h, pantul: true });
  }

  /**
   * Label "ASK AI" di atas MATS-BOT: bentuknya sama dengan label rumah dan
   * TERMINAL (pengunjung sudah tahu itu bisa diklik), tapi berlatar kuning —
   * warna aksen situs dan panah pintu — dengan tanda tanya yang berkedip,
   * supaya robotnya menonjol di antara label-label putih. Memantul seperti
   * label TERMINAL, dan ikut robotnya ke mana pun. Diklik, jendela obrolannya
   * terbuka.
   */
  private buildLabelBot(world: WorldScene) {
    const bot = world.bot;
    if (!bot) return;
    const gaya = { fontFamily: 'Silkscreen, monospace', fontSize: '11px', color: '#1b2416' };
    const tanya = this.add.text(0, 0, '?', { ...gaya, color: '#b3261e' }).setOrigin(0, 0.5);
    const teks = this.add.text(0, 0, 'ASK AI', gaya).setOrigin(0, 0.5);
    const pad = 6;
    const w = tanya.width + 5 + teks.width + pad * 2;
    const h = teks.height + pad * 2;
    tanya.setX(-w / 2 + pad);
    teks.setX(-w / 2 + pad + tanya.width + 5);
    const g = this.add
      .graphics()
      .fillStyle(0xf2c438, 1)
      .lineStyle(3, 0x1b2416, 1)
      .fillRect(-w / 2, -h / 2, w, h)
      .strokeRect(-w / 2, -h / 2, w, h)
      .fillStyle(0xf2c438, 1)
      .fillTriangle(-6, h / 2, 6, h / 2, 0, h / 2 + 8)
      .lineStyle(3, 0x1b2416, 1)
      .lineBetween(-6, h / 2 + 1, 0, h / 2 + 8)
      .lineBetween(6, h / 2 + 1, 0, h / 2 + 8);
    const box = this.add.container(0, 0, [g, tanya, teks]).setDepth(95).setSize(w, h + 8);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event?.preventDefault();
      this.game.events.emit('mapporto:matsbot');
    });
    box.on('pointerover', () => g.setAlpha(0.85));
    box.on('pointerout', () => g.setAlpha(1));
    this.time.addEvent({ delay: 480, loop: true, callback: () => tanya.setAlpha(tanya.alpha > 0.5 ? 0.15 : 1) });
    this.poiBubbles.push({ box, wx: 0, wy: 0, w, h, pantul: true, ikut: () => bot.puncak });
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
      if (b.ikut) {
        const k = b.ikut();
        if (!k) {
          b.box.setVisible(false);
          continue;
        }
        b.wx = k.x;
        b.wy = k.y;
      }
      const t = this.layar(cam, b.wx, b.wy);
      const x = Math.round(t.x);
      const y = Math.round(t.y);
      // di luar layar tidak perlu digambar sama sekali
      const cy = y - b.h / 2 - 8;
      let tampak = x > -120 && x < this.scale.width + 120 && y > -60 && y < this.scale.height + 60;
      // nama tempat yang kebetulan lewat di atas minimap disembunyikan dulu.
      // Namanya akan muncul lagi begitu karakternya bergeser; minimap tidak
      // punya kesempatan kedua semacam itu.
      const m = this.miniLuar;
      if (tampak && m.w > 0)
        tampak =
          !(x + b.w / 2 > m.x - 6 && x - b.w / 2 < m.x + m.w + 6 &&
            cy + b.h / 2 + 8 > m.y - 6 && cy - b.h / 2 < m.y + m.h + 6);
      // ...begitu juga yang lewat di atas joystick: jempol sedang di situ
      const j = this.joystick?.kotak;
      if (tampak && j)
        tampak = !(x + b.w / 2 > j.l && x - b.w / 2 < j.r && cy + b.h / 2 + 8 > j.t && cy - b.h / 2 < j.b);
      b.box.setVisible(tampak);
      // label terminal memantul pelan, dua piksel layar naik-turun
      if (tampak) b.box.setPosition(x, cy - (b.pantul ? Math.round(2 + 2 * Math.sin(this.time.now / 260)) : 0));
    }
  }

  /* ---------------- minimap ---------------- */

  private mini?: Phaser.GameObjects.Image;
  private miniDots?: Phaser.GameObjects.Graphics;
  /** Penanda "kamu di sini": kepala karakternya sendiri. */
  private miniAku?: Phaser.GameObjects.Image;
  private miniBox = { x: 0, y: 0, w: 0, h: 0 };

  /**
   * Kotak minimap berikut bingkainya — yang dihindari gelembung dan nama
   * tempat. `miniBox` sendiri tetap kotak PETANYA, karena itu yang dipakai
   * memetakan koordinat dunia ke penanda.
   */
  private get miniLuar() {
    const m = this.miniBox;
    const t = m.w > 0 ? MINI_BINGKAI.tebal : 0;
    return { x: m.x - t, y: m.y - t, w: m.w + t * 2, h: m.h + t * 2 };
  }

  /**
   * Minimap dari kamera kedua Phaser selalu berderau: memperkecil dunia 624×528
   * ke ~130 px dengan nearest-neighbour membuang 4 dari 5 piksel. Ini memakai
   * gambar yang sudah diperkecil rapi oleh pipeline (lanczos), ditampilkan 1:1
   * sehingga tetap jernih — dan jauh lebih murah daripada kamera kedua.
   */
  /**
   * Meja komputer Rahmat di minimap.
   *
   * Gambar minimap dibuat dari tilemap saat build, jadi meja buatan kode
   * tidak ada di sana. Mejanya dilukis ulang dari tekstur game, dikecilkan
   * dengan penghalusan ke skala yang sama dengan petanya (3 atau 4 piksel per
   * petak) — seperti peta mini itu sendiri dikecilkan dari peta penuh —
   * lalu ditaruh di atas gambar peta, di bawah penanda.
   */
  private pasangMejaMini(key: string, lebarMini: number) {
    const world = this.scene.get('World') as WorldScene;
    const lukis = world?.lukisanMeja();
    if (!lukis) return undefined;
    const s = lebarMini / world.mapPixelSize.w;
    const tex = `meja_${key}`;
    if (!this.textures.exists(tex)) {
      const w = Math.max(1, Math.round(lukis.kanvas.width * s));
      const h = Math.max(1, Math.round(lukis.kanvas.height * s));
      const k = this.textures.createCanvas(tex, w, h)!;
      const ctx = k.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(lukis.kanvas, 0, 0, w, h);
      k.refresh();
    }
    const img = this.add.image(0, 0, tex).setOrigin(0).setDepth(90.5);
    return { img, x: Math.round(lukis.x * s), y: Math.round(lukis.y * s) };
  }

  private buildMinimap() {
    // Layar sentuh memakai versi 2 px/tile; versi desktop memakan hampir
    // separuh lebar layar ponsel.
    const key = this.wantsTouch ? 'map_mini_sm' : 'map_mini';
    const tex = this.textures.get(key).getSourceImage();
    const w = (tex as HTMLImageElement).width;
    const h = (tex as HTMLImageElement).height;

    this.mini = this.add.image(0, 0, key).setOrigin(0).setDepth(90);
    const meja = this.pasangMejaMini(key, w);
    this.miniDots = this.add.graphics().setDepth(91);
    /*
     * Kepalanya sendiri, bukan kotak putih.
     *
     * Kotak putih beralas gelap sebenarnya terbaca jelas — masalahnya ia
     * terbaca sebagai PENANDA, sama seperti kotak kuning milik tempat-tempat
     * tujuan, cuma beda warna. Kepala tidak perlu dibaca dua kali: ia langsung
     * dikenali sebagai orangnya.
     */
    if (this.textures.exists('kepala')) {
      const ikon = this.textures.exists('kepala_rahmat') ? 'kepala_rahmat' : 'kepala';
      this.miniAku = this.add.image(0, 0, ikon).setOrigin(0.5).setDepth(91.5);
    }
    this.miniBox = { x: 0, y: 0, w, h };

    /*
     * Bingkainya aset gambar, bukan lagi tiga persegi panjang yang digambar
     * Graphics. Yang digambar kode cuma bisa berupa garis rata: tidak ada
     * bevel, tidak ada paku, tidak ada sudut tumpul.
     *
     * Dipasang sebagai nine-patch supaya satu aset melayani dua ukuran
     * minimap (156×132 dan 117×99) — sudutnya ikut apa adanya, sisinya yang
     * diregangkan. Tengahnya transparan, jadi ini benar-benar cincin yang
     * duduk DI ATAS peta: depth-nya di atas penanda supaya penanda yang
     * kebetulan menempel tepi ikut terpotong rapi oleh bingkainya.
     */
    const T = MINI_BINGKAI.tebal;
    const P = MINI_BINGKAI.potong;
    const bingkai = this.textures.exists('minimap_frame')
      ? this.add
          .nineslice(0, 0, 'minimap_frame', undefined, w + T * 2, h + T * 2, P, P, P, P)
          .setOrigin(0)
          .setDepth(92)
      : null;

    const place = () => {
      // Jaraknya diukur dari tepi LUAR bingkai, bukan dari tepi petanya:
      // bingkainya menjorok keluar T piksel.
      const pad = 10 + T;
      // Di perangkat sentuh sudut kiri-bawah milik joystick, jadi minimap
      // naik ke kanan atas — tepat di ruang bekas tombol MAP dan FX.
      const touch = this.wantsTouch;
      const x = Math.round(touch ? this.scale.width - w - pad : pad);
      const y = Math.round(touch ? 62 + T : this.scale.height - h - pad);
      this.miniBox.x = x;
      this.miniBox.y = y;
      this.mini!.setPosition(x, y);
      meja?.img.setPosition(x + meja.x, y + meja.y);
      bingkai?.setPosition(x - T, y - T);
      // Tombol gir Setelan (DOM, khusus layar kecil) duduk tepat di bawah
      // bingkai ini. Kanvasnya menutupi seluruh jendela tanpa zoom, jadi
      // piksel scene sama dengan piksel CSS.
      document.documentElement.style.setProperty('--mini-bawah', `${y + h + T}px`);
    };
    place();
    this.scale.on('resize', place);

    // klik minimap → buka peta besar (bukan langsung pindah:
    // di ukuran sekecil ini jari/kursor tidak bisa memilih tujuan dengan akurat)
    this.mini
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => {
        // sentuhan yang mendarat di panel/menu di atasnya bukan untuk minimap
        if (!diKanvas(p)) return;
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
    // Komputer Rahmat: tempat tujuan juga, jadi penandanya sama kuning. Ia
    // duduk di tempat berdiri depan kursi — "pintu" mejanya — bukan di atas
    // meja: meja mini cuma 7-9 piksel, dan kotak penanda akan menutupinya
    // habis. Mejanya sendiri dilukis di bawahnya (pasangMejaMini).
    const t = world.depanTerminal;
    if (t) {
      const q = toMini(t.x, t.y);
      penanda(q.x, q.y, 0xf2c438);
    }
    const me = toMini(world.hero.x, world.hero.y);
    if (this.miniAku) {
      /*
       * Dijaga tetap di dalam kotak petanya. Kepala ini digambar dari titik
       * tengah, jadi di tepi peta separuhnya akan menjulur ke luar dan
       * menabrak bingkai logamnya.
       */
      const w2 = this.miniAku.width / 2;
      const h2 = this.miniAku.height / 2;
      this.miniAku.setPosition(
        Math.round(Phaser.Math.Clamp(me.x, bx + w2, bx + w - w2)),
        Math.round(Phaser.Math.Clamp(me.y, by + h2, by + h - h2))
      );
    } else {
      penanda(me.x, me.y, 0xffffff);
      g.lineStyle(1, 0xe0563f, 1).strokeRect(Math.round(me.x) - 4, Math.round(me.y) - 4, 8, 8);
    }
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
  /**
   * Baris piksel terisi paling atas pada frame yang sedang tampil (di-cache).
   *
   * Dibaca dengan SATU getImageData per frame. Versi pertama memanggil
   * getPixelAlpha untuk tiap piksel — sampai 1024 kali, dan tiap panggilan
   * menggambar ulang lalu membaca kanvas — untuk setiap frame animasi baru
   * milik warga yang sedang bicara. Di ponsel itu terasa sebagai lag parah.
   */
  private kepalaCache = new Map<string, number>();
  private kanvasBaca?: CanvasRenderingContext2D;
  private barisKepala(s: Phaser.GameObjects.Sprite) {
    const kunci = `${s.texture.key}#${s.frame.name}`;
    const ada = this.kepalaCache.get(kunci);
    if (ada !== undefined) return ada;
    const f = s.frame;
    const w = f.cutWidth;
    const h = f.cutHeight;
    let baris = 0;
    try {
      if (!this.kanvasBaca) {
        this.kanvasBaca = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      }
      const c = this.kanvasBaca;
      c.canvas.width = w;
      c.canvas.height = h;
      c.clearRect(0, 0, w, h);
      c.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
      const data = c.getImageData(0, 0, w, h).data;
      cari: for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 0) {
            baris = y;
            break cari;
          }
        }
      }
    } catch {
      baris = Math.round(h * 0.35);
    }
    this.kepalaCache.set(kunci, baris);
    return baris;
  }

  /** Apakah kotak gelembung berpusat (cx, cy) menimpa minimap atau tombol gir. */
  private menabrak(cx: number, cy: number, w: number, h: number) {
    const kotak = [];
    const m = this.miniLuar;
    if (m.w > 0) kotak.push({ l: m.x, t: m.y, r: m.x + m.w, b: m.y + m.h });
    const g = this.rintangan;
    if (g) kotak.push({ l: g.left, t: g.top, r: g.right, b: g.bottom });
    const j = this.joystick?.kotak;
    if (j) kotak.push(j);
    const jarak = 8;
    return kotak.some(
      (k) => cx + w / 2 > k.l - jarak && cx - w / 2 < k.r + jarak && cy + h / 2 > k.t - jarak && cy - h / 2 < k.b + jarak
    );
  }

  /**
   * Apakah kotak gelembung berpusat (cx, cy) menimpa label tempat yang
   * sedang tampil. Label yang ikut benda bergerak (ASK AI di atas MATS-BOT)
   * tidak dihitung: ia menempel ke pembicaranya sendiri.
   */
  private menutupLabel(cx: number, cy: number, w: number, h: number) {
    return this.poiBubbles.some(({ box, w: lw, h: lh, ikut }) => {
      if (ikut || !box.visible) return false;
      const t = box.y - lh / 2;
      const b = box.y + lh / 2 + 8;
      return cx + w / 2 > box.x - lw / 2 - 4 && cx - w / 2 < box.x + lw / 2 + 4 && cy + h / 2 > t - 4 && cy - h / 2 < b + 4;
    });
  }

  /** Tutup gelembung warga sekarang juga (menjauh / keluar layar). */
  private tutupBubble() {
    this.sasaran = undefined;
    this.hideAt = 0;
    this.bubbleTutup.disableInteractive();
    this.tweens.add({ targets: this.bubble, alpha: 0, duration: 160 });
  }

  /**
   * `hindari`: geser menjauhi minimap — untuk gelembung pemain saja. Gelembung
   * warga tetap di atas warganya walau menimpa minimap sebentar (digambar di
   * atasnya); digeser ke samping, ia terbaca seperti ucapan orang lain.
   * `balik`: gelembung di BAWAH pembicara, ekornya menunjuk ke atas.
   */
  private tempatkanBubble(x: number, y: number, hindari = true, balik = false) {
    const { w, h } = this.ukuranBubble;
    this.bubbleEkor.setY(balik ? -h / 2 : h / 2).setScale(1, balik ? -1 : 1);
    const lebar = this.scale.width;
    let atas = this.batasAtas + h / 2; // di bawah bilah menu
    let bawah = this.scale.height - h / 2 - 10;
    const py0 = Phaser.Math.Clamp(y, atas, Math.max(atas, bawah));

    let kiri = w / 2 + 10;
    let kanan = lebar - w / 2 - 10;
    const m = this.miniLuar;
    // hanya kalau tingginya memang bersinggungan dengan minimap
    const sejajar = hindari && m.w > 0 && py0 + h / 2 > m.y - 10 && py0 - h / 2 < m.y + m.h + 10;
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

    // tombol gir Setelan (DOM) selalu di atas kanvas: gelembung minggir darinya
    const g = this.rintangan;
    const pyUji = muat ? py0 : Phaser.Math.Clamp(y, atas, Math.max(atas, bawah));
    if (g && pyUji + h / 2 > g.top - 6 && pyUji - h / 2 < g.bottom + 6) {
      kanan = Math.min(kanan, g.left - 8 - w / 2);
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
    /*
     * Selagi karakternya berjalan, isi gelembung menipis sampai tembus
     * pandang: jalan dan pintu di belakangnya kelihatan, jadi gelembung tidak
     * lagi menghalangi orang yang sedang menuju suatu tempat. Berhenti,
     * gelembungnya pekat lagi untuk dibaca.
     */
    const v = (hero.body as Phaser.Physics.Arcade.Body | null)?.velocity;
    const tuju = v && v.lengthSq() > 4 ? 0.28 : 1;
    if (this.tembus !== tuju) {
      this.tembus += (tuju - this.tembus) * 0.18;
      if (Math.abs(tuju - this.tembus) < 0.01) this.tembus = tuju;
      for (const c of [this.bubbleBg, this.bubbleEkor, this.bubbleText, this.bubbleNama]) c.setAlpha(this.tembus);
    }
    const cam = world.cameras.main;
    if (this.sasaran?.active) {
      // Ekor gelembung menunjuk tepat di atas KEPALA warga, bukan di atas
      // bingkai gambarnya. Bingkainya sering jauh lebih tinggi dari orangnya
      // — pemuda yang duduk di bangku kepalanya ada di tengah bingkai — dan
      // gelembung yang diukur dari tepi bingkai melayang jauh di atasnya.
      const s = this.sasaran;
      const atas = s.y - s.displayHeight * s.originY + this.barisKepala(s) * Math.abs(s.scaleY);
      const kaki = s.y + s.displayHeight * (1 - s.originY);
      // Menjauh dari warganya atau warganya keluar layar → gelembung ditutup,
      // bukan ditahan di tepi layar (yang terbaca seperti ikut berjalan).
      const jauh = Phaser.Math.Distance.Between(hero.x, hero.y, s.x, s.y) > 170;
      // layar() mengembalikan vektor yang SAMA tiap dipanggil — salin dulu
      const t = { ...this.layar(cam, s.x, atas) } as { x: number; y: number };
      const tk = { ...this.layar(cam, s.x, kaki) } as { x: number; y: number };
      if (jauh || t.x < 0 || t.x > this.scale.width || tk.y < this.batasAtas || t.y > this.scale.height) {
        this.tutupBubble();
        return;
      }
      const { w, h } = this.ukuranBubble;
      /*
       * Di atas kepala kalau muat dan tidak menutupi minimap atau tombol gir;
       * kalau tidak, di bawah kaki (ekor menunjuk ke atas). Gelembung tidak
       * boleh menutupi peta — dan kalau digeser jauh ke samping ia tidak lagi
       * terbaca sebagai ucapan warga itu. Kalau di bawah pun tidak muat,
       * baru ia minggir ke samping menjauhi minimap.
       */
      const yAtas = t.y - 16 - h / 2;
      const yBawah = tk.y + 16 + h / 2;
      const px = Phaser.Math.Clamp(t.x, w / 2 + 10, this.scale.width - w / 2 - 10);
      const bebas = (cy: number) =>
        cy - h / 2 >= this.batasAtas && cy + h / 2 <= this.scale.height - 10 && !this.menabrak(px, cy, w, h);
      // Lebih baik lagi kalau juga tidak menutupi label tempat (ABOUT ME,
      // TERMINAL, …): itu yang sedang dicari pengunjung untuk diketuk.
      if (bebas(yAtas) && !this.menutupLabel(px, yAtas, w, h)) this.tempatkanBubble(t.x, yAtas, false, false);
      else if (bebas(yBawah) && !this.menutupLabel(px, yBawah, w, h)) this.tempatkanBubble(t.x, yBawah, false, true);
      else if (bebas(yAtas)) this.tempatkanBubble(t.x, yAtas, false, false);
      else if (bebas(yBawah)) this.tempatkanBubble(t.x, yBawah, false, true);
      else this.tempatkanBubble(t.x, yAtas, true, false);
      return;
    }
    /*
     * Diukur dari baris kepala yang sebenarnya, sama seperti gelembung warga.
     * Dulu titik TENGAH gelembungnya dipatok 46 px dunia di atas titik tengah
     * karakter — dikali zoom 2-3 dan ditambah setengah tinggi gelembungnya
     * sendiri, kotaknya melayang 70-120 px layar di atas kepala.
     */
    const kepala = hero.y - hero.displayHeight * hero.originY + this.barisKepala(hero) * Math.abs(hero.scaleY);
    const t = this.layar(cam, hero.x, kepala);
    this.tempatkanBubble(t.x, t.y - 14 - this.ukuranBubble.h / 2, true, false);
  }

  override update() {
    this.drawMiniDots();

    if (this.hideAt && this.time.now > this.hideAt) {
      this.hideAt = 0;
      this.bubbleTutup.disableInteractive();
      this.tweens.add({ targets: this.bubble, alpha: 0, duration: 200 });
    }
  }
}
