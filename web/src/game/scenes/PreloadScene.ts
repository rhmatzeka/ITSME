import Phaser from 'phaser';
import { aset } from '../aset';
import { GURITA, KUPU, PENGHUNI, PETANI, PLAYER, THUNDER } from '../config';
import { siapkan } from '../suara';

/**
 * Loading bar-nya jujur: lebarnya digerakkan oleh event `progress` milik
 * loader Phaser, bukan animasi palsu berdurasi tetap.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width: w, height: h } = this.scale;
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);

    // karakter idle di atas bar — persis referensi
    const hero = this.add.sprite(cx, cy - 70, 'player', 0).setScale(3);
    this.anims.create({
      key: 'preload_idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    hero.play('preload_idle');

    const BAR_W = Math.min(420, Math.round(w * 0.6));
    const BAR_H = 26;
    const x = cx - BAR_W / 2;
    const y = cy + 40;

    const frame = this.add.graphics();
    frame.lineStyle(3, 0x1b2416, 1).strokeRect(x - 3, y - 3, BAR_W + 6, BAR_H + 6);

    const fill = this.add.graphics();
    const label = this.add
      .text(cx, y + BAR_H + 36, '0%', { fontFamily: 'Silkscreen, monospace', fontSize: '34px', color: '#1b2416' })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      fill.clear().fillStyle(0x1b2416, 1).fillRect(x, y, Math.round(BAR_W * p), BAR_H);
      label.setText(`${Math.round(p * 100)}%`);
    });

    // ---- asset berat ----
    this.load.image('atlas', aset('atlas.png'));
    this.load.tilemapTiledJSON('map', aset('map.json'));

    this.load.spritesheet('player_shadow', aset('sprites/blonde_man_shadow.png'), {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('woman', aset('sprites/blue_haired_woman.png'), {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('woman_shadow', aset('sprites/blue_haired_woman_shadow.png'), {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });
    this.load.spritesheet('thunderstrike', aset('sprites/thunderstrike.png'), {
      frameWidth: THUNDER.strike.frameWidth,
      frameHeight: THUNDER.strike.frameHeight,
    });
    this.load.spritesheet('thunder_splash', aset('sprites/thunder_splash.png'), {
      frameWidth: THUNDER.splash.frameWidth,
      frameHeight: THUNDER.splash.frameHeight,
    });

    // peta hasil render pipeline: minimap tajam + peta besar
    this.load.image('minimap_frame', aset('sprites/minimap_frame.png'));
    this.load.image('map_mini', aset('map_mini.png'));
    this.load.image('map_mini_sm', aset('map_mini_sm.png'));
    this.load.image('map_full', aset('map_full.png'));

    // penghuni dunia: sapi di kandang, ayam di halaman
    const muatPenghuni = (nama: string, jenis: keyof typeof PENGHUNI) =>
      this.load.spritesheet(nama, aset(`sprites/${nama}.png`), {
        frameWidth: PENGHUNI[jenis].frameWidth,
        frameHeight: PENGHUNI[jenis].frameHeight,
      });
    for (const c of ['sapi_jantan', 'sapi_betina']) muatPenghuni(c, 'sapi');
    for (const a of ['ayam_merah', 'ayam_hijau']) muatPenghuni(a, 'ayam');
    muatPenghuni('anak_ayam', 'anak_ayam');

    // gurita sungai: 8 frame ayunan tentakel, ditumpuk ke bawah
    this.load.spritesheet('gurita', aset('sprites/gurita.png'), {
      frameWidth: GURITA.frameWidth,
      frameHeight: GURITA.frameHeight,
    });

    // warga yang mencangkul di ladang: 4 frame satu ayunan
    this.load.spritesheet('petani', aset('sprites/petani.png'), {
      frameWidth: PETANI.frameWidth,
      frameHeight: PETANI.frameHeight,
    });

    // kupu-kupu penghias taman: 4 kolom kepakan × 3 baris warna
    this.load.spritesheet('kupu_kupu', aset('sprites/kupu_kupu.png'), {
      frameWidth: KUPU.frameWidth,
      frameHeight: KUPU.frameHeight,
    });

    // joystick virtual
    this.load.image('joy_base', aset('sprites/joy_base.png'));
    this.load.image('joy_knob', aset('sprites/joy_knob.png'));

    // konten portfolio ikut dihitung di bar yang sama
    this.load.json('content', '/content.json');

    /*
     * Efek suaranya diambil di luar loader Phaser, jadi tidak menahan bar ini.
     * Memang tidak perlu ditahan: dua berkas 18 KB akan tiba jauh sebelum
     * petir pertama menyambar, dan kalau pun terlambat yang hilang cuma
     * bunyinya — gambarnya jalan terus.
     */
    siapkan();
  }

  create() {
    this.scene.start('Title');
  }
}
