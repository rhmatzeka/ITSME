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

/**
 * Kehidupan sungai: induk bebek yang berenang pelan diikuti anak-anaknya
 * berbaris, dan ikan (lihat Ikan.ts) yang berenang di bawah permukaan dan
 * sesekali melompat.
 *
 * Sungainya panjang tapi dulu cuma dihuni gurita di pojok barat — sisanya
 * pita biru yang diam. Semuanya sengaja jarang dan pelan: yang dicari adalah
 * "eh, ada ikan loncat", bukan akuarium.
 */
export class Sungai {
  private ikan: Ikan;

  constructor(private scene: Phaser.Scene) {
    this.buatTekstur();
    this.pasangBebek();
    this.ikan = new Ikan(scene, SUNGAI);
  }

  /**
   * Bebek menghadap kiri. Versi pertamanya 12×10 dengan kepala yang
   * menempel langsung ke badan — terbaca sebagai gumpalan putih, dan
   * anaknya cuma induk yang diperkecil. Sekarang: kepala kecil di leher
   * melengkung, paruh pipih, badan montok dengan ekor mencuat, dan garis
   * air terang di bawahnya supaya terlihat mengapung, bukan menempel.
   *
   * Frame induk: 0-1 berenang (ekor bergoyang), 2 menyelupkan kepala
   * mencari makan, ekornya menjulang. Anak bebek kuning: 0-1 terangguk.
   */
  private buatTekstur() {
    const induk = [
      '................',
      '...kkk..........',
      '..kwwwk.........',
      '..kewwwk........',
      'koowwwwk......kk',
      'kOOkwwk......kwk',
      '.kk.kwwk....kwwk',
      '....kwwgkkkkkwwk',
      '...kwwwwwwwwgwwk',
      '..kwwwwwggggwwsk',
      '..kwwwwwwgssgssk',
      '..kgwwwwwwwwsssk',
      '...kssssssssssk.',
      '....llllllllll..',
    ];
    const induk2 = [...induk];
    induk2[4] = 'koowwwwk........';
    induk2[5] = 'kOOkwwk.......kk';
    induk2[6] = '.kk.kwwk....kkwk';
    const nyelup = [
      '................',
      '...........kk...',
      '..........kwk...',
      '.........kwwk...',
      '.......kkwwgk...',
      '.....kkwwwwsk...',
      '...kkwwwwgwsk...',
      '..kwwwwgggsssk..',
      '..kwwwwwwssssk..',
      '..kgwwwwwwsssk..',
      '...kssssssssk...',
      '....lllllllll...',
      '................',
      '................',
    ];
    spritesheetTeks(this.scene, 'bebek', [induk, induk2, nyelup], {
      k: '#40363a',
      w: '#f7f5ee',
      g: '#dcd6c8',
      s: '#b9b2a3',
      o: '#f39a2b',
      O: '#c96a14',
      e: '#1b1b1b',
      l: '#8fd3f4',
    });
    const anak = [
      '.........',
      '..kkk....',
      '.kyyyk...',
      '.keyyk..k',
      'kooyyykyk',
      '.kkyyyyyk',
      '..kyyyyYk',
      '..kYYYYk.',
      '...llll..',
    ];
    const anak2 = ['.........', '.........', '..kkk....', '.kyyyk...', '.keyyk.kk', 'kooyyykyk', '.kkyyyyYk', '..kYYYYk.', '...llll..'];
    spritesheetTeks(this.scene, 'anak_bebek', [anak, anak2], {
      k: '#5a4020',
      y: '#ffd84a',
      Y: '#e9b52a',
      o: '#f08a24',
      e: '#1b1b1b',
      l: '#8fd3f4',
    });
  }

  /* ---------------- bebek ---------------- */

