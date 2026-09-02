/*
 * Aset gambar yang tidak diunduh dari mana-mana: digambar di sini, piksel per
 * piksel, lalu ditulis jadi PNG.
 *
 * Kenapa kode, bukan berkas gambar yang tinggal ditaruh? Karena dua aset ini
 * harus cocok dengan angka yang sudah dipakai kode lain — tebal bingkai,
 * ukuran frame, palet dunia — dan angka itu berubah sesekali. Kalau asetnya
 * berupa PNG buatan tangan, tiap perubahan kecil berarti menggambar ulang dan
 * menebak-nebak warnanya. Sebagai kode, satu angka diganti lalu dijalankan
 * lagi.
 *
 * Hasilnya ditulis ke `mapporto/Aset Buatan Sendiri/` supaya berada di tempat
 * yang sama dengan aset pihak ketiga: build-map.mjs menyalin semuanya ke
 * `public/assets/sprites/` lewat satu daftar. Berkas .tsx-nya dibuat sekalian
 * supaya keduanya bisa dibuka di Tiled seperti tileset yang lain.
 *
 *   node tools/aset-buatan.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_DIR = path.join(ROOT, 'mapporto');
const OUT_DIR = path.join(SRC_DIR, 'Aset Buatan Sendiri');

/* ------------------------------------------------------------------ kanvas */

/** Kanvas RGBA sederhana. Semua koordinat piksel, tanpa antialias. */
class Kanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4); // alpha 0 = kosong
  }

  set(x, y, warna) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !warna) return;
    const i = (y * this.w + x) * 4;
    this.buf[i] = warna[0];
    this.buf[i + 1] = warna[1];
    this.buf[i + 2] = warna[2];
    this.buf[i + 3] = warna[3] ?? 255;
  }

  ada(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.buf[(y * this.w + x) * 4 + 3] > 0;
  }

  async simpan(berkas) {
    const png = await sharp(this.buf, { raw: { width: this.w, height: this.h, channels: 4 } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    await writeFile(berkas, png);
    return png.length;
  }
}

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  255,
];

/* ------------------------------------------------------- bingkai minimap */

/**
 * Bingkai minimap: cincin logam berpaku, dibuat sebagai NINE-PATCH.
 *
 * Minimapnya ada dua ukuran (156×132 di desktop, 117×99 di layar sentuh) dan
 * bisa bertambah lagi nanti. Menggambar satu bingkai per ukuran berarti aset
 * baru tiap kali angkanya berubah; nine-patch cukup satu: sudutnya ikut apa
 * adanya, sisinya yang diregangkan. Karena sisi-sisinya cuma gradien rata
 * sepanjang tepi, meregangkannya tidak meninggalkan bekas.
 *
 * Tengahnya sengaja transparan — bingkai ini cincin yang dipasang DI ATAS
 * gambar peta, bukan latar di belakangnya.
 */
const BINGKAI = {
  sisi: 56, // 16 + 24 + 16, kelipatan 8 supaya rapi di grid Tiled
  potong: 16, // lebar sudut nine-patch
  tebal: 10, // tebal cincinnya
  jari: 5, // radius sudut luar
};

/*
 * Paletnya logam yang condong ke hijau-abu, bukan abu-abu biru seperti
 * gadget sci-fi: warnanya harus duduk di atas rumput dan tanah desa ini.
 * Garis luar dan cincin dalamnya memakai tinta yang sama dengan seluruh UI
 * (#1b2416) supaya bingkainya terbaca sebagai bagian dari antarmuka.
 *
 * Satu baris per lapis, dihitung dari tepi luar ke dalam. Ditulis sebagai
 * tabel dan bukan gradien karena yang bikin logam terlihat seperti logam
 * bukan gradasi halus, melainkan bidang rata yang dipatahkan garis tegas:
 * kilau 1 px di tepi luar, pelat yang nyaris rata, lalu tukikan ke parit dan
 * cincin dalam. Pernah dicoba dengan seam terang-gelap di tengah pelat: pada
 * pita selebar 10 px itu bukan lagi terbaca sebagai detail, melainkan sebagai
 * belang — jarak antar garisnya terlalu rapat.
 */
const LAPIS = [
  { terang: '#141b12', gelap: '#141b12' }, // 0 garis luar
  { terang: '#f2f4ec', gelap: '#7e876f' }, // 1 kilau tepi
  { terang: '#dde2d4', gelap: '#98a18a' }, // 2 pelat
  { terang: '#d3dac9', gelap: '#909a7d' }, // 3
  { terang: '#cad2be', gelap: '#8a9477' }, // 4
  { terang: '#c1cab4', gelap: '#848e71' }, // 5
  { terang: '#96a087', gelap: '#6d765e' }, // 6 pelat menukik ke dalam
  { terang: '#4b5443', gelap: '#414a3a' }, // 7 parit
  { terang: '#1b2416', gelap: '#1b2416' }, // 8 cincin dalam
  { terang: '#1b2416', gelap: '#1b2416' }, // 9
].map((l) => ({ terang: rgb(l.terang), gelap: rgb(l.gelap) }));

