import Phaser from 'phaser';
import { ABOUT, LAMPU, LAPANGAN, UTARA, TILE, ZOOM, DEPTH, PLAYER, PENGHUNI, REMAJA, GURITA, KANDANG, HALAMAN, KUPU, PEMUDA, PETANI, TAMAN, kedalaman, skalaGambar, pakaiKontrolSentuh, diZonaJoystick, type Dir, diKanvas } from '../config';
import { Kupu } from '../objects/Kupu';
import { Sawah } from '../objects/Sawah';
import { Sungai } from '../objects/Sungai';
import { Bukit } from '../objects/Bukit';
import { buatMelirik, siapkanRahmat, siapkanWargaBaru } from '../objects/Rupa';
import { pasangPemain, sisiPemain } from '../objects/toleh';
import { Senter } from '../objects/Senter';
import { Kurir, Pedagang, bisaDiajak, siapkanTeksturWarga } from '../objects/Warga';
import { Kisi, buatTidur } from '../objects/piksel';
import { Penunjuk } from '../objects/Penunjuk';
import { MatsBot } from '../objects/MatsBot';
import { Tenggeran, TINGGI_PALANG, buatAyamTidur } from '../objects/Tenggeran';
import { blub, cangkul, ciap, kokok, lenguh, pasangTelinga, petok } from '../bunyi';
import { Burung } from '../objects/Burung';
import { Sarang } from '../objects/Sarang';
import { Nongkrong } from '../objects/Nongkrong';
import { Layangan } from '../objects/Layangan';
import { Bakso } from '../objects/Bakso';
import { Kucing } from '../objects/Kucing';
import { Jemuran } from '../objects/Jemuran';
import { Papan } from '../objects/Papan';
import { Teras } from '../objects/Teras';
import { Jendela } from '../objects/Jendela';
import { KotakSurat } from '../objects/KotakSurat';
import { Sumur } from '../objects/Sumur';
import { Anjing } from '../objects/Anjing';
import { Patung } from '../objects/Patung';
import { Sepeda } from '../objects/Sepeda';
import { Pintu } from '../objects/Pintu';
import { Bendera } from '../objects/Bendera';
import { Engklek } from '../objects/Engklek';
import { Prestasi } from '../objects/Prestasi';
import { Ronda } from '../objects/Ronda';
import { Ayunan } from '../objects/Ayunan';
import { Umbul } from '../objects/Umbul';
import { Ngopi } from '../objects/Ngopi';
import { Bola } from '../objects/Bola';
import { PembeliKios, TamuRonda } from '../objects/Tamu';
import { Hujan, type ModeCuaca } from '../objects/Hujan';
import { TerasCV } from '../objects/TerasCV';
import { Goyang } from '../objects/Goyang';
import { Daun } from '../objects/Daun';
import { Tajuk } from '../objects/Tajuk';
import { Arus } from '../objects/Arus';
import { Debu } from '../objects/Debu';
import { Nyapu } from '../objects/Nyapu';
import { Hiasan } from '../objects/Hiasan';
import { cuaca } from '../cuaca';
import { gelapAtauHujan } from '../cuaca';
import { Suasana, type ModeWaktu } from '../objects/Suasana';
import { SuaraLatar } from '../objects/SuaraLatar';
import { Kelelawar } from '../objects/Kelelawar';
import { BurungHantu } from '../objects/BurungHantu';
import { Tokek } from '../objects/Tokek';
import { Kodok } from '../objects/Kodok';
import { Laron } from '../objects/Laron';
import { KilauSungai } from '../objects/KilauSungai';
import { Asap } from '../objects/Asap';
import { NasiGoreng } from '../objects/NasiGoreng';
import { Hansip } from '../objects/Hansip';
import { KembangApi } from '../objects/KembangApi';
import { Penghuni } from '../objects/Penghuni';
import { Player } from '../objects/Player';
import { ThunderFx } from '../objects/ThunderFx';
import { pasangPemangkasan, pasangUrutHemat } from '../hemat';
import { FALLBACK_POIS, FALLBACK_SPAWN, GREETING_START, PINTU, POI_DEKAT, type Poi } from '../poi';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private fx!: ThunderFx;
  private map!: Phaser.Tilemaps.Tilemap;
  private pois: Poi[] = [];
  private blocked!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private busy = false;
  private debug?: Phaser.GameObjects.Graphics;
  /** Tujuan tap-to-move; null kalau sedang tidak berjalan otomatis. */
  private walkTarget: Phaser.Math.Vector2 | null = null;
  /** Sentuhan mana yang dimulai di area joystick — per id pointer. */
  private mulaiDiJoystick = new Map<number, boolean>();
  /** POI yang jangkauannya sedang dipijak; null kalau tidak dekat mana pun. */
  private poiDidalam: string | null = null;
  /** POI yang sedang dikitari dari samping/belakang — petunjuknya sudah diberikan. */
  private poiDisekitar: string | null = null;
  /** Disimpan supaya bisa dipanggil dari konsol saat mengetes (`__game…sungai`). */
  sungai?: Sungai;
  sarang?: Sarang;
  suasana?: Suasana;
  /** Semua warga yang berjalan/berdiri — mereka yang membawa senter di malam hari. */
  private orang: Phaser.GameObjects.Sprite[] = [];
  /** Lentera minyak untuk warga yang tangannya sibuk — lihat Senter.lentera(). */
  private lentera: { x: number; y: number; dasar?: number }[] = [];
  burung?: Burung;
  /** Meja kerja Rahmat di teras About: tujuan keTerminal(). */
  private teras?: Teras;
  /** Tempat berdiri di depan kursi terminal — penanda minimap. */
  get depanTerminal() {
    return this.teras?.depanKursi;
  }

  /** Meja kerja Rahmat sebagai kanvas berkoordinat dunia, untuk peta desa. */
  lukisanMeja() {
    return this.teras?.lukisanPeta();
  }
  /** Permintaan ke terminal yang menunggu perjalanan lain selesai. */
  private terminalMenunggu = false;
  /** Titik gantung label "TERMINAL" di atas komputer Rahmat — dibaca UIScene. */
  titikTerminal?: { x: number; y: number };
  /** MATS-BOT, robot pendamping; UIScene menggantung label "ASK AI" di atasnya. */
  bot?: MatsBot;
  /** Disimpan untuk dites dari konsol, seperti `sungai`. */
  kembangApi?: KembangApi;
  nasgor?: NasiGoreng;
  hujan?: Hujan;
  hansip?: Hansip;
  private kurir?: Kurir;
  /** Apakah titik dunia ini tanah kering (bukan air) — lihat pembacaAir(). */
  private kering?: (x: number, y: number) => boolean;
  /** Grid tabrakan untuk kurir dan burung — benda buatan kode ditandai di sini juga. */
  private kisi?: Kisi;
  private petunjukTerakhir = 0;
  /** Penunjuk pintu per POI: panah memantul + lingkaran di tanah (lihat Penunjuk). */
  private penunjuk = new Map<string, Penunjuk>();
  /** Titik gantung gelembung per POI — dihitung sekali, dipakai berkali-kali. */
  private gantungan = new Map<string, { x: number; y: number }>();

  /** Sudah dibangun di balik layar loading dan menunggu PLAY — lihat tampilkan(). */
  menunggu = false;
  private spawn = { x: 0, y: 0 };
  /** Geseran kamera selama desa jadi latar layar judul — lihat latarJudul(). */
  private geserJudul: Phaser.Tweens.Tween[] = [];
  /** Tile padat yang digambar satu per satu, dengan gid-nya — tajuk pohon digoyang dari sini. */
  private padatGambar: { img: Phaser.GameObjects.Image; gid: number }[] = [];

  constructor() {
    super('World');
  }

  /**
   * Dunia dibangun di balik layar loading (PreloadScene meluncurkannya
   * dengan `tunda`), bukan saat PLAY ditekan: ±340 tekstur buatan kode dan
   * seribu lebih objek butuh hampir satu detik di ponsel, dan dulu detik itu
   * jatuh tepat setelah layar judul memudar — layar hitam yang macet.
   * Dengan `tunda`, create() berhenti sebelum apa pun tampil atau berbunyi;
   * sisanya dijalankan tampilkan().
   */
  create(data?: { tunda?: boolean }) {
    pasangPemangkasan(this);
    pasangUrutHemat(this);
    this.map = this.make.tilemap({ key: 'map' });
    // margin 1 / spacing 2 = tile di atlas di-extrude 1px; tanpa ini muncul garis jahitan
    const tiles = this.map.addTilesetImage('atlas', 'atlas', TILE, TILE, 1, 2)!;

    const order: Record<string, number> = {
      'Tile Layer 1': DEPTH.ground,
      // dibuat pipeline: permukaan yang diinjak pemain (jembatan, tangga,
      // rumput taman) — harus di bawah pemain, bukan di atasnya
      lantai: DEPTH.floor,
      'di bawah': DEPTH.below,
      'di atas map 1': DEPTH.above,
      'aset kedua': DEPTH.above + 1,
    };
    for (const l of this.map.layers) {
      // layer padat digambar per tile, bukan sebagai satu lapisan — lihat gambarPadat()
      if (l.name.startsWith('padat')) continue;
      const layer = this.map.createLayer(l.name, tiles, 0, 0)!;
      layer.setDepth(order[l.name] ?? DEPTH.below);
    }
    this.gambarPadat(tiles);

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBackgroundColor('#4a7c3f');
    // Zoom disetel di sini, sebelum penghuni dibuat: ukuran gambar mereka
    // dipilih dari zoom supaya tiap piksel gambar jatuh ke jumlah piksel layar
    // yang bulat. Kalau disetel belakangan, mereka terlanjur memakai zoom 1.
    this.cameras.main.setZoom(this.scale.width < 700 ? ZOOM.mobile : ZOOM.desktop);

    this.buildCollision();
    this.readPois();
    this.pasangPenunjukPintu();
    this.isiKandang();
    this.isiHalaman();
    this.isiTaman();
    new Bukit(this, this.blocked, this.gelap);
    this.isiKupu();
    this.taruhGurita();
    this.taruhPetani();
    this.taruhPemuda();
    new Sawah(this);
    this.sungai = new Sungai(this, this.gelap, this.adaBenda);
    this.pasangWarga();
    this.pasangSuasana();

    // ---- karakter ----
    const spawn = this.tileToWorld(...FALLBACK_SPAWN);
    siapkanRahmat(this);
    const tokoh = this.textures.exists('rahmat') ? 'rahmat' : 'player';
    Player.registerAnimations(this, tokoh);
    ThunderFx.registerAnimations(this);
    this.player = new Player(this, spawn.x, spawn.y, tokoh);
    this.physics.add.collider(this.player, this.blocked);
    this.fx = new ThunderFx(this);
    // telinga pemain: bunyi desa makin keras makin dekat, kiri-kanan ikut letaknya
    pasangTelinga(() => (this.player?.active ? { x: this.player.x, y: this.player.y + PLAYER.baseY } : undefined));
    // dan mata warga: mereka menoleh ke karakter ini saat ia lewat
    pasangPemain(() => (this.player?.active ? this.player : undefined));

    // senter di malam hari: pemain (kecuali sedang main HP/tidur) dan semua warga
    const senter = new Senter(this, () => this.suasana?.gelap ?? 0, this.penghalangCahaya());
    senter.pegang(this.player, () => this.player.direction, () => !this.player.sedangSantai);
    for (const o of this.orang) senter.pegang(o);
    for (const l of this.lentera) senter.lentera(l.x, l.y, l.dasar);
    this.pasangUtara(senter);
    this.isiPekarangan();
    this.isiLapangan(senter);
    this.pasangMalam(senter);
    this.pasangHujan();
    this.pasangHiasan();
    // pintu rumah terbuka saat pemain berjalan ke lingkaran kuning di depannya
    new Pintu(
      this,
      this.pois.map((p) => {
        const t = this.tileToWorld(...p.enterAt);
        return { id: p.id, x: t.x, y: t.y };
      }),
      () => this.player,
      () => this.suasana?.gelap ?? 0
    );

    /*
     * Ikuti tanpa pelunakan (lerp 1) DAN tanpa pembulatan.
     *
     * Saat roundPixels menyala, Phaser membulatkan gulir kamera ke piksel
     * dunia bulat (`Math.floor` di Camera.preRender), sementara posisi
     * karakternya tetap pecahan. Sisa pecahan itulah yang muncul sebagai
     * karakter bergetar satu piksel di layar.
     *
     * Terukur di 140 frame: berjalan lurus, posisi layar karakter berbalik
     * arah 7 kali; berjalan serong, 45 kali. Serong lebih parah karena
     * kecepatan per sumbunya 0,87 px/frame — melewati batas pembulatan jauh
     * lebih sering daripada 1,23 px/frame saat lurus. Posisi dunia sendiri
     * tidak pernah berbalik sekali pun, jadi yang bergetar memang karakternya,
     * bukan petanya.
     *
     * Tanpa pembulatan, gulir kamera sama persis dengan posisi karakter:
     * karakternya terpaku di satu titik dan dunia yang bergeser. Zoom-nya
     * bilangan bulat, jadi tiap piksel tekstur tetap menempati jumlah piksel
     * layar yang sama — dunia bergeser mulus tanpa piksel berubah lebar.
     */
    this.cameras.main.startFollow(this.player, false, 1, 1);
    this.cameras.main.roundPixels = false;

    this.setupInput();
    this.setupPoiClicks();

    this.spawn = spawn;
    this.player.setHidden(true);
    this.busy = true;
    if (data?.tunda) {
      this.menunggu = true;
      this.cameras.main.setVisible(false);
      return;
    }
    this.tampilkan();
  }

  /**
   * Desa yang sudah dibangun jadi latar layar judul: semua penghuninya sudah
   * berjalan, waktunya ikut jam pengunjung, dan kameranya bergeser pelan di
   * sekitar titik awal. Karakternya belum ada (ia datang bersama petir
   * setelah PLAY) dan dunia belum menerima klik.
   *
   * Dulu layar judul menggambar petanya sendiri: tile mentah tanpa satu pun
   * warga, hewan, atau benda buatan kode, dan selalu siang — kesan pertama
   * yang lebih sepi daripada desa di baliknya.
   */
  latarJudul() {
    const cam = this.cameras.main;
    cam.setVisible(true);
    cam.stopFollow();
    this.input.enabled = false;
    const z = cam.zoom;
    const { x: cx, y: cy } = this.spawn;
    const titik = { x: cx, y: cy };
    const ikut = () => {
      cam.centerOn(titik.x, titik.y);
      // dikunci ke piksel layar, seperti awan: geserannya tepat satu piksel per langkah
      cam.setScroll(Math.round(cam.scrollX * z) / z, Math.round(cam.scrollY * z) / z);
    };
    ikut();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // dua sumbu dengan periode berbeda: lintasannya melingkar, tidak terasa mengulang
    titik.x = cx - 44;
    titik.y = cy - 14;
    ikut();
    this.geserJudul = [
      this.tweens.add({ targets: titik, x: cx + 44, duration: 19000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, onUpdate: ikut }),
      this.tweens.add({ targets: titik, y: cy + 14, duration: 12000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }),
    ];
  }

  /** Buka tirai: dunia yang sudah dibangun mulai berjalan dan tampil. */
  tampilkan() {
    this.menunggu = false;
    for (const t of this.geserJudul) t.stop();
    this.geserJudul = [];
    this.input.enabled = true;
    this.cameras.main.setVisible(true);
    this.cameras.main.startFollow(this.player, false, 1, 1);
    const spawn = this.spawn;
    // spawn pembuka: karakter dihantam petir ke titik awal
    this.time.delayedCall(160, () => {
      this.fx.play(
        spawn.x,
        spawn.y,
        () => {
          this.player.setPosition(spawn.x, spawn.y);
          this.player.setHidden(false);
          this.fx.landPlayer(this.player);
        },
        () => {
          this.busy = false;
          this.emit('greet', GREETING_START);
          // baru sekarang deep-link boleh jalan — sebelum ini travelTo() ditolak
          this.emit('ready', null);
        }
      );
    });

    this.scene.launch('UI');
    // beri tahu DOM: dunia sudah tampil, menu boleh muncul.
    // Dipancarkan di sini, bukan setelah animasi petir, supaya menu tidak
    // telat sedetik dari peta yang sudah kelihatan.
    this.emit('world', null);
  }

  /* ---------------- benda padat, terurut per-y ---------------- */

  /**
   * Gambar tile padat satu per satu, tiap tile dengan kedalamannya sendiri.
   *
   * Satu lapisan tilemap cuma punya satu kedalaman, dan itu tidak pernah bisa
   * benar untuk dinding di utara maupun selatan karakter sekaligus. Sebagai
   * gambar terpisah, tiap tile bisa memakai aturan yang sama dengan karakter:
   * kedalaman = tepi bawah tile, yaitu garis tempat ia menyentuh tanah.
   *
   * 271 gambar diam tanpa fisika — tidak ada yang dihitung ulang tiap frame,
   * jadi ongkosnya cuma satu kali saat scene dibuat.
   */
  private gambarPadat(tiles: Phaser.Tilemaps.Tileset) {
    /*
     * Baris pengurut khusus dari pipeline, untuk potongan bangunan yang
     * jatuh di BAWAH dasarnya — garis bawah rumah. Kalau diurut memakai
     * baris petaknya sendiri, garis setebal dua piksel di puncak petak itu
     * seolah berdiri 14 piksel lebih ke selatan daripada tempatnya digambar,
     * lalu menutupi kepala siapa pun yang berdiri di halaman depan rumah.
     */
    const dasarBaris = (this.cache.tilemap.get('map')?.data as { dasarBaris?: number[] } | undefined)?.dasarBaris;


    // Atlas sudah dimuat sebagai satu gambar utuh. Daftarkan tiap tile yang
    // terpakai sebagai frame di tekstur yang sama, supaya tidak perlu mengunduh
    // PNG-nya untuk kedua kalinya sebagai spritesheet.
    const tex = this.textures.get('atlas');
    const langkah = TILE + tiles.tileSpacing;
    let jumlah = 0;

    for (const data of this.map.layers) {
      if (!data.name.startsWith('padat')) continue;
      for (const baris of data.data) {
        for (const t of baris) {
          if (!t || t.index < 0) continue;
          const lokal = t.index - tiles.firstgid;
          const nama = `t${lokal}`;
          if (!tex.has(nama)) {
            tex.add(
              nama,
              0,
              tiles.tileMargin + (lokal % tiles.columns) * langkah,
              tiles.tileMargin + Math.floor(lokal / tiles.columns) * langkah,
              TILE,
              TILE
            );
          }
          const img = this.add
            .image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, 'atlas', nama)
            .setFlip(t.flipX, t.flipY)
            .setDepth(kedalaman((dasarBaris?.[t.y * this.map.width + t.x] || t.y + 1) * TILE));
          this.padatGambar.push({ img, gid: lokal + 1 });
          jumlah++;
        }
      }
    }
    if (!jumlah) console.warn('[mapporto] tidak ada layer "padat" — jalankan npm run build:map');
  }

  /* ---------------- collision ---------------- */

  /**
   * Titik dunia yang menahan sorot senter: di dalam kotak tabrakan sel yang
   * berisi tile padat — pagar, tanggul, dinding, batu, batang pohon.
   *
   * Sel terhalang TANPA tile padat sengaja dilewatkan. Itu air dan tebing di
   * layer dasar: orang tidak bisa berjalan ke sana, tapi cahaya tetap jatuh
   * ke permukaan sungai di depannya.
   */
  private penghalangCahaya(): ((x: number, y: number) => boolean) | undefined {
    const raw = this.cache.tilemap.get('map')?.data as
      | { autoCollision?: number[]; collisionRects?: ([number, number, number, number] | null)[] }
      | undefined;
    if (!raw?.autoCollision) return undefined;
    const W = this.map.width;
    const H = this.map.height;
    const padat = this.map.layers.filter((l) => l.name.startsWith('padat'));
    const kotak: ([number, number, number, number] | null)[] = raw.autoCollision.map((isi, i) => {
      const x = i % W;
      const y = (i / W) | 0;
      if (!isi || !padat.some((l) => (l.data[y]?.[x]?.index ?? -1) > 0)) return null;
      return raw.collisionRects?.[i] ?? [x * TILE, y * TILE, TILE, TILE];
    });
    return (x, y) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
      const k = kotak[ty * W + tx];
      return !!k && x >= k[0] && x < k[0] + k[2] && y >= k[1] && y < k[1] + k[3];
    };
  }

  private buildCollision() {
    this.blocked = this.physics.add.staticGroup();
    const raw = this.cache.tilemap.get('map')?.data as
      | { autoCollision?: number[]; collisionRects?: ([number, number, number, number] | null)[] }
      | undefined;

    // layer `collisions` dari Tiled selalu menang atas tebakan otomatis
    const fromTiled = this.map.getObjectLayer('collisions');
    if (fromTiled?.objects.length) {
      for (const o of fromTiled.objects) {
        const w = o.width ?? TILE;
        const h = o.height ?? TILE;
        const r = this.add.rectangle((o.x ?? 0) + w / 2, (o.y ?? 0) + h / 2, w, h);
        this.physics.add.existing(r, true);
        this.blocked.add(r);
      }
      return;
    }

    if (!raw?.autoCollision) {
      console.warn('[mapporto] tidak ada collision — karakter bisa jalan ke mana saja');
      return;
    }

    /*
     * Kotak tabrakan mengikuti GAMBAR bendanya, bukan petaknya.
     *
     * Pipeline mengirim satu kotak per sel terhalang, seukuran piksel terisi
     * tile di sel itu. Dinding bawah rumah About, misalnya, cuma digambar
     * setinggi 8 dari 16 piksel — dan delapan piksel udara di bawahnya dulu
     * ikut memblokir, sehingga karakter berhenti dengan sejalur rumput
     * menganga di antara dia dan rumahnya.
     *
     * Yang bersebelahan mendatar DAN setinggi sama tetap digabung jadi satu
     * rectangle, seperti sebelumnya — itu yang menahan jumlah body fisika
     * tetap kecil.
     */
    const { width: W, height: H } = this.map;
    const g = raw.autoCollision;
    const kotak = raw.collisionRects;
    const petak = (i: number): [number, number, number, number] =>
      kotak?.[i] ?? [(i % W) * TILE, ((i / W) | 0) * TILE, TILE, TILE];

    for (let y = 0; y < H; y++) {
      let mulai = -1;
      let acuan: [number, number, number, number] | null = null;
      const tutup = (x: number) => {
        if (mulai < 0 || !acuan) return;
        const kiri = petak(y * W + mulai)[0];
        const kanan = petak(y * W + (x - 1));
        const lebar = kanan[0] + kanan[2] - kiri;
        const r = this.add.rectangle(kiri + lebar / 2, acuan[1] + acuan[3] / 2, lebar, acuan[3]);
        this.physics.add.existing(r, true);
        this.blocked.add(r);
        mulai = -1;
        acuan = null;
      };
      for (let x = 0; x <= W; x++) {
        const i = y * W + x;
        const isi = x < W && g[i];
        if (!isi) {
          tutup(x);
          continue;
        }
        const k = petak(i);
        // hanya digabung kalau tinggi dan letak tegaknya sama persis
        if (acuan && (k[1] !== acuan[1] || k[3] !== acuan[3])) tutup(x);
        if (mulai < 0) {
          mulai = x;
          acuan = k;
        }
      }
    }
  }

  /* ---------------- penghuni ---------------- */

  private kupu: Kupu[] = [];

  /** Kotak jelajah di dalam sebuah petak, disisakan seukuran gambarnya. */
  private jelajah(petak: { x0: number; y0: number; x1: number; y1: number }, jenis: string) {
    const aturan = PENGHUNI[jenis];
    // ukuran gambar setelah diperkecil — jarak amannya ikut menyusut
    const k = skalaGambar(aturan, this.cameras.main.zoom);
    const g = { lebar: aturan.gambar.lebar * k, tinggi: aturan.gambar.tinggi * k };
    const kiri = Math.round(petak.x0 * TILE + g.lebar / 2 + 1);
    const kanan = Math.round((petak.x1 + 1) * TILE - g.lebar / 2 - 1);
    // Sisi atas disisakan setinggi gambarnya: yang dijaga posisi KAKI, jadi
    // tanpa ini kepalanya menyembul lewat pagar di baris atas.
    const atas = Math.round(petak.y0 * TILE + g.tinggi + 3);
    const bawah = Math.round((petak.y1 + 1) * TILE - 4);
    return new Phaser.Geom.Rectangle(kiri, atas, kanan - kiri, bawah - atas);
  }

  private taruh(key: string, jenis: string, area: Phaser.Geom.Rectangle) {
    if (!this.textures.exists(key)) return;
    Penghuni.registerAnimations(this, key, PENGHUNI[jenis]);
    return new Penghuni(
      this,
      Phaser.Math.Between(area.left, area.right),
      Phaser.Math.Between(area.top, area.bottom),
      key,
      PENGHUNI[jenis],
      area
    );
  }

  /**
   * Dua sapi di kandang, satu jantan satu betina.
   *
   * Tiap sapi dapat jalur horizontalnya sendiri. Kandangnya cuma 3 tile lebar
   * sementara badan sapinya 22px, jadi tanpa pembagian jalur keduanya akan
   * sering saling menembus — dan itu jauh lebih kentara pada benda sebesar
   * sapi daripada pada ayam.
   */
  /** Seberapa gelap desa sekarang — dibaca malas, karena Suasana dibuat belakangan. */
  private gelap = () => this.suasana?.gelap ?? 0;

  private isiKandang() {
    const jenis = ['sapi_jantan', 'sapi_betina'];
    // sapi rebahan: kaki (baris 26-29 frame samping) dilipat ke bawah perut
    for (const k of jenis) buatTidur(this, k, `${k}_tidur`, 32, 32, 0, 26, 4);
    const penuh = this.jelajah(KANDANG.dalam, 'sapi');
    const jalur = penuh.height / jenis.length;
    jenis.forEach((key, i) => {
      // dipangkas 60% supaya ada sela di antara dua jalur
      const area = new Phaser.Geom.Rectangle(
        penuh.x,
        Math.round(penuh.y + i * jalur),
        penuh.width,
        Math.round(jalur * 0.6)
      );
      const sapi = this.taruh(key, 'sapi', area);
      if (!sapi) return;
      // malam hari rebah di tempatnya berdiri, dengkurnya melayang
      sapi.aturTidur({ gelap: this.gelap, tekstur: `${key}_tidur`, kanan: i === 1, dengkur: true });
      sapi.aturSuara(lenguh, 22000, 48000);
      sapi.bisaDiklik(lenguh);
    });
  }

  /**
   * Halaman depan rumah About: satu warga dan tiga ayam.
   *
   * Di sini tidak ada pembagian jalur. Semuanya kecil dan kedalamannya sudah
   * mengikuti garis pijak masing-masing, jadi saat berpapasan urutannya tetap
   * terbaca benar — dan ayam yang sesekali bersinggungan justru bikin
   * halamannya terasa hidup, bukan seperti barisan yang diatur.
   */
  private isiHalaman() {
    const wargaArea = this.jelajah(HALAMAN.dalam, 'warga');
    const warga = this.taruh('woman', 'warga', wargaArea);
    if (warga) this.orang.push(warga);
    // menoleh ke tamunya, dan masuk ke rumah About menjelang magrib (pintunya x 180-193, dasar y 263)
    warga?.aturToleh(() => this.player);
    warga?.aturPulang(this.gelap, { x: 187, y: 268 });
    if (warga) bisaDiajak(this, warga, 'Villager', ["Hi there! Rahmat's house is right behind me — the door is at the front."]);

    const ayamArea = this.jelajah(HALAMAN.dalam, 'ayam');
    /*
     * Malam hari ayamnya naik ke tenggeran bambu di pojok tenggara halaman,
     * di bawah sarang telur, dan tidur berjajar. Yang pertama bangun di pagi
     * hari berkokok.
     */
    // genangan biru hiasan peta (lantai 15,21) tepat di bawah kandangnya dibuang
    this.map.removeTileAt(15, 21, true, true, 'lantai');
    // atapnya berhenti di y 319, tepat di bawah sarang telur (dasar 318)
    const tenggeran = new Tenggeran(this, 248, 353, this.blocked);
    for (const k of ['ayam_merah', 'ayam_hijau']) buatAyamTidur(this, k);
    buatTidur(this, 'anak_ayam', 'anak_ayam_tidur', 16, 16, 0, 14, 1);
    let kokokTerakhir = -Infinity;
    ['ayam_merah', 'ayam_hijau', 'ayam_merah'].forEach((key, i) => {
      const ayam = this.taruh(key, 'ayam', ayamArea);
      if (!ayam) return;
      ayam.aturTidur({
        gelap: this.gelap,
        tekstur: `${key}_tidur`,
        tempat: tenggeran.tempat[i],
        naik: TINGGI_PALANG,
        kanan: i === 2,
        bangun: (a) => {
          if (this.time.now - kokokTerakhir < 20000) return;
          kokokTerakhir = this.time.now;
          this.time.delayedCall(700, () => kokok(a.x, a.y));
        },
      });
      ayam.aturSuara((x, y) => petok(x, y), 7000, 20000);
      ayam.bisaDiklik((x, y) => petok(x, y, true));
      // dikejar: lari terbirit-birit sambil berkotek panjang
      ayam.aturKabur(() => this.player, (x, y) => petok(x, y, true));
    });

    // sarang telur di sisi timur halaman, dekat pagar; anak ayamnya menetas
    // dari sini lalu ikut berkeliaran di halaman
    {
      const anak = this.taruh('anak_ayam', 'anak_ayam', this.jelajah(HALAMAN.dalam, 'anak_ayam'));
      // anak ayam yang baru menetas tidur di bawah tenggeran, dekat induknya
      anak?.aturTidur({ gelap: this.gelap, tekstur: 'anak_ayam_tidur', tempat: { x: 252, y: 356 } });
      anak?.aturSuara(ciap, 6000, 15000);
      anak?.bisaDiklik(ciap);
      anak?.aturKabur(() => this.player, ciap);
      this.sarang = new Sarang(this, 16 * TILE + TILE / 2, 20 * TILE - 2, anak);
    }
  }

  /**
   * Taman berpagar: sekawanan anak ayam.
   *
   * Dalamnya cuma dua baris tinggi, jadi jelajahnya nyaris seluruhnya
   * mendatar — dan itu justru pas, kawanan yang berbaris menyusuri taman
   * memanjang. Sapi tidak muat di sini: badannya 21px sementara ruang
   * tegaknya cuma 32px, tersisa 4px untuk bergerak.
   *
   * Kantong paling kanan cuma 3 tile lebar, jadi diisi satu ekor saja.
   */
  private isiTaman() {
    for (const petak of TAMAN) {
      const area = this.jelajah(petak, 'anak_ayam');
      const lebar = petak.x1 - petak.x0 + 1;   // batas kanan ikut terhitung
      const jumlah = lebar >= 5 ? 2 : 1;
      for (let n = 0; n < jumlah; n++) {
        const anak = this.taruh('anak_ayam', 'anak_ayam', area);
        if (!anak) continue;
        // di taman tidak ada induk: anak-anak ayamnya berkumpul di pojok kiri kantongnya
        anak.aturTidur({
          gelap: this.gelap,
          tekstur: 'anak_ayam_tidur',
          tempat: { x: Math.round(area.left + 4 + n * 6), y: Math.round(area.bottom - 1) },
          kanan: n === 1,
        });
        anak.aturSuara(ciap, 6000, 16000);
        anak.bisaDiklik(ciap);
        anak.aturKabur(() => this.player, ciap);
      }
    }
  }

  /**
   * Gurita raksasa di sungai.
   *
   * Sprite tunggal, bukan tile yang ditempel di map. Alasannya animasi:
   * tentakelnya mengayun, dan tile tidak bisa mengayun. Sekalian itu
   * menghindarkannya dari auto-collision — kalau ia berupa tile, tentakel
   * yang naik ke rumput akan ikut menahan langkah, dan seluruh badannya
   * dinilai satu per satu petak oleh aturan yang dibuat untuk pohon dan pagar.
   *
   * Kedalamannya diambil dari tepi BAWAH gambarnya, bukan dari tengah
   * badannya. Itu yang benar untuk hewan yang menjulur ke dua tepi: tentakel
   * yang menjalar ke rumput selatan harus tergambar DI ATAS rumputnya, dan
   * pemain yang lewat di seberang utara harus tergambar DI BELAKANG tentakel
   * yang menghalanginya — persis seperti benda lain yang lebih ke selatan.
   */
  private taruhGurita() {
    if (!this.textures.exists('gurita')) return;
    const { di, frameHeight: tinggi, frame, fps } = GURITA;
    if (!this.anims.exists('gurita_ayun')) {
      this.anims.create({
        key: 'gurita_ayun',
        frames: this.anims.generateFrameNumbers('gurita', { start: 0, end: frame - 1 }),
        frameRate: fps,
        repeat: -1,
      });
    }
    const g = this.add
      .sprite(di.x * TILE, di.y * TILE, 'gurita', 0)
      .setOrigin(0)
      .setDepth(kedalaman(di.y * TILE + tinggi))
      .play('gurita_ayun');
    // gelembung naik dari dekat badannya, sesekali: "blub-blub"
    this.time.addEvent({
      delay: 5200,
      loop: true,
      callback: () => Math.random() < 0.6 && blub(g.x + g.width / 2, g.y + g.height / 2),
    });
  }

  /**
   * Warga yang mencangkul di petak sawah timur.
   *
   * Sprite tunggal seperti guritanya, dengan satu bedanya: ia berpijak di
   * tanah, jadi urutan gambarnya memakai aturan yang sama dengan penghuni
   * lain — titik acuan di kaki, kedalaman dari garis pijak itu. Dengan begitu
   * pemain yang lewat di depannya menutupinya, dan yang lewat di belakangnya
   * tertutup olehnya.
   */
  private taruhPetani() {
    if (!this.textures.exists('petani')) return;
    // petani bercaping — lihat Rupa.ts
    siapkanWargaBaru(this);
    const lembar = this.textures.exists('petani_caping') ? 'petani_caping' : 'petani';
    const { di, frame, fps, jeda } = PETANI;
    if (!this.anims.exists('petani_cangkul')) {
      this.anims.create({
        key: 'petani_cangkul',
        frames: this.anims.generateFrameNumbers(lembar, { start: 0, end: frame - 1 }),
        frameRate: fps,
        repeat: -1,
        repeatDelay: jeda,
      });
    }
    const x = di.x * TILE + TILE / 2;
    const y = di.y * TILE;
    const petani = this.add.sprite(x, y, lembar, 0).setOrigin(0.5, 1).setDepth(kedalaman(y)).play('petani_cangkul');
    // berhenti mencangkul dan melirik ke pemain yang lewat
    buatMelirik(this, lembar, 'petani_toleh');
    this.menolehSaatLewat(petani, 'petani_cangkul', 'petani_toleh', x, y);
    // mata cangkul menghantam tanah di frame terakhir tiap ayunan
    petani.on('animationupdate', (_a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => {
      if (f.index === frame) cangkul(x + 12, y);
    });
    // kedua tangannya memegang cangkul: di malam hari lenteranya ditaruh di tanah, bukan senter
    this.lentera.push({ x: x - 15, y: y - 1 });
    bisaDiajak(this, petani, 'Farmer', ["These crops grow on their own — a bit like Taniin, Rahmat's farming game."]);
  }

  /**
   * Pemuda bertopi yang duduk di bangku taman.
   *
   * Kedalamannya tidak diambil dari garis pijaknya seperti penghuni lain,
   * melainkan dipatok di config. Aturan garis pijak dibuat untuk yang
   * BERDIRI di atas tanah; yang duduk di bangku harus menyelip di antara dua
   * bagian bangku itu sendiri, dan tidak ada garis pijak yang bisa
   * menghasilkan angka itu.
   */
  private taruhPemuda() {
    if (!this.textures.exists('pemuda')) return;
    const { di, frame, fps } = PEMUDA;
    if (!this.anims.exists('pemuda_duduk')) {
      this.anims.create({
        key: 'pemuda_duduk',
        frames: this.anims.generateFrameNumbers('pemuda', { start: 0, end: frame - 1 }),
        frameRate: fps,
        repeat: -1,
      });
    }
    const pemuda = this.add
      .sprite(di.x, di.y, 'pemuda', 0)
      .setOrigin(0.5, 1)
      .setDepth(kedalaman(PEMUDA.kedalaman))
      .play('pemuda_duduk');
    this.orang.push(pemuda);
    buatMelirik(this, 'pemuda', 'pemuda_toleh');
    this.menolehSaatLewat(pemuda, 'pemuda_duduk', 'pemuda_toleh', di.x, di.y);
    bisaDiajak(this, pemuda, 'Neighbor', ["Just resting here. In a hurry? Click a house's name to jump straight there."]);
  }

  /**
   * Warga yang lembarnya cuma satu kegiatan (petani mencangkul, pemuda
   * duduk): selama pemain lewat dekat, kegiatannya dijeda dan matanya
   * melirik ke arah pemain (lihat buatMelirik); sesudahnya kembali seperti
   * semula.
   */
  private menolehSaatLewat(s: Phaser.GameObjects.Sprite, anim: string, toleh: string, x: number, kaki: number) {
    if (!this.textures.exists(toleh)) return;
    const asli = s.texture.key;
    this.events.on('update', () => {
      const sisi = sisiPemain(x, kaki);
      if (sisi) {
        if (s.anims.isPlaying) s.anims.stop();
        s.setTexture(toleh, sisi < 0 ? 0 : 1);
      } else if (s.texture.key === toleh) {
        s.setTexture(asli, 0).play(anim);
      }
    });
  }

  /**
   * Kupu-kupu di taman utara dan halaman depan.
   *
   * Tamannya diperlakukan sebagai SATU jalur panjang, bukan tiga kantong
   * seperti buat anak ayam. Yang memecah taman itu ember, batu nisan, dan
   * tugu — rintangan yang harus dihindari kaki, bukan sayap. Kupu-kupu yang
   * dikurung di kantong selebar tiga tile tidak akan pernah terlihat
   * jalan-jalan ke mana-mana, padahal justru kemampuan melintasi rintangan
   * itulah yang membedakannya dari penghuni lain.
   *
   * Titik pijaknya TIDAK boleh keluar dari baris yang bisa dipijak, walau ia
   * sendiri terbang. Kedalaman tile padat adalah tepi bawah tile-nya; begitu
   * titik pijak kupu-kupu naik ke baris tanggul, ia jadi lebih dangkal
   * daripada tanggul itu dan tergambar di belakangnya — badannya terpotong
   * separuh oleh tanah. Yang boleh menyeberangi tanggul cuma badannya, lewat
   * ketinggian melayang; titik pijaknya tetap di rumput.
   *
   * Warnanya digilir, bukan diacak. Diacak berarti ada kemungkinan ketiganya
   * kebetulan sewarna, dan seluruh gunanya tiga ragam warna itu hilang.
   */
  private isiKupu() {
    if (!this.textures.exists('kupu_kupu')) return;
    const jalur = [
      { x0: TAMAN[0].x0, y0: TAMAN[0].y0, x1: TAMAN[TAMAN.length - 1].x1, y1: TAMAN[0].y1, ekor: 3 },
      { ...HALAMAN.dalam, ekor: 2 },
    ];
    let ragam = 0;
    for (const p of jalur) {
      const area = new Phaser.Geom.Rectangle(
        p.x0 * TILE + TILE / 2,
        p.y0 * TILE + 2,
        (p.x1 - p.x0 + 1) * TILE - TILE,
        // Sisa 8 px di tepi bawah: badannya menjulur 4 px di bawah titik
        // pijaknya waktu hinggap, dan itu tidak boleh sampai menyentuh baris
        // tanggul berikutnya — di sana ia yang lebih dangkal, jadi ujungnya
        // akan terpotong seperti kasus di tepi atas.
        (p.y1 - p.y0 + 1) * TILE - 8
      );
      for (let n = 0; n < p.ekor; n++) {
        this.kupu.push(
          new Kupu(
            this,
            Phaser.Math.Between(area.left, area.right),
            Phaser.Math.Between(area.top, area.bottom),
            ragam++ % KUPU.ragam,
            area
          )
        );
      }
    }
  }

  /* ---------------- POI ---------------- */

  private readPois() {
    const layer = this.map.getObjectLayer('poi');
    if (!layer?.objects.length) {
      this.pois = FALLBACK_POIS;
      return;
    }
    this.pois = layer.objects.map((o) => {
      const prop = (n: string) =>
        (o.properties as { name: string; value: string }[] | undefined)?.find((p) => p.name === n)?.value;
      const [ex, ey] = (prop('enterAt') ?? '0,0').split(',').map(Number);
      return {
        id: prop('id') ?? o.name,
        label: prop('label') ?? o.name,
        panel: prop('panel') ?? o.name,
        at: [Math.floor((o.x ?? 0) / TILE), Math.floor((o.y ?? 0) / TILE)],
        enterAt: [ex, ey],
        facing: (prop('facing') as Dir) ?? 'up',
        greeting: prop('greeting') ?? '',
      } satisfies Poi;
    });
  }

  private setupPoiClicks() {
    for (const poi of this.pois) {
      const w = this.tileToWorld(...poi.at);
      const zone = this.add
        .zone(w.x, w.y, TILE * 3, TILE * 3)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.debug);
      zone.on('pointerup', (p: Phaser.Input.Pointer) => {
        // Sentuhan yang dimulai di area joystick tidak boleh memicu
        // perpindahan, walaupun kebetulan ada POI tepat di bawahnya.
        if (this.mulaiDiJoystick.get(p.id) || !diKanvas(p)) return;
        this.travelTo(poi.id);
      });
    }
    // Penandanya sendiri digambar UIScene sebagai gelembung nama. Harus di sana,
    // bukan di sini: scene ini di-zoom 3x, jadi teks apa pun ikut membesar dan
    // pecah. UIScene tidak di-zoom, jadi hurufnya tetap tajam 1:1.
  }

  /**
   * Berdiri dekat sebuah tempat membuka panelnya sendiri.
   *
   * Dipicu sekali saat MASUK jangkauan, bukan tiap frame — kalau tidak, panel
   * yang baru ditutup akan langsung terbuka lagi selama kaki masih di situ.
   * Selama masih di dalam jangkauan yang sama tidak terjadi apa-apa lagi;
   * penandanya baru dilepas setelah menjauh.
   *
   * Jangkauannya cuma depan pintu. Orang yang mendekat dari samping atau
   * belakang rumah dulu tidak diberi tahu apa-apa — terasa seperti rumahnya
   * rusak. Sekarang ada dua bantuan: panah di depan pintu yang muncul begitu
   * rumahnya didekati, dan gelembung "pintunya di depan" kalau karakternya
   * berdiri di samping atau di belakang bangunan.
   */
  private periksaKedekatan() {
    let dekat: Poi | null = null;
    let sekitar: Poi | null = null;
    for (const poi of this.pois) {
      const pintu = this.tileToWorld(...poi.enterAt);
      const dPintu = Phaser.Math.Distance.Between(this.player.x, this.player.y, pintu.x, pintu.y);
      if (dPintu <= POI_DEKAT) dekat = poi;
      // samping/belakang bangunan: sejajar atau di atas garis pintu, dalam lebar rumah
      const rumah = this.tileToWorld(...poi.at);
      const dx = Math.abs(this.player.x - rumah.x);
      const dy = this.player.y - rumah.y;
      if (dPintu > POI_DEKAT && dx <= (poi.lebar ?? PINTU.lebarRumah) && dy >= -PINTU.tinggiRumah && dy <= PINTU.depan)
        sekitar = poi;
      this.aturPenunjuk(poi, dPintu);
    }

    // Petunjuknya menunggu giliran: tidak boleh menimpa gelembung lain yang
    // baru muncul (sapaan pembuka, sapaan tempat). Selama masih di zona yang
    // sama ia dicoba lagi; begitu sudah tampil, tidak diulang sampai menjauh.
    if (!sekitar) {
      this.poiDisekitar = null;
    } else if (sekitar.id !== this.poiDisekitar && !this.poiDidalam && this.time.now - this.petunjukTerakhir > PINTU.jeda) {
      this.emit('greet', `The door to ${sekitar.label} is at the front — walk up to it to go in.`);
      this.poiDisekitar = sekitar.id;
    }

    if (dekat?.id === this.poiDidalam) return;
    this.poiDidalam = dekat?.id ?? null;
    if (dekat) {
      this.emit('greet', dekat.greeting);
      this.emit('panel', dekat.panel);
      this.emit('alamat', dekat.id);
    }
  }

  /**
   * Penunjuk pintu: panah kuning yang memantul di atas petak masuk, plus
   * lingkaran di tanah tempat berdiri. Selalu tampil di semua pintu —
   * justru dari jauh orang perlu tahu di mana pintunya — dan cuma meredup
   * saat karakternya sudah berdiri di depan pintu itu.
   *
   * Warnanya dibuat kontras di atas latar apa pun: garis tepi gelap tebal,
   * kilau putih di sisi kiri, bayangan oranye tua di sisi kanan, dan bayangan
   * kecil di tanah. Yang polos kuning sebelumnya nyaris hilang di atas tanah
   * jalan dan pintu rumah Contact yang sama-sama oranye. Di malam hari
   * lingkarannya menyala di atas tirai gelap (lihat Penunjuk).
   */
  private pasangPenunjukPintu() {
    for (const poi of this.pois) {
      const t = this.tileToWorld(...poi.enterAt);
      this.penunjuk.set(poi.id, new Penunjuk(this, t.x, t.y));
    }
  }

  private aturPenunjuk(poi: Poi, dPintu: number) {
    // selalu tampil; cuma meredup saat sudah berdiri di depan pintunya
    this.penunjuk.get(poi.id)?.atur(dPintu <= POI_DEKAT ? 0.35 : 1);
  }

  /** Pindah ke POI dengan animasi petir. Dipanggil dari klik map, minimap, atau URL. */
  travelTo(id: string) {
    if (this.busy) return;
    const poi = this.pois.find((p) => p.id === id);
    if (!poi) return;
    this.teleport(this.tileToWorld(...poi.enterAt), poi.facing, () => {
      // sudah berdiri di depan pintunya; jangan sampai dibuka dua kali
      this.poiDidalam = poi.id;
      this.poiDisekitar = null;
      this.emit('greet', poi.greeting);
      this.emit('panel', poi.panel);
    });
  }

  /**
   * Pergi ke komputer Rahmat lalu buka terminalnya — sama seperti pergi ke
   * sebuah rumah: dari jauh, karakternya disambar petir dan mendarat di
   * depan kursi, duduk, baru monitornya menyala. Dipakai label TERMINAL,
   * klik di monitor, dan tombol OPEN / RUN IN TERMINAL di obrolan MATS-BOT.
   *
   * Sudah duduk atau sudah di dekat meja: tidak perlu petir, langsung duduk.
   * Sedang ada perjalanan lain (petir pembuka, teleport ke rumah): ditunggu
   * sampai selesai, baru berangkat — permintaan pengunjung tidak hilang dan
   * tidak memotong petir yang sedang berjalan.
   */
  keTerminal() {
    const t = this.teras;
    const p = this.player;
    if (!t || !p) {
      this.game.events.emit('mapporto:terminal');
      return;
    }
    if (this.busy) {
      if (!this.terminalMenunggu) {
        this.terminalMenunggu = true;
        const coba = () => {
          if (this.busy) return void this.time.delayedCall(120, coba);
          this.terminalMenunggu = false;
          this.keTerminal();
        };
        this.time.delayedCall(120, coba);
      }
      return;
    }
    if (p.sedangKerja || t.dekat(p)) {
      t.dudukDanBuka();
      return;
    }
    t.tahanKursi();
    this.teleport(t.depanKursi, 'up', () => {
      this.poiDidalam = null;
      this.poiDisekitar = null;
      t.dudukDanBuka(550);
    });
  }

  /** Petir menyambar di tujuan, karakternya mendarat di situ, lalu `sampai`. */
  private teleport(dest: { x: number; y: number }, hadap: Dir, sampai: () => void) {
    this.busy = true;
    this.walkTarget = null;
    this.player.freeze(true);
    this.fx.play(
      dest.x,
      dest.y,
      () => {
        this.player.setHidden(true);
        this.player.setPosition(dest.x, dest.y);
        this.cameras.main.centerOn(dest.x, dest.y);
        this.player.setHidden(false);
        this.player.face(hadap);
        this.fx.landPlayer(this.player);
      },
      () => {
        this.busy = false;
        this.player.freeze(false);
        sampai();
      }
    );
  }

  /* ---------------- input ---------------- */

  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,C') as Record<string, Phaser.Input.Keyboard.Key>;

    // C = lihat kotak collision, buat ngecek sebelum digambar manual di Tiled
    this.keys.C.on('down', () => this.toggleDebug());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!diKanvas(p)) return;
      this.mulaiDiJoystick.set(
        p.id,
        pakaiKontrolSentuh() && diZonaJoystick(p.x, p.y, this.scale.width, this.scale.height)
      );
    });

    // Klik tanah → jalan ke sana. Dimatikan di perangkat sentuh: di sana
    // joystick yang mengatur gerak, dan sentuhan melepas joystick terbaca
    // juga sebagai perintah jalan sehingga karakter melangkah sendiri.
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.busy || p.event.defaultPrevented || !diKanvas(p)) return;
      if (pakaiKontrolSentuh()) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.walkTarget = new Phaser.Math.Vector2(w.x, w.y);
    });
  }

  private toggleDebug() {
    if (this.debug) {
      this.debug.destroy();
      this.debug = undefined;
      return;
    }
    this.debug = this.add.graphics().setDepth(DEPTH.debug);
    this.debug.fillStyle(0xff0033, 0.35).lineStyle(1, 0xff0033, 0.8);
    this.blocked.children.each((c) => {
      const b = (c as Phaser.GameObjects.Rectangle);
      this.debug!.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      this.debug!.strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      return true;
    });
  }

  override update() {
    if (this.busy) return;

    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    // joystick virtual dari UIScene
    const stick = this.registry.get('stick') as { x: number; y: number } | undefined;
    if (stick && (stick.x || stick.y)) {
      vx = stick.x;
      vy = stick.y;
    }

    if (vx || vy) this.walkTarget = null;

    // tap-to-move: jalan lurus ke tujuan sampai dekat atau nabrak
    if (!vx && !vy && this.walkTarget) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.walkTarget.x, this.walkTarget.y);
      if (d < 4) {
        this.walkTarget = null;
      } else {
        vx = this.walkTarget.x - this.player.x;
        vy = this.walkTarget.y - this.player.y;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) this.walkTarget = null;
      }
    }

    this.player.move(vx, vy);
    this.periksaKedekatan();

    // kupu-kupu yang kelewat dekat kabur duluan; malam hari mereka hinggap tidur
    const malam = this.gelap() > 0.55 || cuaca.hujan > 0.3;
    for (const kupu of this.kupu) {
      kupu.tidurkan(malam);
      kupu.kaget(this.player.x, this.player.y);
    }
  }

  /* ---------------- util ---------------- */

  private tileToWorld(tx: number, ty: number) {
    return new Phaser.Math.Vector2(tx * TILE + TILE / 2, ty * TILE + TILE / 2 + PLAYER.body.height / 2);
  }

  /** Jembatan ke UIScene & DOM. */
  /**
   * Pedagang di samping kios Tech Stack dan kurir yang berkeliling dari pintu
   * ke pintu. Rute kurir dicari di atas grid tabrakan yang sama dengan yang
   * dipakai pemain, jadi ia lewat jalan dan jembatan seperti orang lain.
   */
  private pasangWarga() {
    if (!this.textures.exists('player')) return;
    siapkanTeksturWarga(this);
    new Pedagang(this, 130, 460, () => this.player);
    /*
     * Pedagang tidak membawa senter: ia berdiri di tempat dan tangannya dipakai
     * melambai — senter yang ikut terangkat bersama lambaiannya terlihat aneh.
     * Kiosnya yang diberi lentera, di ujung kiri meja dekat ia berdiri; urutan
     * gambarnya ikut dasar kios supaya lentera itu di atas meja, bukan di baliknya.
     */
    this.lentera.push({ x: 159, y: 455, dasar: 464 });
    this.taruhRemaja();

    const raw = this.cache.tilemap.get('map')?.data as { autoCollision?: number[] } | undefined;
    if (!raw?.autoCollision) return;
    const kisi = new Kisi(this.map.width, this.map.height, raw.autoCollision);
    this.kisi = kisi;
    // urutan keliling: About → Projects → CV → Contact → Tech Stack → About …
    const urut = ['rumah_about', 'rumah_projects', 'rumah_cv', 'rumah_contact', 'kios_stack'];
    const pintu = urut
      .map((id) => this.pois.find((p) => p.id === id)?.enterAt)
      .filter((p): p is [number, number] => !!p);
    const kurir = pintu.length >= 2 ? new Kurir(this, kisi, pintu) : undefined;
    if (kurir) this.orang.push(kurir.s);
    this.kurir = kurir;

    // burung kabur dari pemain dan dari kurir yang lewat
    const semuaPintu = this.pois.map((p) => p.enterAt);
    this.burung = new Burung(
      this,
      kisi,
      semuaPintu,
      () => [this.player, kurir?.s],
      this.scale.width < 700 ? 10 : 12,
      (this.kering ??= this.pembacaAir()),
      this.gelap
    );
  }

  /**
   * Apakah titik dunia ini tanah kering — bukan air.
   *
   * Grid tabrakan cuma tahu petak, dan beberapa petak yang bisa dilewati
   * sebagian gambarnya air: jembatan (sela papannya), tepi sungai barat.
   * Di sini yang dibaca piksel peta di titik itu sendiri: lapisan dari atas
   * ke bawah, piksel pertama yang tidak transparan menentukan. Air di
   * tileset ini biru terang (B jauh di atas R dan G).
   *
   * Pikselnya diambil dari atlas yang sudah dimuat, disalin ke kanvas sekali
   * saja, jadi tiap pemeriksaan cuma membaca larik.
   */
  private pembacaAir() {
    const warna = (this.warnaTanah ??= this.pembacaWarna());
    return (x: number, y: number) => {
      const w = warna(x, y);
      if (!w) return true;
      const [r, g, b] = w;
      return !(b > 150 && b > r + 70 && b > g + 10);
    };
  }

  /**
   * Apakah titik ini jalan — tanah jingga atau batu kelabu — dan bukan
   * rumput, air, atau benda. Genangan hujan hanya muncul di sini.
   */
  private jalanTanah() {
    const warna = (this.warnaTanah ??= this.pembacaWarna());
    return (x: number, y: number) => {
      const w = warna(x, y);
      if (!w) return false;
      const [r, g, b] = w;
      const tanah = r > 200 && g > 130 && g < 180 && b < 110;
      const batu = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 130 && r < 210;
      return tanah || batu;
    };
  }

  /** Warna tanah per titik dunia, dibuat sekali — lihat pembacaWarna(). */
  private warnaTanah?: (x: number, y: number) => [number, number, number] | null;

  /**
   * Warna tanah di sebuah titik dunia: lapisan dari atas ke bawah, piksel
   * pertama yang tidak transparan menentukan. Null kalau tidak ada tile.
   */
  private pembacaWarna() {
    const tiles = this.map.tilesets[0];
    const src = this.textures.get('atlas').getSourceImage() as HTMLImageElement;
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = src.width;
    ctx.canvas.height = src.height;
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, src.width, src.height).data;
    const langkah = TILE + tiles.tileSpacing;
    // lapisan setinggi tanah, dari yang digambar paling atas
    const lapisan = this.map.layers
      .filter((l) => l.name.startsWith('padat') || ['di bawah', 'lantai', 'Tile Layer 1'].includes(l.name))
      .sort((a, b) => urutLapisan(b.name) - urutLapisan(a.name));
    return (x: number, y: number): [number, number, number] | null => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      for (const l of lapisan) {
        const t = l.data[ty]?.[tx];
        if (!t || t.index < 0) continue;
        const lokal = t.index - tiles.firstgid;
        let px = Math.floor(x) - tx * TILE;
        let py = Math.floor(y) - ty * TILE;
        if (t.flipX) px = TILE - 1 - px;
        if (t.flipY) py = TILE - 1 - py;
        const ax = tiles.tileMargin + (lokal % tiles.columns) * langkah + px;
        const ay = tiles.tileMargin + Math.floor(lokal / tiles.columns) * langkah + py;
        const i = (ay * src.width + ax) * 4;
        if (data[i + 3] < 128) continue;
        return [data[i], data[i + 1], data[i + 2]];
      }
      return null;
    };
  }

  /**
   * Awan, siang-malam, dan lampu jalan. Pilihan waktunya disimpan panel
   * Setelan di localStorage; perubahan selama bermain datang lewat event.
   */
  private pasangSuasana() {
    let mode: ModeWaktu = 'otomatis';
    try {
      const m = localStorage.getItem('mapporto:waktu');
      if (m === 'siang' || m === 'senja' || m === 'malam') mode = m;
    } catch {
      /* localStorage bisa diblokir; pakai jam asli */
    }
    const suasana = new Suasana(this, this.map.widthInPixels, this.map.heightInPixels);
    this.suasana = suasana;
    suasana.setMode(mode, true);
    /*
     * Kabar "malam sudah tiba" untuk DOM. Datang malam-malam: kabarnya
     * menunggu sampai petir pembuka selesai dan sapaan pertama (tiga baris,
     * ±9 detik) sempat dibaca, supaya tidak bertumpuk dengan keduanya. Malam
     * yang tiba selagi bermain: langsung.
     */
    this.game.events.once('mapporto:ready', () => {
      this.time.delayedCall(9000, () => {
        if (suasana.malamMenurutJam) this.emit('malam', null);
        suasana.onMalamTiba = () => this.emit('malam', null);
      });
    });
    const ganti = (m: ModeWaktu) => suasana.setMode(m);
    this.game.events.on('mapporto:waktu', ganti);
    this.events.once('shutdown', () => this.game.events.off('mapporto:waktu', ganti));
  }

  /**
   * Strip rumput di utara jalan atas: warga nongkrong di bangku dengan api
   * unggun, anak main layangan, gerobak bakso, jemuran, kucing oren yang
   * mengejar kupu-kupu, dan papan pengumuman desa. Letaknya di config UTARA.
   */
  private pasangUtara(senter: Senter) {
    if (!this.textures.exists('player')) return;
    const gelap = () => this.suasana?.gelap ?? 0;
    new Jemuran(this, this.blocked);
    new Nongkrong(this, gelap, this.blocked);
    new Layangan(this, () => gelapAtauHujan(gelap()));
    new Bakso(this, gelap, () => this.player, this.blocked, senter);
    new Papan(this, this.blocked);
    let kupu: Kupu | undefined;
    if (this.textures.exists('kupu_kupu')) {
      const { x, y, lebar, tinggi } = UTARA.kupu;
      kupu = new Kupu(this, x + lebar / 2, y + tinggi / 2, 1, new Phaser.Geom.Rectangle(x, y, lebar, tinggi));
      this.kupu.push(kupu);
    }
    // malam hari kupu-kupunya tidur: tidak ada yang dikejar
    new Kucing(this, () => (kupu && !kupu.tidur ? kupu : undefined), () => this.player);
  }

  /**
   * Pekarangan rumah About: meja kerja Rahmat di sisi kanan rumah, jendela
   * yang menyala saat malam, kotak surat yang diisi kurir, sumur timba,
   * anjing penjaga di depan pintu, patung batu yang bisa diajak bicara, dan
   * sepeda ontel di pojok rumah. Letaknya di config ABOUT.
   */
  private isiPekarangan() {
    // hiasan kecil di layer lantai yang tertimpa benda baru
    for (const [tx, ty] of ABOUT.buang) this.map.removeTileAt(tx, ty, true, true, 'lantai');
    const gelap = () => this.suasana?.gelap ?? 0;
    const teras = new Teras(this, gelap, () => this.player, this.blocked);
    this.teras = teras;
    this.titikTerminal = teras.puncak;
    const keTerminal = () => this.keTerminal();
    this.game.events.on('mapporto:ke-terminal', keTerminal);
    this.events.once('shutdown', () => this.game.events.off('mapporto:ke-terminal', keTerminal));
    // MATS-BOT: robot penjawab pertanyaan tentang Rahmat yang mengikuti
    // karakter ke mana pun; muncul pertama kali di samping meja kerjanya
    this.bot = new MatsBot(this, ABOUT.bot.x, ABOUT.bot.kaki, () => this.player, gelap);
    // duduk di kursi terminal: tujuan tap-to-move yang tersisa dibatalkan,
    // kalau tidak karakternya langsung berjalan (dan berdiri) lagi
    this.events.on('teras:duduk', () => (this.walkTarget = null));
    new Jendela(this, gelap, () => this.suasana?.jam() ?? 12);

    const anjing = new Anjing(this, () => this.player);

    // kurir yang sampai di pintu About memasukkan suratnya ke kotak surat,
    // disambut gonggongan anjingnya
    const kotak = new KotakSurat(this, this.blocked);
    const pintu = this.pois.find((p) => p.id === 'rumah_about')?.enterAt;
    if (this.kurir && pintu) {
      this.kurir.onSampai = ([x, y], s) => {
        if (x !== pintu[0] || y !== pintu[1]) return false;
        kotak.terima(s);
        anjing.sambut(s);
        return true;
      };
    }

    new Sumur(this, this.blocked);
    new Patung(this, () => [this.player, this.kurir?.s], this.gelap);
    new Sepeda(this, this.blocked);

    // petak meja+kursi, kotak surat, sumur, dan sepeda: kurir memutar, burung
    // tidak hinggap di sana. Petak (8,16) di bawah ujung sepeda sengaja tidak
    // ditandai — itu jalan tanah tempat kurir lewat.
    this.kisi?.halangi([
      [14, 15],
      [15, 15],
      [13, 16],
      [14, 16],
      [15, 16],
      [14, 17],
      [15, 17],
      [10, 17],
      [10, 18],
      [10, 20],
      [11, 20],
      [10, 21],
      [11, 21],
      [10, 22],
      [11, 22],
      [9, 16],
      // kandang tenggeran ayam di pojok tenggara halaman
      [14, 21],
      [15, 21],
      [16, 21],
      [14, 22],
      [15, 22],
      [16, 22],
    ]);
  }

  /**
   * Lapangan tanah di timur rumah CV dan sekitarnya: engklek, tiang bendera,
   * piala di depan rumah CV, pos ronda, dan ayunan ban di pohon timur.
   * Letaknya di config LAPANGAN.
   */
  private isiLapangan(senter: Senter) {
    if (!this.textures.exists('player')) return;
    for (const [tx, ty] of LAPANGAN.buang) this.map.removeTileAt(tx, ty, true, true, 'lantai');
    const gelap = () => this.suasana?.gelap ?? 0;
    // anak-anak berteduh saat gerimis, sama seperti pulang saat gelap
    const pulangAnak = () => gelapAtauHujan(gelap());
    new Engklek(this, pulangAnak);
    new Bendera(this, this.blocked);
    new Prestasi(this, this.blocked);
    new Ronda(this, gelap, () => this.player, senter, this.blocked);
    new TerasCV(this, this.blocked);
    new Ayunan(this, pulangAnak);
    new Umbul(this);
    new Ngopi(this, gelap, () => this.suasana?.jam() ?? 12, () => this.player);
    new Bola(this, gelap, () => this.player, this.blocked);
    new TamuRonda(this, gelap);
    // pembeli di kios Tech Stack ikut menyalakan senter di malam hari
    senter.pegang(new PembeliKios(this, gelap).s);
    // piala, pos ronda, dan tiang bendera: kurir memutar, burung tidak hinggap di atasnya
    this.kisi?.halangi([
      [25, 21],
      [32, 14],
      [33, 19],
      [34, 19],
      [33, 20],
      [34, 20],
    ]);
  }

  /**
   * Kehidupan malam — semuanya muncul setelah gelap, tidak ada yang tampil
   * siang hari:
   *
   * - suara latar: gemericik sungai (siang juga) dan paduan jangkrik;
   * - kelelawar yang berputar di lampu jalan dan tajuk pohon, laron yang
   *   mengerumuni lampu dan jendela, burung hantu di pohon barat rumah
   *   About, tokek di dinding rumah Contact, kodok bersahutan di tepi sungai;
   * - kilau bulan dan pantulan lampu di sungai, asap dapur rumah Contact;
   * - penjual nasi goreng keliling, hansip yang berkeliling memukul
   *   kentongan, dan — tidak tiap malam — anak-anak main kembang api.
   */
  private pasangMalam(senter: Senter) {
    const gelap = this.gelap;
    new SuaraLatar(this, gelap, () => (this.player ? { x: this.player.x, y: this.player.y + PLAYER.baseY } : undefined));
    new Kelelawar(this, gelap, this.scale.width < 700 ? 4 : 6);
    // di dahan yang menjulur dari sisi kiri tajuk pohon barat rumah About
    // (tajuknya x 83-110, y 252-278), di bawah jamur merah di x 64-78 y 246-256
    new BurungHantu(this, { x: 91, y: 277 }, gelap);
    // di dinding krem rumah Contact, kiri jendela TV (dinding x 250-263, dasar rumah y 460)
    new Tokek(this, 259, 445, 460, gelap);
    new Kodok(this, gelap);

    const laron = new Laron(this);
    const lampuNyala = () => this.gelap();
    const jendelaNyala = () => Phaser.Math.Clamp((this.gelap() - 0.2) / 0.5, 0, 1);
    for (const [tx, ty] of LAMPU.tiang) {
      laron.kerumuni(tx * TILE + LAMPU.lentera.x, ty * TILE + LAMPU.lentera.y, lampuNyala, 7);
      laron.kitari(tx * TILE + LAMPU.lentera.x, ty * TILE + LAMPU.lentera.y, lampuNyala, 2);
    }
    // jendela About, lampu gerobak bakso, lentera pos ronda
    laron.kerumuni(169, 253, jendelaNyala, 4);
    laron.kerumuni(205, 253, jendelaNyala, 4);
    laron.kerumuni(UTARA.gerobak.x, UTARA.gerobak.kaki - 33, lampuNyala, 5);
    laron.kerumuni(LAPANGAN.ronda.x - 12, LAPANGAN.ronda.kaki - 22, lampuNyala, 4);

    this.kering ??= this.pembacaAir();
    const kering = this.kering;
    // kilau hanya di air terbuka: bukan di celah papan jembatan, bukan di batu
    new KilauSungai(
      this,
      (x, y) => !kering(x, y) && !this.adaBenda(Math.floor(x / TILE), Math.floor(y / TILE)),
      gelap,
      this.map.widthInPixels
    );
    // asap tungku dapur dari sisi kanan atap jerami rumah Contact, dekat lampu jalan (23,26)
    const [lx, ly] = LAMPU.tiang.find(([x, y]) => x === 23 && y === 26) ?? [23, 26];
    new Asap(this, 322, 426, gelap, [{ x: lx * TILE + LAMPU.lentera.x, y: ly * TILE + LAMPU.lentera.y }]);
    // dapur rumah lain ikut berasap: cerobong di atap About, CV, dan Projects (px dunia, dari
    // map_full.png). Titiknya kaki cerobong, ±9 px di bawah tepi atas atapnya: di tepi atapnya
    // sendiri (posisi lama) cerobongnya berdiri di luar atap, di atas jalan di belakang rumah.
    for (const [x, y] of [
      [198, 220],
      [440, 289],
      [484, 53],
    ])
      new Asap(this, x, y, gelap, []);

    this.nasgor = new NasiGoreng(this, gelap);
    this.kembangApi = new KembangApi(this, gelap);

    // hansip: dari pos ronda ke pintu-pintu rumah, lalu kembali
    if (this.kisi) {
      const kisi = this.kisi;
      const dekatPos = this.petakBebas(kisi, Math.floor(LAPANGAN.ronda.x / TILE) - 1, Math.floor(LAPANGAN.ronda.kaki / TILE) + 1);
      const pintu = ['rumah_cv', 'rumah_contact', 'kios_stack', 'rumah_about', 'rumah_projects']
        .map((id) => this.pois.find((p) => p.id === id)?.enterAt)
        .filter((p): p is [number, number] => !!p);
      if (dekatPos && pintu.length) this.hansip = new Hansip(this, kisi, [dekatPos, ...pintu], gelap, senter);
    }
  }

  /**
   * Detail yang menghidupkan seluruh desa: hiasan di tepi jalan dan perabot
   * di depan rumah, semak yang bergoyang dilewati, daun yang gugur, dan
   * nenek yang menyapu halaman pagi dan sore.
   */
  private pasangHiasan() {
    const lapisBenda = this.map.layers.filter((l) => l.name !== 'Tile Layer 1');
    const kosong = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (this.kisi && !this.kisi.bebas(tx, ty)) return false;
      return !lapisBenda.some((l) => (l.data[ty]?.[tx]?.index ?? -1) > 0);
    };
    const pintu = this.pois.map((p) => this.tileToWorld(...p.enterAt));
    new Hiasan(this, this.map.widthInPixels, this.map.heightInPixels, (this.warnaTanah ??= this.pembacaWarna()), kosong, pintu, this.blocked);
    new Goyang(this, this.map, () => this.player);
    new Daun(this);
    // yang besar ikut bergerak: tajuk pohon diterpa angin, air sungai mengalir
    new Tajuk(this, this.map, this.padatGambar);
    this.kering ??= this.pembacaAir();
    const kering = this.kering;
    new Arus(this, (x, y) => !kering(x, y));
    // bekas langkah: debu di jalan, helai rumput di rumput
    const warna = (this.warnaTanah ??= this.pembacaWarna());
    const rumput = (x: number, y: number) => {
      const w = warna(x, y);
      return !!w && w[1] > w[0] + 20 && w[1] > w[2] + 20;
    };
    new Debu(this, () => this.player, this.jalanTanah(), rumput);
    new Nyapu(this, () => this.suasana?.jam() ?? 12, this.gelap);
  }

  /**
   * Gerimis sesekali: genangan di jalan tanah, dan payung untuk warga yang
   * berjalan (bukan pemuda yang duduk di bangku taman). Pilihannya ada di
   * panel Setelan (Weather): sesekali, cerah, atau gerimis terus.
   */
  private pasangHujan() {
    this.hujan = new Hujan(this, this.suasana, this.jalanTanah(), () => this.player);
    // pilihan cuaca dari Setelan: disimpan di localStorage, perubahannya lewat event
    try {
      const m = localStorage.getItem('mapporto:cuaca');
      if (m === 'cerah' || m === 'gerimis') this.hujan.setMode(m);
    } catch {
      /* localStorage bisa diblokir; pakai jadwal biasa */
    }
    const ganti = (m: ModeCuaca) => this.hujan?.setMode(m);
    this.game.events.on('mapporto:cuaca', ganti);
    this.events.once('shutdown', () => this.game.events.off('mapporto:cuaca', ganti));
    this.hujan.payungi([...this.orang.filter((o) => o.texture.key !== 'pemuda'), ...(this.hansip ? [this.hansip.s] : [])]);
  }

  /**
   * Apakah petak ini berisi benda peta di atas tanah/air — jembatan (layer
   * `lantai` di sungai mendatar, `padat` di sungai tegak), batu, papan.
   */
  private adaBenda = (tx: number, ty: number) =>
    this.map.layers.some((l) => (l.name === 'lantai' || l.name.startsWith('padat')) && (l.data[ty]?.[tx]?.index ?? -1) > 0);

  /** Petak bebas terdekat dari (tx, ty) di grid tabrakan, menyebar keluar. */
  private petakBebas(kisi: Kisi, tx: number, ty: number): [number, number] | null {
    for (let r = 0; r < 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (kisi.bebas(tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
      }
    }
    return null;
  }

  /**
   * Remaja berambut merah dengan tas punggung hijau, berkeliaran di pelataran
   * timur rumah CV. Sesekali berhenti dan main HP.
   */
  private taruhRemaja() {
    if (!this.textures.exists('remaja')) return;
    const r = this.taruh('remaja', 'remaja', this.jelajah(REMAJA, 'remaja'));
    if (!r) return;
    this.orang.push(r);
    // menoleh ke pemain; menjelang magrib pulang ke rumah CV lewat keset di depan pintunya
    r.aturToleh(() => this.player);
    r.aturPulang(this.gelap, { x: 428, y: 330 });
    bisaDiajak(this, r, 'Teen', [
      "Rahmat's CV house is right there. Want to see where he studied and worked?",
      'I am saving up for a hackathon too. Rahmat has joined a few of them!',
    ]);
  }

  private emit(event: string, payload: unknown) {
    if (event === 'greet') this.petunjukTerakhir = this.time.now;
    this.game.events.emit(`mapporto:${event}`, payload);
  }

  get poiList() {
    return this.pois;
  }

  /**
   * Titik gantung gelembung nama: tepat di atas puncak bangunan.
   *
   * Ditelusuri dari peta, bukan angka tetap per tempat. Tinggi bangunannya
   * tidak seragam — rumah naik dua tile di atas pintunya, gerai cuma satu —
   * jadi satu angka tetap pasti salah untuk sebagian. Menuliskan angkanya satu
   * per satu juga akan basi begitu petanya diubah di Tiled.
   *
   * Ditelusuri ke atas selama masih ada tile bangunan di kolom itu. Lapisan
   * tanah sengaja tidak ikut dibaca: rumput dan jalan ada di mana-mana, dan
   * penelusurannya tidak akan pernah berhenti.
   */
  gantunganPoi(poi: Poi) {
    const tersimpan = this.gantungan.get(poi.id);
    if (tersimpan) return tersimpan;

    const lapisan = ['di atas map 1', 'aset kedua', 'padat', 'padat 2']
      .map((n) => this.map.getLayer(n))
      .filter(Boolean) as Phaser.Tilemaps.LayerData[];
    const tx = poi.at[0];
    let ty = poi.at[1];
    const isi = (y: number) => lapisan.map((l) => l.data[y]?.[tx]).filter((t) => t && t.index > 0);
    while (ty > 0 && isi(ty - 1).length) ty--;

    /*
     * Baris tile saja belum cukup. Tile teratas gerai isinya cuma sepertiga
     * bagian bawah — dua pertiga atasnya kosong — jadi gelembung yang
     * digantung di tepi atas tile itu melayang jauh di atas tendanya. Yang
     * dicari tepi gambar sebenarnya, bukan tepi petaknya.
     */
    const daftarAtas = (this.cache.tilemap.get('map')?.data as { atlasAtas?: number[] } | undefined)
      ?.atlasAtas;
    const firstgid = this.map.tilesets[0].firstgid;
    let atas = TILE;
    for (const t of isi(ty)) atas = Math.min(atas, daftarAtas?.[t.index - firstgid] ?? 0);

    const hasil = { x: tx * TILE + TILE / 2, y: ty * TILE + (atas === TILE ? 0 : atas) - 4 };
    this.gantungan.set(poi.id, hasil);
    return hasil;
  }

  get hero() {
    return this.player;
  }

  /** Titik layar tempat karakter berdiri — pusat tirai "masuk pintu" di halaman. */
  titikLayarPemain() {
    const cam = this.cameras.main;
    const p = this.player;
    if (!p) return { x: cam.width / 2, y: cam.height / 2 };
    return { x: (p.x - cam.worldView.x) * cam.zoom, y: (p.y - 4 - cam.worldView.y) * cam.zoom };
  }

  get tilemap() {
    return this.map;
  }

  /** Ukuran dunia dalam piksel — dipakai UI untuk memetakan koordinat. */
  get mapPixelSize() {
    return { w: this.map.widthInPixels, h: this.map.heightInPixels };
  }
}

/** Urutan gambar lapisan setinggi tanah: padat di atas, lalu di bawah, lantai, dasar. */
function urutLapisan(nama: string) {
  if (nama.startsWith('padat')) return 3;
  return { 'di bawah': 2, lantai: 1 }[nama] ?? 0;
}
