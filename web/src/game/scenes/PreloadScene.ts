import Phaser from 'phaser';
import { siapkanRahmat } from '../objects/Rupa';
import { aset } from '../aset';
import { GURITA, KUPU, PEMUDA, PENGHUNI, PETANI, PLAYER, THUNDER } from '../config';
import { DAFTAR_SAMPEL, siapkan, titipSampel } from '../suara';

/**
 * Loading bar-nya jujur: lebarnya digerakkan oleh event `progress` milik
 * loader Phaser, bukan animasi palsu berdurasi tetap.
 *
 * Bar-nya baru sampai 100% setelah SEMUA yang dipakai di desa sudah tiba:
 * gambar, peta, isi portfolio, rekaman suara (suara warga, tawa, bel,
 * gonggongan), dan kode terminal di komputer Rahmat beserta editornya.
 * Dulu terminal dan rekamannya baru diunduh saat dipakai — di jaringan
 * lambat monitornya hitam dan warganya diam belasan detik.
 *
 * Satu pengecualian: Python (Pyodide, ±10 MB — lebih besar dari seluruh
 * desa) tidak ditunggu di sini; ia mulai diunduh begitu monitornya
 * dinyalakan (lihat src/terminal/jalankan.ts).
 */
export class PreloadScene extends Phaser.Scene {
  /** Kode terminal & editor: bukan berkas loader Phaser, jadi dihitung sendiri. */
  private tambahan: Promise<unknown> = Promise.resolve();

  constructor() {
    super('Preload');
  }

  preload() {
    const { width: w, height: h } = this.scale;
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);

    // karakter idle di atas bar — persis referensi, sudah dengan rupa Rahmat
    siapkanRahmat(this);
    const tokoh = this.textures.exists('rahmat') ? 'rahmat' : 'player';
    const hero = this.add.sprite(cx, cy - 70, tokoh, 0).setScale(3);
    this.anims.create({
      key: 'preload_idle',
      frames: this.anims.generateFrameNumbers(tokoh, { start: 0, end: 3 }),
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

    // 90% bar = berkas loader Phaser, 10% sisanya = kode terminal dan editor
    let berkas = 0;
    let modul = 0;
    const MODUL = 2;
    const gambar = () => {
      const p = berkas * 0.9 + (modul / MODUL) * 0.1;
      fill.clear().fillStyle(0x1b2416, 1).fillRect(x, y, Math.round(BAR_W * p), BAR_H);
      label.setText(`${Math.floor(p * 100)}%`);
    };
    this.load.on('progress', (p: number) => {
      berkas = p;
      gambar();
    });
    const muatModul = (janji: Promise<unknown>) =>
      janji
        .catch(() => {
          /* gagal diunduh: terminalnya akan mencoba lagi saat dibuka */
        })
        .finally(() => {
          modul++;
          gambar();
        });
    this.tambahan = Promise.all([muatModul(import('../../terminal')), muatModul(import('../../terminal/editor'))]);

    // rekaman suara warga, tawa, bel sepeda, gonggongan — lihat suara.ts
    for (const nama of DAFTAR_SAMPEL) this.load.binary(`sampel_${nama}`, aset(`audio/${nama}.mp3`));

    // ---- asset berat ----
    this.load.image('atlas', aset('atlas.png'));
    this.load.tilemapTiledJSON('map', aset('map.json'));

    this.load.spritesheet('woman', aset('sprites/blue_haired_woman.png'), {
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
    this.load.image('kepala', aset('sprites/kepala.png'));
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

    // pemuda bertopi yang duduk di bangku: 4 frame ayunan kaki
    this.load.spritesheet('pemuda', aset('sprites/pemuda.png'), {
      frameWidth: PEMUDA.frameWidth,
      frameHeight: PEMUDA.frameHeight,
    });

    // kupu-kupu penghias taman: 4 kolom kepakan × 3 baris warna
    this.load.spritesheet('kupu_kupu', aset('sprites/kupu_kupu.png'), {
      frameWidth: KUPU.frameWidth,
      frameHeight: KUPU.frameHeight,
    });

    // tanaman sawah: 6 kolom × 2 baris frame 16×16 (jagung, bit)
    this.load.spritesheet('tanaman', aset('sprites/tanaman.png'), { frameWidth: 16, frameHeight: 16 });

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
    for (const nama of DAFTAR_SAMPEL) titipSampel(nama, this.cache.binary.get(`sampel_${nama}`));
    // layar judul menunggu kode terminalnya juga, bukan cuma berkas loader
    void this.tambahan.then(() => this.scene.start('Title'));
  }
}