function gambarBingkai() {
  const { sisi: S, tebal: T, jari: R } = BINGKAI;
  const k = new Kanvas(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dl = x;
      const dr = S - 1 - x;
      const dt = y;
      const db = S - 1 - y;

      // Kedalaman dari tepi luar. Di keempat sudut diukur dari lingkaran,
      // supaya sudutnya tumpul seperti casing sungguhan, bukan siku tajam.
      const cx = dl < R ? R : dr < R ? S - 1 - R : null;
      const cy = dt < R ? R : db < R ? S - 1 - R : null;
      let d;
      if (cx !== null && cy !== null) {
        const r = Math.hypot(x - cx, y - cy);
        if (r > R + 0.5) continue; // di luar lengkung sudut
        d = Math.round(R - r);
      } else {
        d = Math.min(dl, dr, dt, db);
      }
      if (d >= T) continue; // lubang tengah: petanya yang mengisi

      // Cahaya datang dari kiri-atas: separuh kiri-atas terang, separuh
      // kanan-bawah gelap, dengan patahan diagonal di sudut — persis cara
      // kotak berbevel digambar sejak dulu.
      const terang = Math.min(dt, dl) <= Math.min(db, dr);
      const lapis = LAPIS[Math.min(LAPIS.length - 1, d)];
      k.set(x, y, terang ? lapis.terang : lapis.gelap);
    }
  }

  /*
   * Paku di keempat sudut, tepat di tengah lengkung sudutnya. Letaknya
   * bukan hiasan semata: sudut adalah satu-satunya bagian nine-patch yang
   * tidak diregangkan, jadi hanya di situ detail sekecil ini aman.
   */
  const KEPALA = rgb('#f6f8f0');
  const DOME = rgb('#cfd6c5');
  const BAYANG = rgb('#8f9881');
  const CINCIN = rgb('#2a3327');
  const paku = (px, py) => {
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        const r = Math.hypot(x, y);
        let warna = null;
        if (r < 0.9) warna = KEPALA;
        else if (r < 1.8) warna = x + y < 0 ? KEPALA : DOME;
        else if (r < 2.4) warna = x + y < 0 ? DOME : BAYANG;
        else if (r < 3.1) warna = CINCIN;
        if (warna) k.set(px + x, py + y, warna);
      }
    }
  };
  paku(R, R);
  paku(S - 1 - R, R);
  paku(R, S - 1 - R);
  paku(S - 1 - R, S - 1 - R);

  return k;
}

/* ------------------------------------------------------------ kupu-kupu */

/**
 * Kupu-kupu 16×16, 4 frame kepakan × 3 warna.
 *
 * Kepakannya cuma memendekkan bentang sayap: 6 px → 4 → 2 → 4. Itu sudah
 * cukup pada ukuran sebesar ini — begitu digambar 2/3 kali, bentang penuhnya
 * tinggal 7 px di dunia, dan detail yang lebih halus dari itu tidak akan
 * pernah sampai ke mata.
 *
 * Sayapnya digambar sebagai mask dulu, baru diberi garis tepi dengan cara
 * melebarkan mask satu piksel. Itu jauh lebih tahan diutak-atik daripada
 * menuliskan garis tepinya sebagai koordinat: bentuk sayapnya boleh diubah
 * tanpa harus menggambar ulang garisnya.
 */
const KUPU = { sisi: 16, frame: 4, warna: 3 };

/*
 * Baris keempat: bayangan, satu per lebar kepakan.
 *
 * Ikut jadi baris di spritesheet yang sama, bukan berkas sendiri, karena
 * bayangannya harus berganti bentuk seiring sayapnya membuka-menutup —
 * memisahkannya berarti dua berkas yang wajib selalu sinkron.
 */
const BAYANGAN = rgb('#1b2416');

// Baris sayap kanan, diukur dari sumbu badan: [dari, sampai] per baris.
// Yang kiri hasil cermin, jadi bentuknya selalu simetris.
const SAYAP_ATAS = [
  [4, 2, 6],
  [5, 1, 7],
  [6, 1, 7],
  [7, 1, 6],
];
const SAYAP_BAWAH = [
  [8, 1, 5],
  [9, 1, 5],
  [10, 2, 4],
];

const RAGAM = [
  // seperti referensinya: sayap atas merah muda, bawah biru langit
  { garis: '#2a1f33', atas: '#f2789f', bawah: '#56d7e8', titik: '#ffd34d', badan: '#3b2c47' },
  { garis: '#2a1f33', atas: '#b07de8', bawah: '#7fb4ff', titik: '#ffe08a', badan: '#3b2c47' },
  { garis: '#33231a', atas: '#ffb340', bawah: '#ff7a49', titik: '#fff0b0', badan: '#42301f' },
];

