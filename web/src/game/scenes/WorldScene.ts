import Phaser from 'phaser';
import { TILE, ZOOM, DEPTH, PLAYER, COW, KANDANG, pakaiKontrolSentuh, diZonaJoystick, type Dir } from '../config';
import { Cow } from '../objects/Cow';
import { Player } from '../objects/Player';
import { ThunderFx } from '../objects/ThunderFx';
import { FALLBACK_POIS, FALLBACK_SPAWN, GREETING_START, type Poi } from '../poi';

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
      const layer = this.map.createLayer(l.name, tiles, 0, 0)!;
      layer.setDepth(order[l.name] ?? DEPTH.below);
    }

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBackgroundColor('#4a7c3f');

    this.buildCollision();
    this.readPois();
    this.isiKandang();

    // ---- karakter ----
    const spawn = this.tileToWorld(...FALLBACK_SPAWN);
    Player.registerAnimations(this, 'player');
    ThunderFx.registerAnimations(this);
    this.player = new Player(this, spawn.x, spawn.y, 'player');
    this.physics.add.collider(this.player, this.blocked);
    this.fx = new ThunderFx(this);

    const zoom = this.scale.width < 700 ? ZOOM.mobile : ZOOM.desktop;
    this.cameras.main.setZoom(zoom);
    /*
     * Ikuti tanpa pelunakan (lerp 1).
     *
     * Dengan lerp 0.12 kamera selalu tertinggal sepersekian piksel dari
     * karakter. Karena kamera DAN sprite sama-sama dibulatkan ke piksel bulat,
     * selisih itu membulat naik-turun tiap frame — terlihat sebagai getaran,
     * paling kentara saat gerak serong yang komponennya bukan bilangan bulat.
     * Mengunci kamera ke posisi karakter membuat keduanya membulat bersamaan.
     */
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.roundPixels = true;

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

  /* ---------------- kandang ---------------- */

  /**
   * Isi kandang dengan dua sapi, satu jantan satu betina.
   *
   * Tiap sapi dapat jalur horizontalnya sendiri di dalam kandang. Itu memberi
   * dua hal sekaligus: mereka tidak pernah saling menembus, dan yang jalurnya
   * lebih bawah selalu dibuat belakangan — sehingga digambar di atas yang di
   * belakangnya, persis seperti yang diharapkan mata, tanpa perlu mengurutkan
   * depth tiap frame.
   */
  private isiKandang() {
    const d = KANDANG.dalam;
    const kiri = d.x0 * TILE + COW.pinggir.x;
    const kanan = (d.x1 + 1) * TILE - COW.pinggir.x;
    const atas = d.y0 * TILE + COW.pinggir.atas;
    const bawah = (d.y1 + 1) * TILE - COW.pinggir.bawah;

    const jenis = ['cow_m', 'cow_f'];
    const jalur = (bawah - atas) / jenis.length;
    jenis.forEach((key, i) => {
      if (!this.textures.exists(key)) return;
      Cow.registerAnimations(this, key);
      // tinggi jalur dipangkas jadi 60% supaya ada sela di antara dua jalur;
      // tanpa itu badan sapi atas dan bawah bisa bersinggungan di tepinya
      const y0 = Math.round(atas + i * jalur);
      const area = new Phaser.Geom.Rectangle(kiri, y0, kanan - kiri, Math.round(jalur * 0.6));
      // konstruktornya sendiri yang mendaftar ke scene
      new Cow(this, Phaser.Math.Between(kiri, kanan), Phaser.Math.Between(area.top, area.bottom), key, area);
    });
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

      // penanda kecil supaya titiknya kelihatan bisa diklik
      const marker = this.add
        .rectangle(w.x, w.y - TILE, 6, 6, 0xf2c438)
        .setStrokeStyle(1, 0x1b2416)
        .setDepth(DEPTH.above + 2);
      this.tweens.add({
        targets: marker,
        y: marker.y - 3,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
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
