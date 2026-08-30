import Phaser from 'phaser';
import { TILE, ZOOM, DEPTH, PLAYER, PENGHUNI, KANDANG, HALAMAN, TAMAN, kedalaman, skalaGambar, pakaiKontrolSentuh, diZonaJoystick, type Dir } from '../config';
import { Penghuni } from '../objects/Penghuni';
import { Player } from '../objects/Player';
import { ThunderFx } from '../objects/ThunderFx';
import { FALLBACK_POIS, FALLBACK_SPAWN, GREETING_START, POI_DEKAT, type Poi } from '../poi';

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
  /** Titik gantung gelembung per POI — dihitung sekali, dipakai berkali-kali. */
  private gantungan = new Map<string, { x: number; y: number }>();

  constructor() {
    super('World');
  }

  create() {
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
    this.isiKandang();
    this.isiHalaman();
    this.isiTaman();

    // ---- karakter ----
    const spawn = this.tileToWorld(...FALLBACK_SPAWN);
    Player.registerAnimations(this, 'player');
    ThunderFx.registerAnimations(this);
    this.player = new Player(this, spawn.x, spawn.y, 'player');
    this.physics.add.collider(this.player, this.blocked);
    this.fx = new ThunderFx(this);

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

    // spawn pembuka: karakter dihantam petir ke titik awal
    this.player.setHidden(true);
    this.busy = true;
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
          this.add
            .image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, 'atlas', nama)
            .setFlip(t.flipX, t.flipY)
            .setDepth(kedalaman((t.y + 1) * TILE));
          jumlah++;
        }
      }
    }
    if (!jumlah) console.warn('[mapporto] tidak ada layer "padat" — jalankan npm run build:map');
  }

  /* ---------------- collision ---------------- */

  private buildCollision() {
    this.blocked = this.physics.add.staticGroup();
    const raw = this.cache.tilemap.get('map')?.data as { autoCollision?: number[] } | undefined;

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

    // gabungkan tile terhalang yang bersebelahan horizontal jadi satu rectangle:
    // 232 tile → jauh lebih sedikit body, lebih ringan buat physics
    const { width: W, height: H } = this.map;
    const g = raw.autoCollision;
    for (let y = 0; y < H; y++) {
      let run = 0;
      for (let x = 0; x <= W; x++) {
        if (x < W && g[y * W + x]) {
          run++;
          continue;
        }
        if (run) {
          const w = run * TILE;
          const r = this.add.rectangle((x - run) * TILE + w / 2, y * TILE + TILE / 2, w, TILE);
          this.physics.add.existing(r, true);
          this.blocked.add(r);
          run = 0;
        }
      }
    }
  }

  /* ---------------- penghuni ---------------- */

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
    new Penghuni(
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
  private isiKandang() {
    const jenis = ['sapi_jantan', 'sapi_betina'];
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
      this.taruh(key, 'sapi', area);
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
    this.taruh('woman', 'warga', wargaArea);

    const ayamArea = this.jelajah(HALAMAN.dalam, 'ayam');
    for (const key of ['ayam_merah', 'ayam_hijau', 'ayam_merah']) this.taruh(key, 'ayam', ayamArea);
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
      for (let n = 0; n < jumlah; n++) this.taruh('anak_ayam', 'anak_ayam', area);
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
        if (this.mulaiDiJoystick.get(p.id)) return;
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
   */
  private periksaKedekatan() {
    let dekat: Poi | null = null;
    for (const poi of this.pois) {
      const t = this.tileToWorld(...poi.enterAt);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) <= POI_DEKAT) {
        dekat = poi;
        break;
      }
    }
    if (dekat?.id === this.poiDidalam) return;
    this.poiDidalam = dekat?.id ?? null;
    if (dekat) {
      this.emit('greet', dekat.greeting);
      this.emit('panel', dekat.panel);
      this.emit('alamat', dekat.id);
    }
  }

  /** Pindah ke POI dengan animasi petir. Dipanggil dari klik map, minimap, atau URL. */
  travelTo(id: string) {
    if (this.busy) return;
    const poi = this.pois.find((p) => p.id === id);
    if (!poi) return;

    this.busy = true;
    this.walkTarget = null;
    this.player.freeze(true);

    const dest = this.tileToWorld(...poi.enterAt);
    this.fx.play(
      dest.x,
      dest.y,
      () => {
        this.player.setHidden(true);
        this.player.setPosition(dest.x, dest.y);
        this.cameras.main.centerOn(dest.x, dest.y);
        this.player.setHidden(false);
        this.player.face(poi.facing);
        this.fx.landPlayer(this.player);
      },
      () => {
        this.busy = false;
        this.player.freeze(false);
        // sudah berdiri di depan pintunya; jangan sampai dibuka dua kali
        this.poiDidalam = poi.id;
        this.emit('greet', poi.greeting);
        this.emit('panel', poi.panel);
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
      this.mulaiDiJoystick.set(
        p.id,
        pakaiKontrolSentuh() && diZonaJoystick(p.x, p.y, this.scale.width, this.scale.height)
      );
    });

    // Klik tanah → jalan ke sana. Dimatikan di perangkat sentuh: di sana
    // joystick yang mengatur gerak, dan sentuhan melepas joystick terbaca
    // juga sebagai perintah jalan sehingga karakter melangkah sendiri.
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.busy || p.event.defaultPrevented) return;
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
  }

  /* ---------------- util ---------------- */

  private tileToWorld(tx: number, ty: number) {
    return new Phaser.Math.Vector2(tx * TILE + TILE / 2, ty * TILE + TILE / 2 + PLAYER.body.height / 2);
  }

  /** Jembatan ke UIScene & DOM. */
  private emit(event: string, payload: unknown) {
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

  get tilemap() {
    return this.map;
  }

  /** Ukuran dunia dalam piksel — dipakai UI untuk memetakan koordinat. */
  get mapPixelSize() {
    return { w: this.map.widthInPixels, h: this.map.heightInPixels };
  }
}
