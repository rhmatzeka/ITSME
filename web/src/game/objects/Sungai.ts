import Phaser from 'phaser';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';
import { Ikan } from './Ikan';

/**
 * Air sungai, px dunia. Diukur dari map_full.png: pita biru sungai mendatar
 * ada di y 377-404, sungai tegak di x 15-32. `ruas` adalah bentangan air di
 * antara jembatan (jembatan di tile 7-8 dan 23-24) — bebek tidak boleh
 * menembus papan jembatan, dan pojok barat milik gurita.
 */
const SUNGAI = {
  lajur: { atas: 386, bawah: 398 },
  ruas: [
    { x0: 152, x1: 356 },
    { x0: 414, x1: 606 },
  ],
  /** Sampai tepat sebelum tikungan gurita, yang badannya menutupi air di bawahnya. */
  tegak: { x0: 18, x1: 30, y0: 36, y1: 340 },
  /** Batu di tengah sungai (rentang x, px dunia) — bebek tidak menyeberanginya. */
  batu: [
    [236, 258],
    [524, 546],
  ],
} as const;

/** Rentang air bebas di sekitar x: ruasnya dipotong batu terdekat di kiri-kanan. */
function bentangan(ruas: { x0: number; x1: number }, x: number) {
  let kiri = ruas.x0;
  let kanan = ruas.x1;
  for (const [b0, b1] of SUNGAI.batu) {
    if (b1 < x) kiri = Math.max(kiri, b1 + 8);
    else if (b0 > x) kanan = Math.min(kanan, b0 - 8);
  }
  return { kiri, kanan };
}

const TINTA = '#1b2416';

/**
 * Kehidupan sungai: sepasang bebek yang berenang pelan beriringan, dan ikan
 * (lihat Ikan.ts) yang berenang di bawah permukaan dan sesekali melompat.
 *
 * Sungainya panjang tapi dulu cuma dihuni gurita di pojok barat — sisanya
 * pita biru yang diam. Keduanya sengaja jarang dan pelan: yang dicari adalah
 * "eh, ada ikan loncat", bukan akuarium.
 */
export class Sungai {
  private ikan: Ikan;

  constructor(private scene: Phaser.Scene) {
    this.buatTekstur();
    this.pasangBebek();
    this.ikan = new Ikan(scene, SUNGAI);
  }

  private buatTekstur() {
    // bebek menghadap kiri; frame kedua ekornya naik — kepak kecil di air
    const bebek = [
      '....kkk.....',
      '...kwwwk....',
      '..kewwwk....',
      '.kookwwk....',
      '..kkkwwwkk..',
      '....kwwwwwk.',
      '...kwgggwwwk',
      '...kwwwwwwsk',
      '....kssssssk',
      '.....kkkkkk.',
    ];
    const bebek2 = [...bebek];
    bebek2[4] = '..kkkwwwkkk.';
    bebek2[5] = '....kwwwwwwk';
    spritesheetTeks(this.scene, 'bebek', [bebek, bebek2], {
      k: TINTA,
      w: '#f6f3ea',
      g: '#dcd4c2',
      s: '#bdb5a3',
      o: '#f08a24',
      e: TINTA,
    });
  }

  /* ---------------- bebek ---------------- */

  private pasangBebek() {
    const ruas = SUNGAI.ruas[0];
    const z = this.scene.cameras.main.zoom;
    const buat = (x: number) =>
      this.scene.add.sprite(x, SUNGAI.lajur.bawah, 'bebek', 0).setOrigin(0.5, 1);
    // mulai di sisi timur batu, bentangan terpanjang ruas ini
    const induk = buat(300);
    const anak = buat(284).setScale(Math.max(1, Math.round(z * 0.8)) / z);
    const posisi: { x: number; y: number } = { x: induk.x, y: SUNGAI.lajur.bawah };
    let tujuan = { x: posisi.x, y: posisi.y };
    let diam = 0;
    const jejak: { x: number; y: number }[] = [];
    let kepak = 0;

    const pilih = () => {
      const { kiri, kanan } = bentangan(ruas, posisi.x);
      tujuan = {
        x: Phaser.Math.Between(kiri, kanan),
        y: Phaser.Math.Between(SUNGAI.lajur.atas + 6, SUNGAI.lajur.bawah),
      };
    };
    pilih();

    this.scene.events.on('update', (_t: number, delta: number) => {
      const dt = Math.min(delta, 100) / 1000;
      if (diam > 0) {
        diam -= delta;
      } else {
        const dx = tujuan.x - posisi.x;
        const dy = tujuan.y - posisi.y;
        const jarak = Math.hypot(dx, dy);
        if (jarak < 2) {
          diam = Phaser.Math.Between(1500, 4500);
          pilih();
        } else {
          const laju = 7 * dt;
          posisi.x += (dx / jarak) * laju;
          posisi.y += (dy / jarak) * laju;
        }
      }
      // anak mengikuti jejak induk, bukan mengejar lurus — jadi beriringan
      jejak.push({ x: posisi.x, y: posisi.y });
      if (jejak.length > 90) jejak.shift();
      const ekor = jejak[0];
      const kunci = (v: number) => Math.round(v * z) / z;
      induk.setPosition(kunci(posisi.x), kunci(posisi.y));
      anak.setPosition(kunci(ekor.x), kunci(ekor.y));
      for (const [b, ke] of [
        [induk, tujuan.x],
        [anak, posisi.x],
      ] as const) {
        if (Math.abs(ke - b.x) > 1) b.setFlipX(ke > b.x);
        b.setDepth(kedalaman(b.y));
      }
      kepak += delta;
      if (kepak > 520) {
        kepak = 0;
        for (const b of [induk, anak]) b.setFrame(b.frame.name === '0' ? 1 : 0);
        if (diam <= 0) {
          // di ekor masing-masing bebek, bukan di tengah badannya
          this.riak(induk.x + (induk.flipX ? -5 : 5), induk.y - 2, induk.flipX);
          this.riak(anak.x + (anak.flipX ? -4 : 4), anak.y - 1, anak.flipX, true);
        }
      }
    });
  }

  /**
   * Jejak air berbentuk V di belakang bebek: dua garis yang melebar ke
   * belakang dari ekornya, diam di tempatnya di air sementara bebeknya
   * menjauh, lalu memudar.
   *
   * Versi pertamanya dua garis putih yang digambar di koordinat dunia lalu
   * diperbesar — dan karena titik pusat perbesarannya (0,0) dunia, bukan
   * titik riaknya, garis-garis itu terseret jauh ke kanan sambil memudar:
   * terbaca sebagai titik-titik aneh yang berlari di sungai.
   */
  private riak(x: number, y: number, keKanan: boolean, kecil = false) {
    if (!this.scene.textures.exists('jejak_air')) {
      spritesheetTeks(
        this.scene,
        'jejak_air',
        [['....www', '..ww...', 'ww.....', '..ww...', '....www']],
        { w: '#dff4fc' }
      );
    }
    const j = this.scene.add
      .image(x, y, 'jejak_air')
      // bebek ke kanan → jejak membuka ke kiri
      .setOrigin(0, 0.5)
      .setFlipX(keKanan)
      .setAlpha(kecil ? 0.6 : 0.85)
      .setDepth(kedalaman(y) - 1);
    if (keKanan) j.setOrigin(1, 0.5);
    this.scene.tweens.add({
      targets: j,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.4,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => j.destroy(),
    });
  }

  /** Untuk mengetes dari konsol: satu lompatan ikan sekarang juga. */
  lompatIkan() {
    this.ikan.lompatIkan();
  }
}
