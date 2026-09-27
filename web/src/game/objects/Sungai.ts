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
    this.buatKoi();
  }

  /**
   * Ikan koi oranye, lima pose: menanjak tajam, menanjak, datar, menukik,
   * menukik tajam. Tiap pose digambar ULANG per piksel dari bentuk dasarnya
   * (rotasi dengan sampel tetangga terdekat, lalu garis tepinya dihitung
   * lagi), bukan sprite yang diputar saat berjalan — sprite piksel yang
   * diputar bebas jadi bergerigi dan kabur, dan itulah yang membuat ikan
   * versi pertama terlihat jelek.
   */
  private buatKoi() {
    const tx = this.scene.textures;
    if (tx.exists('koi')) return;
    // bentuk dasar menghadap kanan: badan elips + ekor bercabang di kiri
    const W = 14;
    const H = 8;
    const warnaDasar = (x: number, y: number): string | null => {
      const bx = (x - 8.2) / 5.2;
      const by = (y - 3.6) / 2.6;
      if (bx * bx + by * by <= 1) {
        if (x >= 11 && y === 3) return 'e'; // mata
        if (y <= 2) return 'h'; // punggung terang
        if (y >= 5) return 'y'; // perut
        if ((x === 7 || x === 8) && y === 3) return 'w'; // bercak putih koi
        return 'o';
      }
      // ekor: dua cuping di kiri badan
      if (x >= 0 && x <= 3) {
        const t = 3 - x;
        if (Math.abs(y - 3.6) <= 0.8 + t * 0.9 && Math.abs(y - 3.6) >= t * 0.5 - 0.2) return 'f';
      }
      return null;
    };
    const S = 16; // kanvas per pose, cukup untuk hasil putaran
    const pose = [-0.7, -0.35, 0, 0.35, 0.7];
    const palet: Record<string, string> = {
      o: '#f28c28',
      h: '#ffc070',
      y: '#fff0d4',
      w: '#fffaf0',
      f: '#e0701a',
      e: '#1b1010',
      k: '#5a2a10',
    };
    const kanvas = tx.createCanvas('koi', S * pose.length, S)!;
    const ctx = kanvas.getContext();
    pose.forEach((a, i) => {
      const grid: (string | null)[][] = Array.from({ length: S }, () => Array(S).fill(null));
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          // putar balik titik tujuan ke bentuk dasar
          const dx = x - S / 2 + 0.5;
          const dy = y - S / 2 + 0.5;
          const sx = Math.round(dx * cos + dy * sin + W / 2 - 0.5);
          const sy = Math.round(-dx * sin + dy * cos + H / 2 - 0.5);
          if (sx >= 0 && sy >= 0 && sx < W && sy < H) grid[y][x] = warnaDasar(sx, sy);
        }
      }
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          let c = grid[y][x];
          if (!c) {
            const tetangga = [grid[y - 1]?.[x], grid[y + 1]?.[x], grid[y]?.[x - 1], grid[y]?.[x + 1]];
            if (tetangga.some((t) => t && t !== 'k')) c = 'k';
          }
          if (!c) continue;
          ctx.fillStyle = palet[c];
          ctx.fillRect(i * S + x, y, 1, 1);
        }
      }
      kanvas.add(i, 0, i * S, 0, S, S);
    });
    kanvas.refresh();
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

  /* ---------------- ikan ---------------- */

  private jadwalIkan() {
    const lompat = () => {
      this.lompatIkan();
      this.scene.time.delayedCall(Phaser.Math.Between(1500, 4000), lompat);
    };
    this.scene.time.delayedCall(Phaser.Math.Between(800, 2000), lompat);
  }

  /**
   * Tempat lompatan berikutnya. Sebagian besar dipilih di bagian sungai yang
   * sedang terlihat di layar — sungainya jauh lebih panjang dari layar, dan
   * lompatan yang terjadi di luar pandangan tidak ada gunanya.
   */
  private tempatLompat() {
    const v = this.scene.cameras.main.worldView;
    const kandidat: { x: number; y: number; tegak: boolean }[] = [];
    for (let coba = 0; coba < 12; coba++) {
      const tegak = Math.random() < 0.2;
      let x: number;
      let y: number;
      if (tegak) {
        const t = SUNGAI.tegak;
        x = Phaser.Math.Between(t.x0, t.x1);
        y = Phaser.Math.Between(t.y0, t.y1);
      } else {
        const r = Phaser.Utils.Array.GetRandom([...SUNGAI.ruas]);
        x = Phaser.Math.Between(r.x0 + 12, r.x1 - 30);
        y = Phaser.Math.Between(SUNGAI.lajur.atas + 6, SUNGAI.lajur.bawah);
        if (SUNGAI.batu.some(([b0, b1]) => x > b0 - 28 && x < b1 + 6)) continue;
      }
      const terlihat = v.contains(x, y);
      if (terlihat || Math.random() < 0.35) return { x, y, tegak };
      kandidat.push({ x, y, tegak });
    }
    return kandidat[0] ?? null;
  }

  /**
   * Satu lompatan: riak kecil dulu sebagai aba-aba, lalu koi melesat keluar,
   * melengkung, dan kembali ke air. Pose badannya berganti mengikuti
   * lengkungan (menanjak → datar → menukik), dengan cipratan di titik keluar
   * dan titik masuk.
   */
  private lompatIkan() {
    const t0 = this.tempatLompat();
    if (!t0) return;
    const { x, y, tegak } = t0;
    const arah = tegak ? 1 : Math.random() < 0.5 ? -1 : 1;
    const lebar = tegak ? 6 : 24;
    const tinggi = tegak ? 12 : 18;
    this.ring(x, y, 6, 2, 0.7);
    this.scene.time.delayedCall(260, () => {
      const ikan = this.scene.add
        .sprite(x, y, 'koi', 2)
        .setDepth(kedalaman(y) + 2)
        .setFlipX(arah < 0);
      this.cipratan(x, y);
      const t = { f: 0 };
      this.scene.tweens.add({
        targets: t,
        f: 1,
        duration: 720,
        ease: 'Linear',
        onUpdate: () => {
          const f = t.f;
          ikan.setPosition(x + arah * lebar * f, y - tinggi * 4 * f * (1 - f));
          // pose: 0 menanjak tajam … 4 menukik tajam
          ikan.setFrame(Math.min(4, Math.floor(f * 5)));
        },
        onComplete: () => {
          this.cipratan(x + arah * lebar, y);
          ikan.destroy();
        },
      });
    });
  }

  private ring(x: number, y: number, rx: number, ry: number, alpha: number) {
    const g = this.scene.add.graphics().setDepth(kedalaman(y) + 1);
    g.lineStyle(1, 0xe6f5fb, alpha).strokeEllipse(0, 0, rx * 2, ry * 2);
    g.setPosition(x, y);
    this.scene.tweens.add({
      targets: g,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  private cipratan(x: number, y: number) {
    this.ring(x, y, 5, 2, 0.95);
    this.scene.time.delayedCall(140, () => this.ring(x, y, 4, 1.5, 0.7));
    const d = kedalaman(y) + 3;
    for (let i = 0; i < 8; i++) {
      const besar = i < 3;
      const tetes = this.scene.add
        .rectangle(x, y - 1, besar ? 2 : 1, besar ? 2 : 1, i % 2 ? 0xffffff : 0xcdefff)
        .setDepth(d);
      const tx = x + Phaser.Math.Between(-9, 9);
      this.scene.tweens.add({
        targets: tetes,
        x: tx,
        y: y - Phaser.Math.Between(6, 13),
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.scene.tweens.add({
            targets: tetes,
            y: y + 1,
            alpha: 0,
            duration: 260,
            ease: 'Quad.easeIn',
            onComplete: () => tetes.destroy(),
          }),
      });
    }
  }
}
