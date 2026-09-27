import Phaser from 'phaser';
import { kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

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
  tegak: { x0: 18, x1: 30, y0: 40, y1: 300 },
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
 * yang sesekali melompat keluar air dengan cipratan kecil.
 *
 * Sungainya panjang tapi dulu cuma dihuni gurita di pojok barat — sisanya
 * pita biru yang diam. Keduanya sengaja jarang dan pelan: yang dicari adalah
 * "eh, ada ikan loncat", bukan akuarium.
 */
export class Sungai {
  constructor(private scene: Phaser.Scene) {
    this.buatTekstur();
    this.pasangBebek();
    this.jadwalIkan();
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
    spritesheetTeks(
      this.scene,
      'ikan',
      [
        [
          '..kkk...k',
          '.khhfk.kk',
          'kefffffkk',
          '.kfffk.kk',
          '..kkk...k',
        ],
      ],
      { k: '#2b4a5a', f: '#8fc6de', h: '#e6f5fb', e: '#10222b' }
    );
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
      if (kepak > 700) {
        kepak = 0;
        for (const b of [induk, anak]) b.setFrame(b.frame.name === '0' ? 1 : 0);
        if (diam <= 0) this.riak(induk.x + (induk.flipX ? -6 : 6), induk.y - 1);
      }
    });
  }

  /** Riak kecil di belakang bebek yang sedang berenang. */
  private riak(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(kedalaman(y) - 1);
    g.fillStyle(0xe6f5fb, 0.9).fillRect(x - 2, y, 2, 1).fillRect(x + 1, y, 2, 1);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.6,
      duration: 900,
      onComplete: () => g.destroy(),
    });
  }

  /* ---------------- ikan ---------------- */

  private jadwalIkan() {
    const lompat = () => {
      this.lompatIkan();
      this.scene.time.delayedCall(Phaser.Math.Between(3500, 8000), lompat);
    };
    this.scene.time.delayedCall(Phaser.Math.Between(1500, 4000), lompat);
  }

  /**
   * Satu lompatan: ikan muncul, melengkung ke atas lalu kembali ke air,
   * badannya ikut menukik mengikuti lengkungan. Cipratan di titik keluar
   * dan titik masuk.
   */
  private lompatIkan() {
    const tegak = Math.random() < 0.25;
    let x: number;
    let y: number;
    if (tegak) {
      const t = SUNGAI.tegak;
      x = Phaser.Math.Between(t.x0, t.x1);
      y = Phaser.Math.Between(t.y0, t.y1);
    } else {
      const r = Phaser.Utils.Array.GetRandom([...SUNGAI.ruas]);
      do x = Phaser.Math.Between(r.x0 + 10, r.x1 - 26);
      while (SUNGAI.batu.some(([b0, b1]) => x > b0 - 20 && x < b1 + 4));
      y = Phaser.Math.Between(SUNGAI.lajur.atas + 4, SUNGAI.lajur.bawah);
    }
    const arah = tegak ? 0 : Math.random() < 0.5 ? -1 : 1;
    const lebar = tegak ? 0 : 16;
    const tinggi = tegak ? 10 : 14;
    const ikan = this.scene.add.image(x, y, 'ikan').setDepth(kedalaman(y) + 2).setFlipX(arah > 0);
    this.cipratan(x, y);
    const t = { f: 0 };
    this.scene.tweens.add({
      targets: t,
      f: 1,
      duration: 620,
      ease: 'Linear',
      onUpdate: () => {
        const f = t.f;
        ikan.setPosition(x + arah * lebar * f, y - tinggi * 4 * f * (1 - f));
        // menukik: naik di awal, turun di akhir
        const miring = (1 - 2 * f) * 0.9;
        ikan.setRotation(tegak ? -Math.PI / 2 + miring : arah > 0 ? -miring : miring);
      },
      onComplete: () => {
        this.cipratan(x + arah * lebar, y);
        ikan.destroy();
      },
    });
  }

  private cipratan(x: number, y: number) {
    const d = kedalaman(y) + 3;
    const ring = this.scene.add.graphics().setDepth(d - 2);
    ring.lineStyle(1, 0xe6f5fb, 0.9).strokeEllipse(x, y, 8, 3);
    this.scene.tweens.add({ targets: ring, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    for (let i = 0; i < 5; i++) {
      const tetes = this.scene.add.rectangle(x, y - 1, 1, 1, 0xf4fbff).setDepth(d);
      this.scene.tweens.add({
        targets: tetes,
        x: x + Phaser.Math.Between(-6, 6),
        y: y - Phaser.Math.Between(4, 9),
        alpha: 0,
        duration: Phaser.Math.Between(350, 550),
        ease: 'Quad.easeOut',
        onComplete: () => tetes.destroy(),
      });
    }
  }
}
