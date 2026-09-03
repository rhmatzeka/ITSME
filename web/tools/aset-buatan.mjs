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


/* -------------------------------------------------------------- gurita */

/**
 * Gurita raksasa yang duduk di sungai, tentakelnya menjulur ke dua tepi darat.
 *
 * Ukurannya bukan angka bulat yang dikarang: sungai mendatar di peta ini
 * tepat 3 baris tile (baris 23-25). Guritanya dibuat 5 baris — badannya
 * mengisi ketiga baris air, dan tentakelnya masih punya satu baris penuh di
 * atas dan di bawah untuk memanjat ke rumput. Lebar 7 tile supaya ia terbaca
 * sebagai "besar" di sungai selebar 39 tile, bukan sekadar hewan lain.
 *
 * Digambar sebagai satu gambar utuh, bukan per tile, lalu dipotong grid 16
 * oleh Tiled. Menggambar per tile berarti menyambung-nyambungkan lengkung
 * tentakel di batas tile dengan tangan — dan tiap kali panjang tentakelnya
 * diubah, seluruh sambungannya harus digambar ulang.
 */
const GURITA = {
  lebar: 7 * 16,
  tinggi: 5 * 16,
  /**
   * Jumlah frame ayunan tentakel.
   *
   * Delapan pada 6 fps memberi putaran 1,3 detik — cukup pelan untuk hewan
   * sebesar ini, dan cukup rapat sehingga ayunannya terbaca mengalir, bukan
   * meloncat dari satu pose ke pose berikutnya.
   */
  frame: 8,
  pusat: { x: 56, y: 38 },
  /** Kepala tempat mata, dan gundukan mantel di belakangnya. */
  kepala: { rx: 16, ry: 13 },
  mantel: { dy: -11, rx: 12.5, ry: 11.5 },
};

/*
 * Ungu-magenta: satu-satunya rumpun warna yang belum dipakai dunia ini.
 * Air biru dan rumput hijau mengapit tempat ia berdiri, jadi merah atau
 * jingga akan bertabrakan dengan atap rumah dan jalan tanah di dekatnya,
 * sementara hijau atau biru akan tenggelam ke latarnya sendiri.
 */
const TINTA_GURITA = rgb('#2b1330');
const KULIT = {
  terang: rgb('#d884ca'),
  sedang: rgb('#bd5cb3'),
  dasar: rgb('#a8459f'),
  gelap: rgb('#762c73'),
  sedot: rgb('#f4bfe0'),
};
const MATA = { putih: rgb('#f7f2e8'), biji: rgb('#241326'), kilau: rgb('#ffffff') };

/**
 * Delapan tentakel, masing-masing satu kurva Bézier kuadratik:
 * [ujung, titik kendali, tebal pangkal].
 *
 * Ujungnya ditulis sebagai koordinat, bukan "sudut sekian sepanjang sekian".
 * Alasannya justru permintaan aslinya: tentakelnya harus SAMPAI ke darat.
 * Pita airnya baris 1-3 (y 16-64), jadi empat tentakel atas wajib berakhir
 * di y < 16 dan empat bawah di y > 64. Dengan sudut-dan-panjang, letak ujung
 * itu hasil sampingan yang harus ditebak ulang tiap kali lengkungnya diubah;
 * sebagai koordinat, ia justru yang dipatok duluan.
 *
 * Titik kendalinya ditaruh melenceng dari garis pangkal-ujung — itulah yang
 * membuat tentakelnya melengkung, bukan menjulur lurus seperti jeruji.
 */
const TENTAKEL = [
  { ujung: [11, 19], kendali: [26, 45], tebal: 6.6 },
  { ujung: [32, 7], kendali: [29, 27], tebal: 6.1 },
  { ujung: [80, 7], kendali: [83, 27], tebal: 6.1 },
  { ujung: [101, 19], kendali: [86, 45], tebal: 6.6 },
  { ujung: [102, 58], kendali: [88, 40], tebal: 6.6 },
  { ujung: [77, 73], kendali: [81, 54], tebal: 6.1 },
  { ujung: [35, 73], kendali: [31, 54], tebal: 6.1 },
  { ujung: [10, 58], kendali: [24, 40], tebal: 6.6 },
];