  private pasangBebek() {
    const ruas = SUNGAI.ruas[0];
    const z = this.scene.cameras.main.zoom;
    const kunci = (v: number) => Math.round(v * z) / z;
    // mulai di sisi timur batu, bentangan terpanjang ruas ini
    const induk = this.scene.add.sprite(300, SUNGAI.lajur.bawah, 'bebek', 0).setOrigin(0.5, 1);
    const anak = [0, 1, 2].map(() => this.scene.add.sprite(300, SUNGAI.lajur.bawah, 'anak_bebek', 0).setOrigin(0.5, 1));
    const posisi: { x: number; y: number } = { x: induk.x, y: SUNGAI.lajur.bawah };
    let tujuan = { x: posisi.x, y: posisi.y };
    let diam = 0;
    let nyelup = 0;
    let kepak = 0;

    /*
     * Jejak induk, satu titik tiap 1px yang ditempuh — bukan tiap frame.
     * Versi lama mencatat tiap frame, jadi saat induk berhenti jejaknya
     * menumpuk di satu titik dan anaknya ikut merapat sampai menempel di
     * badan induk. Diukur per jarak, barisannya tetap berjarak waktu diam.
     * Diisi dulu ke arah timur supaya anak-anak sudah berbaris sejak awal.
     */
    const JARAK = [14, 25, 36];
    const jejak = Array.from({ length: 44 }, (_, i) => ({ x: posisi.x + 44 - i, y: posisi.y }));
    const catat = () => {
      const ujung = jejak[jejak.length - 1];
      const d = Math.hypot(posisi.x - ujung.x, posisi.y - ujung.y);
      if (d < 1) return;
      jejak.push({ x: posisi.x, y: posisi.y });
      if (jejak.length > 60) jejak.shift();
    };
    const titik = (jarak: number) => jejak[Math.max(0, jejak.length - 1 - jarak)];

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
      if (nyelup > 0) {
        nyelup -= delta;
        if (nyelup <= 0) induk.setFrame(0);
      } else if (diam > 0) {
        diam -= delta;
      } else {
        const dx = tujuan.x - posisi.x;
        const dy = tujuan.y - posisi.y;
        const jarak = Math.hypot(dx, dy);
        if (jarak < 2) {
          diam = Phaser.Math.Between(1500, 4500);
          pilih();
          // sering berhenti untuk menyelupkan kepala, mencari makan
          if (Math.random() < 0.55) {
            nyelup = Phaser.Math.Between(1200, 2200);
            induk.setFrame(2);
            const kepala = induk.x + (induk.flipX ? 5 : -5);
            this.cincin(kepala, induk.y - 3);
            this.scene.time.delayedCall(700, () => nyelup > 0 && this.cincin(kepala, induk.y - 3));
          }
        } else {
          const laju = 7 * dt;
          posisi.x += (dx / jarak) * laju;
          posisi.y += (dy / jarak) * laju;
        }
      }
      catat();
      induk.setPosition(kunci(posisi.x), kunci(posisi.y));
      if (Math.abs(tujuan.x - induk.x) > 1 && diam <= 0 && nyelup <= 0) induk.setFlipX(tujuan.x > induk.x);
      induk.setDepth(kedalaman(induk.y));
      const bergerak = diam <= 0 && nyelup <= 0;
      anak.forEach((a, i) => {
        const p = titik(JARAK[i]);
        const depan = titik(JARAK[i] - 4);
        a.setPosition(kunci(p.x), kunci(p.y)).setDepth(kedalaman(p.y) - 0.5);
        if (bergerak && Math.abs(depan.x - p.x) > 0.5) a.setFlipX(depan.x > p.x);
        // waktu induk berhenti, anak-anaknya menoleh ke sana kemari
        else if (!bergerak && Math.random() < 0.004) a.setFlipX(!a.flipX);
      });
      kepak += delta;
      if (kepak > 520) {
        kepak = 0;
        if (nyelup <= 0) induk.setFrame(induk.frame.name === '0' ? 1 : 0);
        anak.forEach((a, i) => (Math.random() < 0.7 || i === 0) && a.setFrame(a.frame.name === '0' ? 1 : 0));
        if (bergerak) {
          // di ekor masing-masing bebek, bukan di tengah badannya
          this.riak(induk.x + (induk.flipX ? -7 : 7), induk.y - 3, induk.flipX);
          for (const a of anak) this.riak(a.x + (a.flipX ? -4 : 4), a.y - 2, a.flipX, true);
        }
      }
    });
  }

  /** Riak melingkar kecil di tempat bebek menyelupkan kepala. */
  private cincin(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(kedalaman(y) - 1);
    g.lineStyle(1, 0xdff4fc, 0.8).strokeEllipse(0, 0, 6, 2);
    g.setPosition(x, y);
    this.scene.tweens.add({
      targets: g,
      scaleX: 2.2,
      scaleY: 2,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
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
