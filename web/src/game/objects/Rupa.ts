import Phaser from 'phaser';
import { spritesheetTeks } from './piksel';

/**
 * Rupa warga: satu sprite dasar (blonde_man.png), banyak orang.
 *
 * Dulu tiap warga cuma hasil tukar warna dari karakter utama — siluet,
 * potongan rambut, dan bajunya identik, jadi seisi desa terlihat seperti
 * saudara kembar yang ganti baju. Di sini tiap orang bisa diberi benda yang
 * MENGUBAH SILUETNYA: topi berpet, tas punggung, kacamata, caping.
 *
 * Bendanya tidak ditempel di koordinat tetap, melainkan dicari per frame
 * dari warna aslinya: baris teratas rambut, kolom mata, lebar baju. Kepala
 * yang naik-turun saat berjalan, atau petani yang membungkuk, tetap
 * memakai topinya di tempat yang benar tanpa daftar koordinat per frame.
 */

type Arah = 'down' | 'left' | 'right' | 'up';
const URUT_ARAH: Arah[] = ['down', 'left', 'right', 'up'];

/** Warna di blonde_man.png. */
const ASLI = {
  rambut: ['#f79617', '#fb6b1d', '#f9c22b'],
  baju: ['#e83b3b', '#ae2334', '#ffffff'],
  mata: '#2e222f',
  tinta: '#45293f',
};

export interface Rupa {
  /** Warna asli → warna baru, diterapkan paling akhir. */
  tukar?: Record<string, string>;
  /** Warna rambut di gambar SUMBER, kalau sumbernya sudah ditukar warnanya. */
  rambut?: string[];
  /** Arah hadap semua frame, untuk lembar tanpa baris arah (petani). */
  arah?: Arah;
  topi?: [string, string];
  tas?: [string, string];
  kacamata?: string;
  caping?: boolean;
}

/** Akses piksel satu frame di dalam ImageData satu lembar. */
class Frame {
  constructor(
    private d: Uint8ClampedArray,
    private W: number,
    private ox: number,
    private oy: number,
    readonly w: number,
    readonly h: number
  ) {}

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = ((this.oy + y) * this.W + this.ox + x) * 4;
    if (!this.d[i + 3]) return null;
    return '#' + [this.d[i], this.d[i + 1], this.d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  set(x: number, y: number, warna: string | null) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = ((this.oy + y) * this.W + this.ox + x) * 4;
    if (!warna) {
      this.d[i + 3] = 0;
      return;
    }
    const n = parseInt(warna.slice(1), 16);
    this.d[i] = (n >> 16) & 255;
    this.d[i + 1] = (n >> 8) & 255;
    this.d[i + 2] = n & 255;
    this.d[i + 3] = 255;
  }

  cari(warna: string[]) {
    const hasil: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (warna.includes(this.get(x, y) ?? '')) hasil.push([x, y]);
    return hasil;
  }

  /** Garis tinta di sekeliling piksel baru, hanya di tempat yang masih kosong. */
  garisi(baru: [number, number][], tinta = ASLI.tinta) {
    const isi = new Set(baru.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of baru) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isi.has(`${nx},${ny}`) && !this.get(nx, ny)) this.set(nx, ny, tinta);
      }
    }
  }
}

/* ---------------- benda pakai ---------------- */

/** Topi berpet: empat baris teratas rambut jadi topi, petnya menjorok ke depan. */
function pakaiTopi(f: Frame, arah: Arah, rambut: [number, number][], [warna, gelap]: [string, string]) {
  const t = Math.min(...rambut.map(([, y]) => y));
  const pet = t + 4;
  for (const [x, y] of rambut) {
    if (y < pet) f.set(x, y, y === t ? warna : y === pet - 1 ? gelap : warna);
    else if (y === pet && (arah === 'down' || arah === 'up')) f.set(x, y, gelap);
  }
  if (arah === 'left' || arah === 'right') {
    const baris = rambut.filter(([, y]) => y === pet - 1).map(([x]) => x);
    if (!baris.length) return;
    const ujung = arah === 'left' ? Math.min(...baris) - 1 : Math.max(...baris) + 1;
    const langkah = arah === 'left' ? -1 : 1;
    const baru: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const x = ujung + i * langkah;
      f.set(x, pet - 1, gelap);
      baru.push([x, pet - 1]);
    }
    f.garisi(baru);
  }
}

