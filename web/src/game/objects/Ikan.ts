import Phaser from 'phaser';
import { DEPTH, kedalaman } from '../config';

/** Bagian sungai tempat ikan hidup, px dunia — diisi oleh Sungai. */
export interface ZonaIkan {
  /** Sungai tegak di tepi barat. Airnya mengalir ke bawah, ke tikungan gurita. */
  tegak: { x0: number; x1: number; y0: number; y1: number };
  /** Sungai mendatar: bentangan di antara jembatan, dan lajur tengah airnya. */
  ruas: readonly { x0: number; x1: number }[];
  lajur: { atas: number; bawah: number };
}

type Gambar = (string | null)[][];

interface Perenang {
  s: Phaser.GameObjects.Sprite;
  jenis: Jenis;
  tegak: boolean;
  /** -1 ke atas/kiri, 1 ke bawah/kanan. */
  arah: number;
  laju: number;
  /** Sisa waktu sebelum menyelam lagi, ms. */
  sisa: number;
  kibas: number;
  x: number;
  y: number;
  selesai: boolean;
}

/**
 * Satu jenis ikan. Warnanya ditulis sebagai fungsi, bukan gambar teks per
 * jenis: bentuk badannya sama untuk semua (satu ukuran besar, satu kecil),
 * yang membedakan cuma motif — jadi siluetnya tetap satu keluarga.
 *
 * `samping` mewarnai badan tampak samping: u -1 (pangkal ekor) … 1 (moncong),
 * v -1 (punggung) … 1 (perut). `atas` mewarnai badan tampak atas: `r` baris
 * dari ujung ekor, `c` kolom dari garis tengah (negatif = kiri), `h` huruf
 * asli gambar dasarnya (b punggung, s sisi).
 */
interface Jenis {
  id: string;
  /** Seberapa sering muncul dibanding jenis lain. */
  bobot: number;
  /** Badan kecil: lompatannya pendek dan datang berombongan. */
  kecil?: boolean;
  /** Sirip punggung berduri, khas nila. */
  duri?: boolean;
  palet: Record<string, string>;
  samping(u: number, v: number, x: number, y: number): string;
  atas(r: number, c: number, h: string): string;
}

const JENIS: Jenis[] = [
  {
    id: 'koi',
    bobot: 28,
    palet: { o: '#f28c28', h: '#ffc070', y: '#fff0d4', w: '#fffaf0', f: '#e0701a', e: '#1b1010', k: '#5a2a10' },
    samping: (u, v) =>
      v <= -0.55 ? 'h' : v >= 0.5 ? 'y' : u > -0.3 && u < 0.08 && Math.abs(v) < 0.35 ? 'w' : 'o',
    atas: (r, c) => ((r === 6 || r === 7) && Math.abs(c) <= 1 ? 'w' : r === 9 && c === -1 ? 'h' : 'o'),
  },
  {
    // kohaku: koi putih bercak merah — pasangan yang paling sering ada di kolam
    id: 'kohaku',
    bobot: 18,
    palet: { o: '#fbf5ec', r: '#d8341f', y: '#ffffff', f: '#efe4d6', e: '#1b1010', k: '#5b3a33' },
    samping: (u, v) =>
      v >= 0.5 ? 'y' : (u > 0.42 && v < 0.2) || (u > -0.45 && u < 0.12 && v < -0.05) ? 'r' : 'o',
    atas: (r, c) => ((r === 5 || r === 6) && Math.abs(c) <= 1) || (r >= 10 && c === 0) || (r === 8 && c < 0) ? 'r' : 'o',
  },
  {
    id: 'mas',
    bobot: 18,
    palet: { o: '#f4b52c', h: '#ffe07a', y: '#fff4c9', g: '#d18a12', s: '#fff1a8', f: '#e39516', e: '#1b1010', k: '#5a3a08' },
    samping: (u, v, x, y) =>
      v <= -0.55 ? 'h' : v >= 0.5 ? 'y' : (x + y) % 3 === 0 && Math.abs(v) < 0.35 && u < 0.4 ? 's' : 'o',
    atas: (_r, _c, h) => (h === 'b' ? 'g' : 'o'),
  },
  {
    // nila: abu kehijauan bergaris tegak, ekornya kemerahan
    id: 'nila',
    bobot: 20,
    duri: true,
    palet: { o: '#8a9c84', h: '#617360', b: '#4c5c4b', y: '#d3dccb', d: '#6b7d69', f: '#c65a3e', e: '#1b1010', k: '#1f2a1f' },
    samping: (u, v, x) => (v >= 0.5 ? 'y' : x % 3 === 0 && u < 0.45 && v < 0.4 ? 'b' : v <= -0.55 ? 'h' : 'o'),
    atas: (r, _c, h) => (h === 'b' ? 'h' : r === 5 || r === 7 || r === 9 ? 'b' : 'o'),
  },
  {
    // wader: ikan kali kecil keperakan, melompat bergerombol
    id: 'wader',
    bobot: 16,
    kecil: true,
    palet: { o: '#bccbd8', h: '#7d97ad', y: '#f0f5f9', l: '#ffffff', f: '#9fb3c3', e: '#1b1010', k: '#26323c' },
    samping: (u, v, _x, y) => (v <= -0.45 ? 'h' : v >= 0.45 ? 'y' : y === 3 && u < 0.5 ? 'l' : 'o'),
    atas: (_r, _c, h) => (h === 'b' ? 'h' : 'o'),
  },
];