/**
 * Satu frame gurita ke dalam kanvas `k`, digeser `oy` piksel ke bawah.
 *
 * `fase` 0..2pi memutar ayunan tentakelnya. Ujung DAN titik kendali bergeser
 * ke arah berlawanan, bukan searah: kalau keduanya digeser bersamaan
 * tentakelnya cuma pindah tempat seperti jarum jam, sedangkan berlawanan
 * membuatnya berkelok — yang memang bagaimana tentakel bergerak.
 *
 * Tiap tentakel dapat pergeseran fase sendiri, jadi kedelapannya tidak
 * pernah mengayun serempak.
 */
function gambarFrameGurita(k, oy, fase) {
  const { lebar: W, tinggi: H, pusat: pusatAsli, kepala, mantel } = GURITA;
  // badannya ikut naik-turun sedikit, seperti benda yang mengambang
  const P = { x: pusatAsli.x, y: pusatAsli.y + Math.round(Math.sin(fase) * 1.5) };

  const isi = new Set();
  const taruh = (x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) isi.add(`${x},${y}`);
  };
  const gambar = (x, y, warna) => k.set(x, y + oy, warna);
  const cakram = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) taruh(x, y);
      }
    }
  };
  const bulat = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) taruh(x, y);
      }
    }
  };

  // tentakel dulu, badan digambar di atasnya: pangkalnya jadi tertutup rapi
  const sedot = [];
  TENTAKEL.forEach((t, i) => {
    const { tebal } = t;
    // tiap tentakel mengayun pada fasenya sendiri
    const f = fase + (i * Math.PI * 2 * 1.3) / TENTAKEL.length;
    const ujung = [t.ujung[0] + Math.cos(f) * 4.5, t.ujung[1] + Math.sin(f) * 3.6];
    const kendali = [t.kendali[0] - Math.cos(f) * 3.2, t.kendali[1] - Math.sin(f) * 2.6];
    // pangkal ditarik ke dalam badan supaya sambungannya menyatu
    const arah = Math.atan2(kendali[1] - P.y, kendali[0] - P.x);
    const p0 = [P.x + Math.cos(arah) * 6, P.y + Math.sin(arah) * 5];
    const langkah = 90;
    for (let n = 0; n <= langkah; n++) {
      const t = n / langkah;
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * kendali[0] + t * t * ujung[0];
      const y = u * u * p0[1] + 2 * u * t * kendali[1] + t * t * ujung[1];
      // meruncing: pangkal setebal `tebal`, ujung setipis satu piksel
      const r = tebal * (1 - t) ** 1.15 + 0.55;
      cakram(x, y, r);
      // mangkuk penyedot sepanjang tentakel, berhenti begitu tidak ada ruang
      if (n % 9 === 4 && r > 2.2 && t < 0.72) sedot.push([Math.round(x), Math.round(y)]);
    }
  });
  /** Badannya dicatat terpisah: hanya ia yang dapat gradasi cahaya. */
  const sebelum = new Set(isi);
  bulat(P.x, P.y + mantel.dy, mantel.rx, mantel.ry);
  bulat(P.x, P.y, kepala.rx, kepala.ry);
  const badan = new Set([...isi].filter((kunci) => {
    const [x, y] = kunci.split(',').map(Number);
    const diKepala = ((x - P.x) / kepala.rx) ** 2 + ((y - P.y) / kepala.ry) ** 2 <= 1;
    const diMantel = ((x - P.x) / mantel.rx) ** 2 + ((y - P.y - mantel.dy) / mantel.ry) ** 2 <= 1;
    return diKepala || diMantel;
  }));
  void sebelum;

  /*
   * Pewarnaan dari bentuk lokalnya sendiri, bukan dari daftar bagian tubuh:
   * piksel yang di ATASNYA kosong menangkap cahaya, yang di BAWAHNYA kosong
   * jatuh ke bayangan, sisanya warna dasar. Satu aturan ini melayani badan
   * yang membulat maupun tentakel yang berkelok — dan tetap benar walau
   * kurvanya nanti diubah.
   */
  for (const kunci of isi) {
    const [x, y] = kunci.split(',').map(Number);
    const atasKosong = !isi.has(`${x},${y - 1}`);
    const bawahKosong = !isi.has(`${x},${y + 1}`);
    let warna = KULIT.dasar;
    if (atasKosong && !bawahKosong) warna = KULIT.terang;
    else if (bawahKosong && !atasKosong) warna = KULIT.gelap;
    // punggung mantel: bidang terang yang lebih lebar, supaya kepalanya
    // terbaca membulat dan tidak rata seperti stiker
    else if (badan.has(kunci)) {
      /*
       * Cahaya jatuh dari kiri-atas: dua lingkaran sepusat di titik cahaya,
       * dipotong siluet badannya sendiri. Dua cara lain sudah dicoba dan
       * keduanya salah dengan cara yang berbeda — lingkaran terang di TENGAH
       * punggung terbaca seperti bola yang ditempel (tepinya melingkar
       * sendiri, tak ada hubungannya dengan bentuk yang disinari), sedangkan
       * pita mendatar meninggalkan garis lurus yang memotong kepala.
       */
      const jarak = Math.hypot(x - (P.x - 5), y - (P.y + mantel.dy - 4));
      if (jarak < 9) warna = KULIT.terang;
      else if (jarak < 16) warna = KULIT.sedang;
      if (y > P.y + 5) warna = KULIT.gelap; // bawah kepala, tempat lengan berkumpul
    }
    gambar(x, y, warna);
  }

  for (const [x, y] of sedot) gambar(x, y, KULIT.sedot);

  // mata: dua bulatan di kepala, biji mata condong ke tengah supaya ia
  // terbaca sedang memandang ke depan, bukan juling
  for (const arah of [-1, 1]) {
    const ex = P.x + arah * 8;
    const ey = P.y + 2;
    // cincin tinta dulu: putih mata yang langsung menempel di kulit ungu
    // kehilangan bentuknya begitu digambar sebesar 3 px
    for (let y = -6; y <= 6; y++) {
      for (let x = -6; x <= 6; x++) {
        if ((x / 4.6) ** 2 + (y / 5.2) ** 2 <= 1) gambar(ex + x, ey + y, TINTA_GURITA);
        if ((x / 3.6) ** 2 + (y / 4.2) ** 2 <= 1) gambar(ex + x, ey + y, MATA.putih);
      }
    }
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        if (x * x + y * y <= 3.6) gambar(ex + x - arah, ey + y, MATA.biji);
      }
    }
    gambar(ex - arah - 1, ey - 1, MATA.kilau);
  }

  // garis tepi: satu piksel di sekeliling seluruh bentuk
  for (const kunci of isi) {
    const [x, y] = kunci.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!isi.has(`${x + dx},${y + dy}`)) gambar(x + dx, y + dy, TINTA_GURITA);
    }
  }
}