/**
 * Caping petani: kerucut anyaman yang DUDUK di kepala, bukan melayang di
 * atasnya. Versi pertama puncaknya tiga baris di atas rambut dan tepinya
 * tiga piksel lebih lebar dari kepala di tiap sisi, sementara rambut di
 * bawahnya dibiarkan utuh — terbaca seperti tempelan. Sekarang rambut dan
 * garis tepinya di bawah caping dihapus (kepalanya masuk ke dalam), tepinya
 * jatuh setinggi dahi, dan petnya membayangi wajah satu baris.
 */
function pakaiCaping(f: Frame, rambut: [number, number][], warnaRambut: string[]) {
  const t = Math.min(...rambut.map(([, y]) => y));
  const xs = rambut.map(([x]) => x);
  const c = (Math.min(...xs) + Math.max(...xs)) / 2;
  const lebar = (Math.max(...xs) - Math.min(...xs)) / 2 + 2;
  const puncak = t - 2;
  const pinggir = t + 4;
  for (let y = 0; y < pinggir; y++) {
    for (let x = 0; x < f.w; x++) {
      const w = f.get(x, y);
      if (w && (warnaRambut.includes(w) || (w === ASLI.tinta && y < t + 3))) f.set(x, y, null);
    }
  }
  const baru: [number, number][] = [];
  for (let y = puncak; y <= pinggir; y++) {
    const setengah = Math.round(0.5 + ((y - puncak + 0.5) / (pinggir - puncak)) * lebar);
    for (let x = Math.round(c - setengah); x <= Math.round(c + setengah); x++) {
      let w = '#e8c878';
      if (y === pinggir) w = '#b8904a';
      else if (y === pinggir - 1) w = '#d4b061';
      else if ((x - Math.round(c)) * 2 < -(y - puncak)) w = '#f6e0a0'; // sisi kiri kena cahaya
      else if ((x + y) % 4 === 0) w = '#d4b061'; // anyaman
      f.set(x, y, w);
      baru.push([x, y]);
    }
  }
  f.garisi(baru, '#5a3a1a');
  // bayangan pet di dahi
  for (let x = 0; x < f.w; x++) {
    const w = f.get(x, pinggir + 1);
    if (w && w !== ASLI.tinta && !warnaRambut.includes(w)) f.set(x, pinggir + 1, gelapkan(w, 0.2));
  }
}

function gelapkan(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.round(v * (1 - t)).toString(16).padStart(2, '0');
  return `#${k(n >> 16)}${k((n >> 8) & 255)}${k(n & 255)}`;
}

/** Tas punggung: menutup punggung dari belakang, tampak tali dari depan, menonjol dari samping. */
function pakaiTas(f: Frame, arah: Arah, [warna, gelap]: [string, string]) {
  const baju = f.cari(ASLI.baju);
  if (!baju.length) return;
  const ys = baju.map(([, y]) => y);
  const xs = baju.map(([x]) => x);
  const [r0, r1] = [Math.min(...ys), Math.max(...ys)];
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  if (arah === 'up') {
    for (const [x, y] of baju) {
      if (y <= r0) continue;
      const saku = y >= r1 - 1 && Math.abs(x - (x0 + x1) / 2) <= 1.5;
      f.set(x, y, y === r0 + 1 || saku ? gelap : warna);
    }
  } else if (arah === 'down') {
    for (const [x, y] of baju) if (x === x0 + 1 || x === x1 - 1) f.set(x, y, gelap);
  } else {
    // dari samping: tasnya menonjol di sisi punggung
    const langkah = arah === 'left' ? 1 : -1;
    const baru: [number, number][] = [];
    for (let y = r0 - 1; y <= r1; y++) {
      // tepi punggung: piksel terisi paling kanan (hadap kiri) atau paling kiri
      let tepi = -1;
      for (let x = 0; x < f.w; x++) {
        if (f.get(x, y) && (arah === 'left' || tepi === -1)) tepi = x;
      }
      if (tepi < 0) continue;
      for (let i = 0; i < 3; i++) {
        const x = tepi + i * langkah;
        f.set(x, y, i === 2 || y === r0 - 1 ? gelap : warna);
        baru.push([x, y]);
      }
    }
    f.garisi(baru);
  }
}