/** Ukuran badan tampak samping. Besar = koi versi pertama, apa adanya. */
const BENTUK = {
  besar: { W: 14, H: 8, cx: 8.2, cy: 3.6, rx: 5.2, ry: 2.6, ekor: 4 },
  kecil: { W: 10, H: 6, cx: 5.9, cy: 2.8, rx: 3.9, ry: 1.9, ekor: 3 },
} as const;

/**
 * Badan tampak atas, kepala di bawah — begitulah ikan terlihat dari tepi
 * sungai tegak saat ia melompat searah arus. t ekor, b punggung, s sisi,
 * f sirip dada, e mata. Garis tepinya tidak digambar: dihitung setelah
 * gambar dipendekkan atau ekornya dikibaskan, jadi selalu rapat.
 */
const ATAS = {
  besar: [
    '.tt...tt.',
    '..tt.tt..',
    '...ttt...',
    '....t....',
    '...sbs...',
    '...sbs...',
    '..ssbss..',
    '..ssbss..',
    '.fssbssf.',
    '.fssbssf.',
    '..ssbss..',
    '..esbse..',
    '...sss...',
  ],
  kecil: ['.tt.tt.', '..ttt..', '...t...', '..sbs..', '.fsbsf.', '..sbs..', '..ebe..', '..sss..'],
} as const;

/** Warna air sungai di map_full.png — dasar peta air, lihat `petaAir`. */
const WARNA_AIR = [0x249fde, 0x1e7fb1, 0x78c3e9];
/** Warna air dalam: ikan yang berenang di bawah permukaan dicampur ke sini. */
const AIR_DALAM = 0x1b6ea6;

const acak = <T>(daftar: readonly T[]) => daftar[Math.floor(Math.random() * daftar.length)];

function pilihJenis() {
  let n = Math.random() * JENIS.reduce((a, j) => a + j.bobot, 0);
  for (const j of JENIS) if ((n -= j.bobot) < 0) return j;
  return JENIS[0];
}

/** Garis tepi: petak kosong yang bersebelahan (4 arah) dengan badan. */
function beriTepi(g: Gambar) {
  const h = g.length;
  const w = g[0].length;
  const hasil = g.map((b) => [...b]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x]) continue;
      const t = [g[y - 1]?.[x], g[y + 1]?.[x], g[y][x - 1], g[y][x + 1]];
      if (t.some((c) => c && c !== 'k')) hasil[y][x] = 'k';
    }
  }
  return hasil;
}