function gambarKupu() {
  const { sisi: S, frame: F, warna: W } = KUPU;
  const k = new Kanvas(S * F, S * (W + 1)); // +1 untuk baris bayangan
  // 1, 0.66, 0.33, 0.66 — frame ke-4 mengulang yang kedua supaya kepakannya
  // menutup lingkaran tanpa menggambar bentuk baru
  const rentang = [1, 0.66, 0.33, 0.66];

  for (let baris = 0; baris < W; baris++) {
    const r = RAGAM[baris];
    const garis = rgb(r.garis);
    const atas = rgb(r.atas);
    const bawah = rgb(r.bawah);
    const titik = rgb(r.titik);
    const badan = rgb(r.badan);

    for (let kolom = 0; kolom < F; kolom++) {
      const ox = kolom * S;
      const oy = baris * S;
      const skala = rentang[kolom];
      const sumbu = 7.5; // badan menempati x=7 dan x=8

      /** mask sayap: nilainya warna, null berarti kosong */
      const isi = new Map();
      const taruh = (x, y, warna) => isi.set(`${x},${y}`, warna);

      for (const [bagian, warna] of [
        [SAYAP_ATAS, atas],
        [SAYAP_BAWAH, bawah],
      ]) {
        for (const [y, dari, sampai] of bagian) {
          const a = Math.round(dari * skala);
          const b = Math.round(sampai * skala);
          if (b < a) continue;
          for (let d = a; d <= b; d++) {
            taruh(Math.round(sumbu + d), y, warna);
            taruh(Math.round(sumbu - d), y, warna);
          }
        }
      }

      // bintik terang di sayap atas — hanya muat waktu sayapnya terbuka
      if (skala > 0.5) {
        const d = Math.round(4 * skala);
        taruh(Math.round(sumbu + d), 6, titik);
        taruh(Math.round(sumbu - d), 6, titik);
      }

      // badan: dari pangkal antena sampai ujung perut
      for (let y = 4; y <= 11; y++) {
        taruh(7, y, badan);
        taruh(8, y, badan);
      }
      taruh(7, 3, badan);
      taruh(8, 3, badan);

      // antena, melengkung ke luar dengan ujung berbintik
      for (const [ax, ay, warna] of [
        [6, 2, garis],
        [5, 1, garis],
        [4, 0, titik],
        [9, 2, garis],
        [10, 1, garis],
        [11, 0, titik],
      ]) {
        taruh(ax, ay, warna);
      }

      // garis tepi: satu piksel di sekeliling seluruh bentuk
      const tepi = new Map();
      for (const kunci of isi.keys()) {
        const [x, y] = kunci.split(',').map(Number);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = `${x + dx},${y + dy}`;
          if (!isi.has(n)) tepi.set(n, garis);
        }
      }

      for (const [kunci, warna] of tepi) {
        const [x, y] = kunci.split(',').map(Number);
        k.set(ox + x, oy + y, warna);
      }
      for (const [kunci, warna] of isi) {
        const [x, y] = kunci.split(',').map(Number);
        k.set(ox + x, oy + y, warna);
      }
    }
  }

  // baris bayangan: elips pipih selebar bentang sayap frame itu
  for (let kolom = 0; kolom < F; kolom++) {
    const ox = kolom * S;
    const oy = W * S;
    const rx = Math.max(2, 5.5 * rentang[kolom]);
    for (let y = -2; y <= 2; y++) {
      for (let x = -8; x <= 8; x++) {
        if ((x / rx) ** 2 + (y / 1.5) ** 2 <= 1) k.set(ox + 8 + x, oy + 8 + y, BAYANGAN);
      }
    }
  }

  return k;
}

/* ------------------------------------------------------------------ tsx */

/** Tileset Tiled, formatnya sama persis dengan tileset pihak ketiga di sini. */
function tsx({ nama, berkas, w, h, tile }) {
  const kolom = Math.floor(w / tile);
  const jumlah = kolom * Math.floor(h / tile);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<tileset version="1.10" tiledversion="1.12.1" name="${nama}" tilewidth="${tile}" tileheight="${tile}" tilecount="${jumlah}" columns="${kolom}">\n` +
    ` <image source="Aset Buatan Sendiri/${berkas}" width="${w}" height="${h}"/>\n` +
    '</tileset>\n'
  );
}

/* ----------------------------------------------------------------- main */

const bingkai = gambarBingkai();
const kupu = gambarKupu();

await mkdir(OUT_DIR, { recursive: true });
const a = await bingkai.simpan(path.join(OUT_DIR, 'minimap_frame.png'));
const b = await kupu.simpan(path.join(OUT_DIR, 'kupu_kupu.png'));

await writeFile(
  path.join(SRC_DIR, 'Minimap Frame.tsx'),
  tsx({ nama: 'Minimap Frame', berkas: 'minimap_frame.png', w: bingkai.w, h: bingkai.h, tile: 8 })
);
await writeFile(
  path.join(SRC_DIR, 'Kupu Kupu.tsx'),
  tsx({ nama: 'Kupu Kupu', berkas: 'kupu_kupu.png', w: kupu.w, h: kupu.h, tile: KUPU.sisi })
);

console.log(`minimap_frame.png ${bingkai.w}×${bingkai.h} → ${(a / 1024).toFixed(1)} KB`);
console.log(`kupu_kupu.png     ${kupu.w}×${kupu.h} → ${(b / 1024).toFixed(1)} KB`);
console.log('tsx: Minimap Frame.tsx, Kupu Kupu.tsx');