/** Kacamata: bingkai tipis di atas dan di kedua sisi tiap mata. */
function pakaiKacamata(f: Frame, arah: Arah, warna: string) {
  if (arah === 'up') return;
  const mata = f.cari([ASLI.mata]);
  const kolom = [...new Set(mata.map(([x]) => x))];
  for (const ex of kolom) {
    const ey = Math.min(...mata.filter(([x]) => x === ex).map(([, y]) => y));
    // cuma bingkai atas dan sisi setinggi satu baris: bingkai penuh di
    // wajah selebar 8 piksel terbaca sebagai topeng, bukan kacamata
    for (const [x, y] of [
      [ex - 1, ey - 1],
      [ex, ey - 1],
      [ex + 1, ey - 1],
      [ex - 1, ey],
      [ex + 1, ey],
    ]) {
      if (f.get(x, y) && f.get(x, y) !== ASLI.tinta) f.set(x, y, warna);
    }
  }
}

/* ---------------- membuat lembar ---------------- */

/**
 * Lembar baru `key` dari lembar `sumber` (frame 32×32), dengan benda pakai
 * lalu tukar warna. Frame-frame-nya didaftarkan dengan nomor yang sama
 * seperti sumbernya, jadi animasi dan arah hadapnya tetap berlaku.
 */