/** Putar 90° searah jarum jam: kepala yang di bawah pindah ke kiri. */
function putar(g: Gambar): Gambar {
  const h = g.length;
  const w = g[0].length;
  return Array.from({ length: w }, (_, r) => Array.from({ length: h }, (_, c) => g[h - 1 - c][r]));
}

function campur(hex: string, ke: number, t: number) {
  const a = parseInt(hex.slice(1), 16);
  const kanal = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((ke >> s) & 255) * t);
  return `rgb(${kanal(16)},${kanal(8)},${kanal(0)})`;
}

/**
 * Ikan di sungai, lima jenis. Tiga cara mereka terlihat:
 *
 * - bayangan yang berenang pelan di bawah permukaan, lalu menyelam lagi;
 * - lompatan di sungai mendatar, tampak samping, melengkung ke kiri/kanan;
 * - lompatan di sungai tegak, tampak ATAS, meluncur ke bawah searah arus.
 *
 * Versi sebelumnya memakai lompatan tampak samping di sungai tegak juga,
 * cuma diperpendek — ikannya meloncat melintang, ke tebing, padahal
 * sungainya mengalir ke bawah. Dari tepi sungai tegak, ikan yang melompat
 * searah arus terlihat dari punggungnya: badannya memanjang saat di puncak
 * dan memendek saat keluar-masuk air, sementara bayangannya di air
 * menunjukkan seberapa tinggi ia.
 */
export class Ikan {
  /** 1 = air terbuka (bukan batu, teratai, rumput air, atau papan jembatan). */
  private air: Uint8Array | null = null;
  private lebarPeta = 0;
  private perenang: Perenang[] = [];

  constructor(
    private scene: Phaser.Scene,
    private zona: ZonaIkan
  ) {
    this.petaAir();
    for (const j of JENIS) this.buatTekstur(j);
    this.jadwalLompat();
    for (let i = 0; i < 4; i++) this.scene.time.delayedCall(400 + i * 900, () => this.munculBerenang());
    this.scene.events.on('update', (_t: number, d: number) => this.berenang(d));
  }

  /* ---------------- peta air ---------------- */

  /**
   * Sungainya penuh benda yang digambar di peta — jembatan, batu, teratai,
   * rumput air. Ikan yang muncul di atas batu atau menyelam ke papan
   * jembatan langsung terbaca salah, jadi tiap titik keluar-masuk air dan
   * tiap posisi perenang dicek ke warna asli peta: harus biru air.
   */
  private petaAir() {
    const tx = this.scene.textures;
    if (!tx.exists('map_full')) return;
    const img = tx.get('map_full').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    this.lebarPeta = img.width;
    this.air = new Uint8Array(img.width * img.height);
    for (let i = 0; i < this.air.length; i++) {
      const rgb = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      if (WARNA_AIR.includes(rgb)) this.air[i] = 1;
    }
  }