/**
 * Lembar animasi: frame-nya ditumpuk ke bawah, bukan berjajar ke samping.
 *
 * Lebarnya jadi tetap 7 tile, jadi tiap frame masih satu blok 7x5 yang utuh
 * di grid Tiled — kalau nanti mau menempel pose diamnya sebagai tile biasa,
 * blok paling atas tinggal diambil apa adanya.
 */
function gambarGurita() {
  const { lebar: W, tinggi: H, frame: F } = GURITA;
  const k = new Kanvas(W, H * F);
  for (let f = 0; f < F; f++) gambarFrameGurita(k, f * H, (f / F) * Math.PI * 2);
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
const gurita = gambarGurita();

await mkdir(OUT_DIR, { recursive: true });
const a = await bingkai.simpan(path.join(OUT_DIR, 'minimap_frame.png'));
const b = await kupu.simpan(path.join(OUT_DIR, 'kupu_kupu.png'));
const c = await gurita.simpan(path.join(OUT_DIR, 'gurita.png'));

await writeFile(
  path.join(SRC_DIR, 'Minimap Frame.tsx'),
  tsx({ nama: 'Minimap Frame', berkas: 'minimap_frame.png', w: bingkai.w, h: bingkai.h, tile: 8 })
);
await writeFile(
  path.join(SRC_DIR, 'Kupu Kupu.tsx'),
  tsx({ nama: 'Kupu Kupu', berkas: 'kupu_kupu.png', w: kupu.w, h: kupu.h, tile: KUPU.sisi })
);

console.log(`minimap_frame.png ${bingkai.w}×${bingkai.h} → ${(a / 1024).toFixed(1)} KB`);
await writeFile(
  path.join(SRC_DIR, 'Gurita.tsx'),
  tsx({ nama: 'Gurita', berkas: 'gurita.png', w: gurita.w, h: gurita.h, tile: 16 })
);

console.log(`kupu_kupu.png     ${kupu.w}×${kupu.h} → ${(b / 1024).toFixed(1)} KB`);
console.log(`gurita.png        ${gurita.w}×${gurita.h} → ${(c / 1024).toFixed(1)} KB`);
console.log('tsx: Minimap Frame.tsx, Kupu Kupu.tsx, Gurita.tsx');