export function buatRupa(scene: Phaser.Scene, sumber: string, key: string, rupa: Rupa, S = 32, T = S) {
  const tx = scene.textures;
  if (tx.exists(key) || !tx.exists(sumber)) return;
  const img = tx.get(sumber).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const kanvas = tx.createCanvas(key, img.width, img.height)!;
  const ctx = kanvas.getContext();
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const kolom = Math.floor(img.width / S);
  const baris = Math.floor(img.height / T);
  const tukar = new Map(Object.entries(rupa.tukar ?? {}).map(([a, b]) => [a.toLowerCase(), b]));

  for (let n = 0; n < kolom * baris; n++) {
    const f = new Frame(data.data, img.width, (n % kolom) * S, Math.floor(n / kolom) * T, S, T);
    const arah = rupa.arah ?? URUT_ARAH[Math.floor(n / kolom) % 4];
    const rambut = f.cari(rupa.rambut ?? ASLI.rambut);
    if (rambut.length) {
      // tas dulu: ia membaca baju ASLI, sebelum topi/kacamata menimpa apa pun
      if (rupa.tas) pakaiTas(f, arah, rupa.tas);
      if (rupa.kacamata) pakaiKacamata(f, arah, rupa.kacamata);
      if (rupa.topi) pakaiTopi(f, arah, rambut, rupa.topi);
      if (rupa.caping) pakaiCaping(f, rambut, rupa.rambut ?? ASLI.rambut);
    }
    if (tukar.size) {
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < S; x++) {
          const w = f.get(x, y);
          const ganti = w && tukar.get(w);
          if (ganti) f.set(x, y, ganti);
        }
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  for (let n = 0; n < kolom * baris; n++) kanvas.add(n, 0, (n % kolom) * S, Math.floor(n / kolom) * T, S, T);
  kanvas.refresh();
}

/* ---------------- Rahmat ---------------- */

/**
 * Karakter utama: rambut hitam, kulit sawo matang, jaket merah di atas kaos
 * putih, celana gelap. Aslinya pirang-jingga berkulit terang — bukan orang
 * yang punya portfolio ini.
 */
export const TUKAR_RAHMAT: Record<string, string> = {
  '#f79617': '#2d2a33', // rambut
  '#fb6b1d': '#1b1920',
  '#f9c22b': '#4d4857',
  '#fdcbb0': '#c68b5e', // kulit sawo matang
  '#fca790': '#a46d45',
  '#e83b3b': '#e23b3b', // jaket merah
  '#ae2334': '#a82232',
  '#ffffff': '#f7f5ee', // kaos putih
  '#cd683d': '#3b3d48', // celana gelap
  '#9e4539': '#262831',
};
const KULIT = TUKAR_RAHMAT['#fdcbb0'];
const KULIT_GELAP = TUKAR_RAHMAT['#fca790'];
const JAKET = TUKAR_RAHMAT['#e83b3b'];
const MATA = ASLI.mata;
const TINTA = ASLI.tinta;

/**
 * Lembar Rahmat, ikon kepalanya di minimap, dan dua pose santai: main HP
 * dan tidur. Aman dipanggil berkali-kali.
 */
export function siapkanRahmat(scene: Phaser.Scene) {
  buatRupa(scene, 'player', 'rahmat', { tukar: TUKAR_RAHMAT });
  const tx = scene.textures;
  if (tx.exists('kepala') && !tx.exists('kepala_rahmat')) {
    const k = tx.get('kepala').getSourceImage() as HTMLImageElement;
    buatRupa(scene, 'kepala', 'kepala_rahmat', { tukar: TUKAR_RAHMAT }, k.width, k.height);
  }
  if (tx.exists('rahmat') && !tx.exists('rahmat_hp')) buatPoseSantai(scene);
  if (tx.exists('player_shadow') && !tx.exists('rahmat_shadow')) {
    const b = tx.get('player_shadow').getSourceImage() as HTMLImageElement;
    const k = tx.createCanvas('rahmat_shadow', b.width, b.height)!;
    k.getContext().drawImage(b, 0, 0);
    for (let n = 0; n < (b.width / 32) * (b.height / 32); n++) k.add(n, 0, (n % 4) * 32, Math.floor(n / 4) * 32, 32, 32);
    k.refresh();
  }
  spritesheetTeks(
    scene,
    'zz',
    [['.ooooo.', 'owwwwwo', '.ooowo.', '..owo..', '.owooo.', 'owwwwwo', '.ooooo.']],
    { o: '#1b2416', w: '#f4fbff' }
  );
}

/**
 * Pose santai dari frame diam-menghadap-bawah. Koordinat dibaca dari
 * blonde_man.png: kepala baris 13-23 (mata x 14 dan 17, baris 21-22),
 * kerah baris 24, tangan menggantung x 9-11 dan 20-22 baris 25-27.
 *
 * `rahmat_hp`: 0 HP baru dikeluarkan di tangan kanan; 1-2 kepala menunduk,
 * kedua tangan memegang HP di depan perut, layar berkedip dan jempol
 * mengetuk bergantian.
 *
 * `rahmat_tidur`: 0 menguap (mata terpejam, mulut terbuka), 1 duduk
 * bersila, 2-3 berbaring di alas tidur — kepala di atas bantal menghadap
 * ke atas, selimut dari dagu sampai kaki; yang bergerak cuma mulutnya
 * (selimut yang naik-turun satu baris penuh terlihat berkedut, bukan
 * bernapas). 4 menggeliat dengan kedua tangan terangkat, untuk bangun.
 * Versi pertamanya satu frame: sprite berdiri yang diputar 90° di samping
 * kotak putih, tanpa peralihan — terbaca seperti karakter yang jatuh.
 */
function buatPoseSantai(scene: Phaser.Scene) {
  const tx = scene.textures;
  const src = tx.get('rahmat').getSourceImage() as HTMLCanvasElement;
  const S = 32;
  const HITAM = '#1b1920';

  /** Kanvas kerja satu frame, diisi frame diam-menghadap-bawah. */
  const baru = (isi = true) => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    c.canvas.width = S;
    c.canvas.height = S;
    if (isi) c.drawImage(src, 0, 0, S, S, 0, 0, S, S);
    const d = c.getImageData(0, 0, S, S);
    return { d, f: new Frame(d.data, S, 0, 0, S, S) };
  };
  const dasar = baru().f;
  const lembar = (key: string, frames: ImageData[]) => {
    const k = tx.createCanvas(key, S * frames.length, S)!;
    frames.forEach((d, i) => {
      k.getContext().putImageData(d, i * S, 0);
      k.add(i, 0, i * S, 0, S, S);
    });
    k.refresh();
  };

  // ---- main HP ----
  const ambil = baru();
  for (let y = 25; y <= 28; y++) for (let x = 21; x <= 23; x++) ambil.f.set(x, y, y === 25 || y === 28 || x === 23 ? HITAM : '#8fe3ff');
  ambil.f.set(21, 26, KULIT);
  const mainHp = (layar: string, jempol: number) => {
    const { d, f } = baru();
    // kepala menunduk: seluruh kepala turun satu piksel ke kerah
    for (let y = 23; y >= 13; y--) for (let x = 8; x <= 23; x++) f.set(x, y + 1, dasar.get(x, y));
    for (let x = 8; x <= 23; x++) f.set(x, 13, null);
    // mata menatap ke bawah: tinggal separuh bawahnya
    for (const x of [14, 17]) {
      f.set(x, 22, KULIT);
      f.set(x, 23, MATA);
    }
    // lengan menekuk ke depan
    for (const y of [26, 27]) {
      f.set(9, y, null);
      f.set(22, y, null);
      f.set(10, y, TINTA);
      f.set(21, y, TINTA);
    }
    f.set(11, 26, KULIT);
    f.set(11, 27, KULIT_GELAP);
    f.set(20, 26, KULIT);
    f.set(20, 27, KULIT_GELAP);
    f.set(12, 27, KULIT);
    f.set(19, 27, KULIT);
    // HP di depan perut, layarnya memantul terang
    for (let y = 25; y <= 28; y++) {
      for (let x = 13; x <= 18; x++) f.set(x, y, y === 25 || y === 28 || x === 13 || x === 18 ? HITAM : '#3a3a48');
    }
    for (let y = 26; y <= 27; y++) for (let x = 14; x <= 17; x++) f.set(x, y, layar);
    f.set(14, 26, '#ffffff');
    f.set(13, 27, KULIT);
    f.set(18, 27, KULIT);
    f.set(jempol, 28, KULIT);
    return d;
  };
  lembar('rahmat_hp', [ambil.d, mainHp('#8fe3ff', 15), mainHp('#c4f2ff', 16)]);

  // ---- tidur ----
  const uap = baru();
  for (const x of [14, 17]) uap.f.set(x, 21, KULIT);
  uap.f.set(15, 23, '#5a2a2a');
  uap.f.set(16, 23, '#5a2a2a');

  const duduk = baru(false);
  for (let y = 13; y <= 27; y++) for (let x = 0; x < S; x++) duduk.f.set(x, y + 3, dasar.get(x, y));
  for (const x of [14, 17]) {
    duduk.f.set(x, 24, KULIT); // setengah terpejam
    duduk.f.set(x, 25, MATA);
  }
  // kaki bersila melebar ke samping
  for (let x = 9; x <= 22; x++) duduk.f.set(x, 31, TINTA);
  for (let x = 10; x <= 21; x++) duduk.f.set(x, 30, x < 13 || x > 18 ? '#3b3d48' : '#262831');
  duduk.f.set(9, 30, TINTA);
  duduk.f.set(22, 30, TINTA);

  const baring = (mangap: boolean) => {
    const { d, f } = baru(false);
    const bantal: [number, number][] = [];
    for (let y = 9; y <= 20; y++) {
      for (let x = 7; x <= 24; x++) {
        const dx = (x - 15.5) / 9;
        const dy = (y - 14.5) / 6;
        if (dx * dx + dy * dy <= 1) {
          f.set(x, y, y >= 18 ? '#d9d4c8' : '#f4f1ea');
          bantal.push([x, y]);
        }
      }
    }
    f.garisi(bantal, '#8a8494');
    for (let y = 13; y <= 23; y++) for (let x = 8; x <= 23; x++) if (dasar.get(x, y)) f.set(x, y - 2, dasar.get(x, y));
    for (const x of [14, 17]) {
      f.set(x, 19, KULIT);
      f.set(x, 20, MATA);
    }
    f.set(15, 21, mangap ? '#5a2a2a' : '#8a5a40');
    if (mangap) f.set(16, 21, '#5a2a2a');
    // selimut kotak-kotak dari bawah dagu ke kaki; pinggir atasnya kain putih terlipat
    const atas = 23;
    const kain: [number, number][] = [];
    for (let y = atas; y <= 30; y++) {
      for (let x = 7; x <= 24; x++) {
        if (y === 30 && (x === 7 || x === 24)) continue;
        let w = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? '#4a78c8' : '#5f8fe0';
        if (y === atas) w = '#f4f1ea';
        if (y === atas + 1) w = '#d9d4c8';
        f.set(x, y, w);
        kain.push([x, y]);
      }
    }
    f.garisi(kain, '#2a3a66');
    return d;
  };
  // menggeliat: tangan yang menggantung diangkat ke kedua sisi kepala
  const geliat = baru();
  for (const y of [25, 26, 27]) {
    for (const x of [9, 10, 11, 20, 21, 22]) geliat.f.set(x, y, null);
    geliat.f.set(11, y, TINTA);
    geliat.f.set(20, y, TINTA);
  }
  const lengan: [number, number][] = [];
  for (const [x, y] of [
    [10, 24], [9, 23], [9, 22], [8, 21], [8, 20], [8, 19], [8, 18], [7, 17], [7, 16], [7, 15], [6, 14], [7, 14], [6, 13], [7, 13],
  ]) {
    for (const xx of [x, S - 1 - x]) {
      const w = geliat.f.get(xx, y);
      if (!w || w === TINTA) {
        geliat.f.set(xx, y, y > 22 ? KULIT_GELAP : KULIT);
        lengan.push([xx, y]);
      }
    }
  }
  geliat.f.garisi(lengan);
  for (const x of [14, 17]) geliat.f.set(x, 21, KULIT);
  geliat.f.set(15, 23, '#5a2a2a');
  geliat.f.set(16, 23, '#5a2a2a');

  lembar('rahmat_tidur', [uap.d, duduk.d, baring(false), baring(true), geliat.d]);

  const anim = (key: string, tekstur: string, frames: number[], rate: number, repeat: number) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((frame) => ({ key: tekstur, frame })), frameRate: rate, repeat });
  };
  anim('rahmat_ambil_hp', 'rahmat_hp', [0, 0], 4, 0);
  anim('rahmat_hp', 'rahmat_hp', [1, 2], 3, -1);
  anim('rahmat_rebah', 'rahmat_tidur', [0, 0, 0, 1, 1], 4, 0);
  anim('rahmat_tidur', 'rahmat_tidur', [2, 2, 3], 1.2, -1);
  // bangun: duduk dulu, lalu menggeliat; dari main HP: HP disimpan dulu
  anim('rahmat_bangun', 'rahmat_tidur', [1, 1, 4, 4, 4, 4], 6, 0);
  anim('rahmat_simpan_hp', 'rahmat_hp', [0], 6, 0);
}