  /** Seluruh kotak (px dunia, pusat x,y) jatuh di air terbuka. */
  private airBebas(x: number, y: number, rx: number, ry: number) {
    if (!this.air) return true;
    const w = this.lebarPeta;
    const h = this.air.length / w;
    for (let yy = Math.round(y - ry); yy <= Math.round(y + ry); yy++) {
      for (let xx = Math.round(x - rx); xx <= Math.round(x + rx); xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || !this.air[yy * w + xx]) return false;
      }
    }
    return true;
  }

  /* ---------------- tekstur ---------------- */

  private buatTekstur(j: Jenis) {
    if (this.scene.textures.exists(`ikan_${j.id}`)) return;
    this.buatSamping(j);
    this.buatAtas(j);
  }

  /**
   * Tampak samping, lima pose: menanjak tajam, menanjak, datar, menukik,
   * menukik tajam. Tiap pose digambar ULANG per piksel dari bentuk dasarnya
   * (rotasi dengan sampel tetangga terdekat, lalu garis tepinya dihitung
   * lagi), bukan sprite yang diputar saat berjalan — sprite piksel yang
   * diputar bebas jadi bergerigi dan kabur.
   */
  private buatSamping(j: Jenis) {
    const b = j.kecil ? BENTUK.kecil : BENTUK.besar;
    const mataX = Math.floor(b.cx + b.rx * 0.62);
    const mataY = Math.round(b.cy - b.ry * 0.25);
    const dasar = (x: number, y: number): string | null => {
      const u = (x - b.cx) / b.rx;
      const v = (y - b.cy) / b.ry;
      if (u * u + v * v <= 1) return x === mataX && y === mataY ? 'e' : j.samping(u, v, x, y);
      // sirip punggung berduri, selang-seling di atas badan
      if (j.duri && y === Math.floor(b.cy - b.ry) && x >= b.cx - 3 && x <= b.cx + 1 && x % 2 === 0) return 'd';
      if (x < b.ekor) {
        const t = b.ekor - 1 - x;
        const dy = Math.abs(y - b.cy);
        if (dy <= 0.8 + t * 0.9 && dy >= t * 0.5 - 0.2) return 'f';
      }
      return null;
    };
    const S = j.kecil ? 12 : 16;
    const pose = [-0.7, -0.35, 0, 0.35, 0.7];
    const kanvas = this.scene.textures.createCanvas(`ikan_${j.id}`, S * pose.length, S)!;
    const ctx = kanvas.getContext();
    pose.forEach((a, i) => {
      const g: Gambar = Array.from({ length: S }, () => Array(S).fill(null));
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          // putar balik titik tujuan ke bentuk dasar
          const dx = x - S / 2 + 0.5;
          const dy = y - S / 2 + 0.5;
          const sx = Math.round(dx * cos + dy * sin + b.W / 2 - 0.5);
          const sy = Math.round(-dx * sin + dy * cos + b.H / 2 - 0.5);
          if (sx >= 0 && sy >= 0 && sx < b.W && sy < b.H) g[y][x] = dasar(sx, sy);
        }
      }
      this.lukis(ctx, beriTepi(g), i * S, 0, j.palet);
      kanvas.add(i, 0, i * S, 0, S, S);
    });
    kanvas.refresh();
  }

  /**
   * Tampak atas, dua lembar:
   *
   * `ikan_atas_*` untuk lompatan di sungai tegak — 0 pendek (baru keluar /
   * hampir masuk air), 1 sedang, 2-3 penuh dengan ekor terkibas ke kiri dan
   * kanan. Pendeknya dari mengambil baris gambar dasar selang-seling, bukan
   * memperkecil sprite: tetap piksel tajam.
   *
   * `ikan_bayang_*` untuk perenang di bawah air — warnanya dicampur ke biru
   * air dalam supaya terbaca "di bawah permukaan". 0-1 kepala ke bawah,
   * 2-3 kepala ke kiri, masing-masing dua kibasan ekor.
   */
  private buatAtas(j: Jenis) {
    const seni = j.kecil ? ATAS.kecil : ATAS.besar;
    const n = seni.length;
    const w = seni[0].length;
    const tengah = (w - 1) / 2;
    const ekor = j.kecil ? 2 : 3; // baris ekor yang ikut terkibas
    const warna = (r: number, c: number, h: string) =>
      h === 't' || h === 'f' ? 'f' : h === 'e' ? 'e' : j.atas(r, c - tengah, h);

    // gambar dasar dengan ekor dikibas `kibas` kolom; bingkai 1 petak untuk garis tepi
    const dasar = (kibas: number): Gambar =>
      Array.from({ length: n }, (_, r) =>
        Array.from({ length: w }, (_, c) => {
          const sc = r < ekor ? c - kibas : c;
          const h = seni[r][sc];
          return !h || h === '.' ? null : warna(r, sc, h);
        })
      );
    const bingkai = (g: Gambar, H: number, W: number): Gambar => {
      const hasil: Gambar = Array.from({ length: H }, () => Array(W).fill(null));
      const oy = Math.floor((H - g.length) / 2);
      const ox = Math.floor((W - g[0].length) / 2);
      g.forEach((b, y) => b.forEach((c, x) => (hasil[y + oy][x + ox] = c)));
      return beriTepi(hasil);
    };
    const pendek = (g: Gambar, k: number): Gambar => {
      const m = Math.max(3, Math.round(n * k));
      return Array.from({ length: m }, (_, i) => g[Math.min(n - 1, Math.floor(((i + 0.5) * n) / m))]);
    };

    const H = n + 2;
    const W = w + 2;
    const lompat = [pendek(dasar(0), 0.5), pendek(dasar(0), 0.75), dasar(-1), dasar(1)];
    const k1 = this.scene.textures.createCanvas(`ikan_atas_${j.id}`, W * lompat.length, H)!;
    lompat.forEach((g, i) => {
      this.lukis(k1.getContext(), bingkai(g, H, W), i * W, 0, j.palet);
      k1.add(i, 0, i * W, 0, W, H);
    });
    k1.refresh();

    const keruh: Record<string, string> = {};
    for (const [h, c] of Object.entries(j.palet)) keruh[h] = campur(c, AIR_DALAM, h === 'k' ? 0.65 : 0.45);
    const S = Math.max(W, H);
    const bayang = [dasar(-1), dasar(1)];
    const k2 = this.scene.textures.createCanvas(`ikan_bayang_${j.id}`, S * 4, S)!;
    [...bayang, ...bayang.map(putar)].forEach((g, i) => {
      this.lukis(k2.getContext(), bingkai(g, S, S), i * S, 0, keruh);
      k2.add(i, 0, i * S, 0, S, S);
    });
    k2.refresh();
  }

  private lukis(ctx: CanvasRenderingContext2D, g: Gambar, ox: number, oy: number, palet: Record<string, string>) {
    g.forEach((b, y) =>
      b.forEach((c, x) => {
        if (!c) return;
        ctx.fillStyle = palet[c] ?? '#ff00ff';
        ctx.fillRect(ox + x, oy + y, 1, 1);
      })
    );
  }

  /* ---------------- tempat ---------------- */

  /**
   * Titik acak di air, sebagian besar di bagian sungai yang sedang terlihat
   * — sungainya jauh lebih panjang dari layar, dan ikan yang muncul di luar
   * pandangan tidak ada gunanya. `cocok` memeriksa titiknya (air bebas, dll).
   */
  private cariTempat(cocok: (x: number, y: number, tegak: boolean) => boolean) {
    const v = this.scene.cameras.main.worldView;
    let cadangan: { x: number; y: number; tegak: boolean } | null = null;
    for (let coba = 0; coba < 24; coba++) {
      const tegak = Math.random() < 0.4;
      let x: number;
      let y: number;
      if (tegak) {
        const t = this.zona.tegak;
        x = Phaser.Math.Between(t.x0, t.x1);
        y = Phaser.Math.Between(t.y0, t.y1);
      } else {
        const r = acak(this.zona.ruas);
        x = Phaser.Math.Between(r.x0 + 8, r.x1 - 8);
        y = Phaser.Math.Between(this.zona.lajur.atas, this.zona.lajur.bawah);
      }
      if (!cocok(x, y, tegak)) continue;
      if (v.contains(x, y)) return { x, y, tegak };
      cadangan ??= { x, y, tegak };
    }
    return Math.random() < 0.35 ? cadangan : null;
  }

  /* ---------------- berenang ---------------- */

  /** Ukuran setengah badan perenang, px, untuk pengecekan air. */
  private badan(j: Jenis, tegak: boolean) {
    const [p, l] = j.kecil ? [5, 3] : [7, 4];
    return tegak ? { rx: l, ry: p } : { rx: p, ry: l };
  }

  /**
   * Satu ikan naik dari dasar: memudar masuk, berenang pelan menyusuri
   * sungai, lalu menyelam lagi — atau sesekali meneruskannya jadi lompatan.
   */
  private munculBerenang() {
    const jenis = pilihJenis();
    const t = this.cariTempat((x, y, tegak) => {
      const b = this.badan(jenis, tegak);
      return this.airBebas(x, y, b.rx + 1, b.ry + 1);
    });
    if (!t) {
      this.scene.time.delayedCall(1500, () => this.munculBerenang());
      return;
    }
    // di sungai tegak kebanyakan melawan arus (naik), seperti ikan sungai
    const arah = t.tegak ? (Math.random() < 0.7 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
    const s = this.scene.add
      .sprite(t.x, t.y, `ikan_bayang_${jenis.id}`, t.tegak ? 0 : 2)
      .setDepth(DEPTH.below + 1)
      .setAlpha(0)
      .setFlipY(t.tegak && arah < 0)
      .setFlipX(!t.tegak && arah > 0);
    const z = this.scene.cameras.main.zoom;
    // kecil tetap kecil: wader tidak dibesarkan seperti bebek kecil
    if (!jenis.kecil && Math.random() < 0.3) s.setScale(Math.max(1, Math.round(z * 0.8)) / z);
    this.scene.tweens.add({ targets: s, alpha: 0.9, duration: 900, ease: 'Sine.easeOut' });
    this.perenang.push({
      s,
      jenis,
      tegak: t.tegak,
      arah,
      laju: jenis.kecil ? Phaser.Math.Between(9, 14) : Phaser.Math.Between(4, 8),
      sisa: Phaser.Math.Between(3500, 8000),
      kibas: 0,
      x: t.x,
      y: t.y,
      selesai: false,
    });
  }

  private berenang(delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const z = this.scene.cameras.main.zoom;
    const kunci = (v: number) => Math.round(v * z) / z;
    for (const p of this.perenang) {
      if (p.selesai) continue;
      const b = this.badan(p.jenis, p.tegak);
      const nx = p.tegak ? p.x : p.x + p.arah * p.laju * dt;
      const ny = p.tegak ? p.y + p.arah * p.laju * dt : p.y;
      if (this.airBebas(nx, ny, b.rx, b.ry)) {
        p.x = nx;
        p.y = ny;
      } else {
        // batu, jembatan, atau tebing di depan: balik arah
        p.arah = -p.arah;
        if (p.tegak) p.s.setFlipY(p.arah < 0);
        else p.s.setFlipX(p.arah > 0);
      }
      p.s.setPosition(kunci(p.x), kunci(p.y));
      p.kibas += delta;
      const tempo = p.jenis.kecil ? 160 : 260;
      if (p.kibas > tempo) {
        p.kibas = 0;
        const f = Number(p.s.frame.name);
        p.s.setFrame(f % 2 === 0 ? f + 1 : f - 1);
      }
      p.sisa -= delta;
      if (p.sisa <= 0) this.selam(p);
    }
    this.perenang = this.perenang.filter((p) => p.s.active);
  }

  private selam(p: Perenang) {
    p.selesai = true;
    // sesekali ikannya tidak menyelam, tapi melesat keluar air
    const bisaLompat =
      Math.random() < 0.35 &&
      p.s.alpha > 0.5 &&
      (p.tegak ? p.arah > 0 && this.lompatanTegakMuat(p.jenis, p.x, p.y) : this.lompatanDatarMuat(p.x, p.y, p.arah));
    if (bisaLompat) {
      p.s.destroy();
      if (p.tegak) this.lompatTegak(p.jenis, p.x, p.y);
      else this.lompatDatar(p.jenis, p.x, p.y, p.arah);
    } else {
      this.scene.tweens.add({
        targets: p.s,
        alpha: 0,
        duration: 800,
        ease: 'Sine.easeIn',
        onComplete: () => p.s.destroy(),
      });
    }
    this.scene.time.delayedCall(Phaser.Math.Between(1500, 5000), () => this.munculBerenang());
  }

  /* ---------------- lompat ---------------- */

  private ukuranLompat(j: Jenis) {
    return j.kecil
      ? { lebar: Phaser.Math.Between(12, 16), tinggi: Phaser.Math.Between(8, 11), durasi: 500 }
      : Math.random() < 0.15
        ? // sesekali lompatan tinggi yang lebih lama melayang
          { lebar: 26, tinggi: 26, durasi: 880 }
        : { lebar: Phaser.Math.Between(20, 26), tinggi: Phaser.Math.Between(14, 20), durasi: 720 };
  }

  /** Lompatan terpendek yang masih dianggap lompatan, px. */
  private static readonly LEBAR_MIN = 12;

  /** Titik keluar di air, dan setidaknya lompatan terpendek mendarat di air juga. */
  private lompatanDatarMuat(x: number, y: number, arah: number) {
    return this.airBebas(x, y, 5, 3) && this.airBebas(x + arah * Ikan.LEBAR_MIN, y, 5, 3);
  }

  private lompatanTegakMuat(j: Jenis, x: number, y: number) {
    const t = this.zona.tegak;
    const jauh = j.kecil ? 14 : 22;
    // cipratannya melebar ±5px: titik keluar-masuk harus jauh dari batu dan teratai
    return y + jauh <= t.y1 && this.airBebas(x, y, 5, 4) && this.airBebas(x, y + jauh, 5, 4);
  }

  private jadwalLompat() {
    const lompat = () => {
      this.lompatIkan();
      this.scene.time.delayedCall(Phaser.Math.Between(1800, 4200), lompat);
    };
    this.scene.time.delayedCall(Phaser.Math.Between(800, 2000), lompat);
  }

  /** Satu lompatan (atau satu rombongan wader) di tempat acak. */
  lompatIkan() {
    const jenis = pilihJenis();
    const arah = Math.random() < 0.5 ? -1 : 1;
    const t = this.cariTempat((x, y, tegak) =>
      tegak ? this.lompatanTegakMuat(jenis, x, y) : this.lompatanDatarMuat(x, y, arah)
    );
    if (!t) return;
    const jumlah = jenis.kecil ? Phaser.Math.Between(2, 4) : 1;
    for (let i = 0; i < jumlah; i++) {
      // rombongan: menyusul satu per satu, sedikit bergeser dari yang pertama
      const x = t.tegak ? t.x + Phaser.Math.Between(-3, 3) : t.x - arah * i * Phaser.Math.Between(3, 6);
      const y = t.tegak ? t.y - i * Phaser.Math.Between(3, 6) : t.y + Phaser.Math.Between(-2, 2);
      const muat = t.tegak ? this.lompatanTegakMuat(jenis, x, y) : this.lompatanDatarMuat(x, y, arah);
      if (i > 0 && !muat) continue;
      this.scene.time.delayedCall(i * Phaser.Math.Between(110, 190), () => {
        this.ring(x, y, 6, 2, 0.7);
        this.scene.time.delayedCall(260, () =>
          t.tegak ? this.lompatTegak(jenis, x, y) : this.lompatDatar(jenis, x, y, arah)
        );
      });
    }
  }

  /**
   * Lompatan di sungai mendatar, tampak samping: melesat keluar, melengkung,
   * kembali ke air. Pose badannya mengikuti lengkungan (menanjak → datar →
   * menukik). Kalau titik mendaratnya kena batu atau teratai, lompatannya
   * dipendekkan sampai jatuh di air.
   */
  private lompatDatar(j: Jenis, x: number, y: number, arah: number) {
    const u = this.ukuranLompat(j);
    let lebar = u.lebar;
    while (lebar > Ikan.LEBAR_MIN && !this.airBebas(x + arah * lebar, y, 5, 3)) lebar -= 2;
    const ikan = this.scene.add
      .sprite(x, y, `ikan_${j.id}`, 2)
      .setDepth(kedalaman(y) + 2)
      .setFlipX(arah < 0);
    const bayang = this.bayangan(x, y, j.kecil);
    this.cipratan(x, y, j.kecil);
    this.terbang(u.durasi, ikan, (f) => {
      const gx = x + arah * lebar * f;
      ikan.setPosition(gx, y - u.tinggi * 4 * f * (1 - f));
      bayang.setPosition(gx, y + 1).setScale(1 - 0.5 * 4 * f * (1 - f));
      // pose: 0 menanjak tajam … 4 menukik tajam
      ikan.setFrame(Math.min(4, Math.floor(f * 5)));
    }, () => {
      this.cipratan(x + arah * lebar, y, j.kecil);
      bayang.destroy();
    });
  }

  /**
   * Lompatan di sungai tegak, searah arus (ke bawah), tampak atas. Posisi di
   * air bergerak lurus ke bawah; ikannya naik di atas titik itu dan turun
   * lagi — bayangan di air yang membuat tingginya terbaca.
   */
  private lompatTegak(j: Jenis, x: number, y: number) {
    const jauh = j.kecil ? 14 : 22;
    const tinggi = j.kecil ? 7 : Phaser.Math.Between(9, 13);
    const durasi = j.kecil ? 480 : 700;
    const ikan = this.scene.add.sprite(x, y, `ikan_atas_${j.id}`, 0).setDepth(kedalaman(y + jauh) + 2);
    const bayang = this.bayangan(x, y, j.kecil);
    this.cipratan(x, y, j.kecil);
    this.terbang(durasi, ikan, (f) => {
      const gy = y + jauh * f;
      ikan.setPosition(x, gy - tinggi * 4 * f * (1 - f));
      bayang.setPosition(x, gy + 2).setScale(1 - 0.5 * 4 * f * (1 - f));
      // pendek saat keluar-masuk air, memanjang di udara dengan ekor mengibas
      ikan.setFrame(f < 0.14 || f > 0.88 ? 0 : f < 0.28 || f > 0.74 ? 1 : 2 + (Math.floor(f * 14) % 2));
    }, () => {
      this.cipratan(x, y + jauh, j.kecil);
      bayang.destroy();
    });
  }

  /** Jalannya satu lompatan, dengan tetes air yang berjatuhan dari badan. */
  private terbang(
    durasi: number,
    ikan: Phaser.GameObjects.Sprite,
    gerak: (f: number) => void,
    selesai: () => void
  ) {
    const t = { f: 0 };
    this.scene.tweens.add({
      targets: t,
      f: 1,
      duration: durasi,
      ease: 'Linear',
      onUpdate: () => {
        gerak(t.f);
        if (t.f > 0.15 && t.f < 0.8 && Math.random() < 0.25) this.tetes(ikan.x, ikan.y, ikan.depth);
      },
      onComplete: () => {
        ikan.destroy();
        selesai();
      },
    });
  }

  /** Bayangan gelap di air, tepat di bawah ikan yang sedang di udara. */
  private bayangan(x: number, y: number, kecil = false) {
    return this.scene.add
      .ellipse(x, y, kecil ? 5 : 8, kecil ? 2 : 3, 0x0e4f7a, 0.45)
      .setDepth(kedalaman(y) + 1);
  }

  private tetes(x: number, y: number, depth: number) {
    const d = this.scene.add
      .rectangle(x + Phaser.Math.Between(-2, 2), y + 1, 1, 1, Math.random() < 0.5 ? 0xffffff : 0xcdefff)
      .setDepth(depth - 1);
    this.scene.tweens.add({
      targets: d,
      y: d.y + Phaser.Math.Between(5, 9),
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => d.destroy(),
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

  private cipratan(x: number, y: number, kecil = false) {
    this.ring(x, y, kecil ? 3 : 5, kecil ? 1.5 : 2, 0.95);
    this.scene.time.delayedCall(140, () => this.ring(x, y, kecil ? 2.5 : 4, 1.5, 0.7));
    const d = kedalaman(y) + 3;
    for (let i = 0; i < (kecil ? 5 : 8); i++) {
      const besar = !kecil && i < 3;
      const tetes = this.scene.add
        .rectangle(x, y - 1, besar ? 2 : 1, besar ? 2 : 1, i % 2 ? 0xffffff : 0xcdefff)
        .setDepth(d);
      const tx = x + Phaser.Math.Between(kecil ? -5 : -9, kecil ? 5 : 9);
      this.scene.tweens.add({
        targets: tetes,
        x: tx,
        y: y - Phaser.Math.Between(kecil ? 4 : 6, kecil ? 8 : 13),
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