/* ---------------- warga lain ---------------- */

/** Rupa tiap warga. Semua turunan blonde_man.png, tapi tidak ada yang kembar. */
export function siapkanWargaBaru(scene: Phaser.Scene) {
  // kurir: topi merah, kaos putih bergambar, tas punggung biru
  buatRupa(scene, 'player', 'kurir', {
    topi: ['#e0463a', '#a8302a'],
    tas: ['#3f7fd6', '#2a5aa0'],
    tukar: {
      '#f79617': '#6b4226',
      '#fb6b1d': '#4a2c18',
      '#f9c22b': '#8a5a36',
      '#fdcbb0': '#f2c29a',
      '#fca790': '#d9a079',
      '#e83b3b': '#f4f1ea',
      '#ae2334': '#cfc9bd',
      '#ffffff': '#f2b233',
      '#cd683d': '#7a4a2a',
      '#9e4539': '#553220',
    },
  });
  // pedagang: rambut hitam, kemeja biru, celemek krem, berkacamata
  buatRupa(scene, 'player', 'pedagang', {
    kacamata: '#6b3f2a',
    tukar: {
      '#f79617': '#3a2a2a',
      '#fb6b1d': '#241a1a',
      '#f9c22b': '#5a4540',
      '#fdcbb0': '#e8b48a',
      '#fca790': '#c98f6a',
      '#e83b3b': '#3b7dd8',
      '#ae2334': '#2a5aa0',
      '#ffffff': '#f2efe6',
      '#cd683d': '#4b3f36',
      '#9e4539': '#332a24',
    },
  });
  // remaja: rambut merah, kaos kuning, celana biru tua, tas punggung hijau
  buatRupa(scene, 'player', 'remaja', {
    tas: ['#2f8a5a', '#1f6440'],
    tukar: {
      '#f79617': '#c2452d',
      '#fb6b1d': '#8f2f1f',
      '#f9c22b': '#e0643f',
      '#fdcbb0': '#f7c9a4',
      '#fca790': '#e0a57f',
      '#e83b3b': '#f2b233',
      '#ae2334': '#c98a1c',
      '#ffffff': '#f7d77a',
      '#cd683d': '#2b3a6b',
      '#9e4539': '#1d284d',
    },
  });
  // petani: caping di atas rambut cokelatnya (lembarnya sudah ditukar warna)
  buatRupa(scene, 'petani', 'petani_caping', { caping: true, arah: 'down', rambut: ['#8a5a2f', '#633d1f', '#a97a44'] });
}
