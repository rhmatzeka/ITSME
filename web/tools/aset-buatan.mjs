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

  hapus(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
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

/*
 * Tiga jenis kupu-kupu, digambar tangan per piksel.
 *
 * Dua versi sebelumnya dibuat dari rumus (balok baris, lalu elips) dan
 * keduanya jatuh ke masalah yang sama: di kanvas 16 piksel sayapnya mengisi
 * kotak penuh, tanpa lekuk di antara sayap atas dan bawah — dari jauh
 * terbaca sebagai kumbang. Siluet kupu-kupu justru ditentukan oleh detail
 * yang tidak tertangkap rumus: ujung sayap atas yang meruncing ke pojok,
 * lekuk tajam sebelum sayap bawah, dan sayap bawah yang lebih kecil.
 *
 * Hanya setengah kiri yang ditulis (kolom 0-7, kolom 7 = badan); setengah
 * kanan cermin. Huruf: k garis, e tepi sayap, a sayap atas, A sayap atas
 * terang, s bintik, b sayap bawah, B sayap bawah terang, t badan, n ujung
 * antena.
 */
const POSE_KUPU = {
  buka: [
    '....n...',
    '.kk..k..',
    'keekk.kt',
    'keaaaAkt',
    'keasaAAt',
    '.keaaAAt',
    '..keeaAt',
    '...kkbBt',
    '..kbbbBt',
    '.kebbbBt',
    '.kebbbkt',
    '..keek.t',
    '...kk..k',
  ],
  setengah: [
    '....n...',
    '.....k..',
    '..kk..kt',
    '.keeakkt',
    '.keasaAt',
    '..keaaAt',
    '...keeAt',
    '....kbBt',
    '...kbbBt',
    '..kebbBt',
    '..kebbkt',
    '...keekt',
    '....kk.k',
  ],
  tutup: [
    '....n...',
    '.....k..',
    '......kt',
    '.....kat',
    '.....keA',
    '.....keA',
    '.....keA',
    '.....kbB',
    '.....kbB',
    '.....keB',
    '.....keB',
    '......kt',
    '.......k',
  ],
};

const RAGAM = [
  // raja (monarch): oranye bertepi cokelat tua
  { k: '#241a2e', e: '#4a2a14', a: '#f7932a', A: '#ffc76e', s: '#fff6e0', b: '#ef7a1f', B: '#ffb35c', t: '#2e2230', n: '#fff6e0' },
  // morpho: biru terang bertepi biru malam
  { k: '#1c1d33', e: '#1d2b5a', a: '#3aa0ff', A: '#9fdcff', s: '#ffffff', b: '#2f7fe0', B: '#6fb6ff', t: '#23233a', n: '#ffffff' },
  // merah muda dengan sayap bawah ungu
  { k: '#2a1f33', e: '#8a2f63', a: '#f58ab8', A: '#ffd4e6', s: '#fff6a8', b: '#9a5ac8', B: '#d7a6f0', t: '#3b2c47', n: '#fff6a8' },
];

function gambarKupu() {
  const { sisi: S, frame: F, warna: W } = KUPU;
  const k = new Kanvas(S * F, S * (W + 1)); // +1 untuk baris bayangan
  // kepakan: terbuka → setengah → tertutup → setengah
  const urutan = ['buka', 'setengah', 'tutup', 'setengah'];
  const bentang = { buka: 1, setengah: 0.7, tutup: 0.3 };
  const turun = 1; // gambar 13 baris, dipusatkan di kanvas 16

  for (let baris = 0; baris < W; baris++) {
    const pal = Object.fromEntries(Object.entries(RAGAM[baris]).map(([h, c]) => [h, rgb(c)]));
    urutan.forEach((pose, kolom) => {
      const ox = kolom * S;
      const oy = baris * S + turun;
      POSE_KUPU[pose].forEach((setengah, y) => {
        const penuh = setengah + [...setengah].reverse().join('');
        [...penuh].forEach((c, x) => {
          if (c !== '.') k.set(ox + x, oy + y, pal[c]);
        });
      });
    });
  }

  // baris bayangan: elips pipih selebar bentang sayap frame itu
  urutan.forEach((pose, kolom) => {
    const ox = kolom * S;
    const oy = W * S;
    const rx = Math.max(2, 6.5 * bentang[pose]);
    for (let y = -2; y <= 2; y++) {
      for (let x = -8; x <= 8; x++) {
        if ((x / rx) ** 2 + (y / 1.5) ** 2 <= 1) k.set(ox + 8 + x, oy + 8 + y, BAYANGAN);
      }
    }
  });

  return k;
}


/* -------------------------------------------------------------- gurita */

/**
 * Gurita yang muncul dari air di tikungan barat sungai.
 *
 * Versi pertamanya duduk DI ATAS sungai dengan delapan tentakel yang menjulur
 * lurus ke segala arah sampai ke rumput — terbaca sebagai bintang laut atau
 * laba-laba ungu raksasa yang ditempel di peta, bukan hewan yang tinggal di
 * sungai. Bintik penyedot putih di sepanjang tentakel terlihat seperti
 * taburan gula, dan mata bulat melototnya membuat wajahnya kosong.
 *
 * Sekarang ia BERENDAM: kepalanya menyembul dari air dengan riak melingkar
 * di pangkalnya, dan tentakelnya keluar-masuk air di sekitarnya — satu
 * melengkung seperti punuk, dua terangkat dengan ujung menggulung sambil
 * melambai, satu tersampir di tepian depan, satu bersandar di tepian
 * belakang. Yang terlihat cuma sebagian dari delapan; sisanya di bawah air,
 * dan justru itu yang membuatnya terasa tinggal di sana.
 *
 * Ukuran bingkainya tetap 7×5 tile (kode lain memakai angka itu): tikungan
 * tempat sungai tegak bertemu sungai mendatar. Pita air mendatarnya y 25-52
 * dalam bingkai ini, sungai tegaknya x 12-40 di atas pita itu.
 */
const GURITA = {
  lebar: 7 * 16,
  tinggi: 5 * 16,
  /**
   * 16 frame pada 6 fps: tentakelnya mengayun dua kali per putaran (1,3
   * detik sekali ayun, sama seperti dulu), dan sekali per putaran ia
   * berkedip — kedipan tiap 1,3 detik terlalu sering untuk terbaca santai.
   */
  frame: 16,
  /** Garis air di pangkal kepalanya. */
  air: 45,
  kepala: { x: 50, kubah: { cy: 29, rx: 15, ry: 16 }, pipi: { cy: 40, rx: 17, ry: 8 } },
};

/*
 * Ungu-magenta: satu-satunya rumpun warna yang belum dipakai dunia ini.
 * Air biru dan rumput hijau mengapit tempat ia berdiri, jadi merah atau
 * jingga akan bertabrakan dengan atap rumah dan jalan tanah di dekatnya,
 * sementara hijau atau biru akan tenggelam ke latarnya sendiri.
 */
const TINTA_GURITA = rgb('#2b1330');
const KULIT = {
  kilau: rgb('#f1b9e6'),
  terang: rgb('#dc8fd0'),
  sedang: rgb('#c56bba'),
  dasar: rgb('#ad51a5'),
  gelap: rgb('#7c317c'),
  bintik: rgb('#8f3d8c'),
  sedot: rgb('#f6cfe8'),
};
const WAJAH = { mata: rgb('#1f0f22'), kilau: rgb('#ffffff'), pipi: rgb('#f48fb8'), mulut: rgb('#4a1843') };
const BUSA = { putih: rgb('#eaf7fc'), biru: rgb('#a9def5'), bayang: rgb('#1b7ab8') };

/** Kurva Catmull-Rom yang melewati semua titik, dirapatkan jadi titik-titik kecil. */
function jalurHalus(titik, langkah = 16) {
  const hasil = [];
  for (let i = 0; i < titik.length - 1; i++) {
    const p0 = titik[i - 1] ?? titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] ?? titik[i + 1];
    for (let s = 0; s < langkah; s++) {
      const t = s / langkah;
      const k = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      hasil.push([k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  hasil.push(titik[titik.length - 1]);
  return hasil;
}

/**
 * Ujung yang menggulung: jalurnya diteruskan dengan spiral yang mengecil.
 * `arah` 1 = menggulung searah jarum jam dilihat dari arah geraknya, -1
 * sebaliknya. Pusat gulungannya di samping ujung, jadi gulungannya
 * menyambung mulus dari arah terakhir tentakel, tanpa patahan.
 */
function gulung(jalur, arah, besar) {
  const a = jalur[jalur.length - 2];
  const b = jalur[jalur.length - 1];
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const cx = b[0] + Math.cos(th + (arah * Math.PI) / 2) * besar;
  const cy = b[1] + Math.sin(th + (arah * Math.PI) / 2) * besar;
  const mulai = Math.atan2(b[1] - cy, b[0] - cx);
  for (let i = 1; i <= 28; i++) {
    const f = i / 28;
    const s = mulai + arah * f * Math.PI * 1.7;
    const r = besar * (1 - 0.62 * f);
    jalur.push([cx + Math.cos(s) * r, cy + Math.sin(s) * r]);
  }
  return jalur;
}

/**
 * Tentakel yang terlihat, per frame. `fase` memutar ayunannya.
 *
 * Tiap tentakel: titik-titik yang dilewati (dari pangkal di air ke ujung),
 * gulungan ujungnya, tebal pangkal, `klip` = y terbawah yang boleh
 * tergambar (bagian di bawahnya masih di dalam air), `busa` = titik tempat
 * ia keluar dari air, dan `sisi` = ke sisi mana penyedotnya menghadap.
 */
function tentakelGurita(fase) {
  const ayun = (geser) => Math.sin(fase + geser);
  return [
    {
      // bersandar di tepian belakang, di balik kepala
      titik: [[65, 31], [70, 25], [74, 20], [76 + ayun(1.1) * 0.8, 15]],
      gulung: [1, 2.3],
      tebal: 3.1,
      sisi: 1,
      busa: [[67, 33]],
    },
    {
      // terangkat di sungai tegak, ujungnya melambai
      titik: [[23, 47], [19, 36], [20, 26], [25 + ayun(0) * 2.4, 16 + ayun(0.6)]],
      gulung: [1, 3.4],
      tebal: 3.8,
      klip: 47,
      sisi: 1,
      busa: [[23, 47]],
    },
    {
      // punuk di sungai mendatar: keluar, melengkung, masuk lagi
      titik: [[71, 48], [75, 39 + ayun(2) * 0.8], [81, 35 + ayun(2) * 1.2], [87, 39 + ayun(2) * 0.8], [91, 48]],
      tebal: 3.4,
      rata: true,
      klip: 48,
      sisi: 1,
      busa: [[71, 48], [91, 48]],
    },
    {
      // terangkat di kanan, dekat jembatan
      titik: [[103, 47], [106, 38], [106, 30], [102 + ayun(3.4) * 2.2, 23 + ayun(4) * 0.8]],
      gulung: [-1, 3],
      tebal: 3.6,
      klip: 47,
      sisi: -1,
      busa: [[102, 47]],
    },
    {
      // ujung kecil yang menyembul di depan
      titik: [[63, 51], [65, 45], [62 + ayun(5) * 0.7, 41 + ayun(5) * 0.6]],
      gulung: [-1, 2],
      tebal: 2.4,
      klip: 51,
      sisi: -1,
      busa: [[63, 51]],
    },
    {
      // tersampir di tepian depan, ujungnya menggulung di rumput
      titik: [[39, 48], [34, 55], [28, 61], [27 + ayun(1.8) * 0.8, 67]],
      gulung: [-1, 2.9],
      tebal: 3.6,
      sisi: 1,
      busa: [[39, 49]],
    },
  ];
}

/**
 * Satu frame gurita ke dalam kanvas `k`, digeser `oy` piksel ke bawah.
 *
 * Badannya DIAM. Sempat dibuat ikut naik-turun 1,5 px seperti benda yang
 * mengambang, dan pada gambar sebesar ini efeknya bukan "mengambang"
 * melainkan kepala yang meloncat: satu piksel sumber jadi tiga piksel layar
 * pada zoom 3. Yang bergerak tentakel, riak, dan sesekali kelopak matanya.
 */
function gambarFrameGurita(k, oy, frame) {
  const { lebar: W, tinggi: H, air, kepala: K } = GURITA;
  const fase = (frame / GURITA.frame) * Math.PI * 4;
  const kedip = frame === 11;
  const gambar = (x, y, warna) => k.set(x, y + oy, warna);

  const isi = new Set();
  const kunci = (x, y) => `${x},${y}`;
  const taruh = (x, y, klip = H) => {
    if (x >= 0 && y >= 0 && x < W && y < H && y <= klip) isi.add(kunci(x, y));
  };
  const cakram = (cx, cy, r, klip) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) taruh(x, y, klip);
      }
    }
  };
  const diElips = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

  // bayangan badan di air, di bawah garis airnya
  for (let y = air; y <= air + 4; y++) {
    for (let x = K.x - 20; x <= K.x + 20; x++) if (diElips(x, y, K.x, air, 19, 3.6)) gambar(x, y, BUSA.bayang);
  }

  // tentakel
  const sedot = [];
  const busa = [];
  for (const t of tentakelGurita(fase)) {
    let jalur = jalurHalus(t.titik);
    if (t.gulung) jalur = gulung(jalur, t.gulung[0], t.gulung[1]);
    jalur.forEach(([x, y], i) => {
      const u = i / (jalur.length - 1);
      // punuk: bagian tengah tentakel, tebalnya nyaris rata; yang lain meruncing
      const r = t.rata ? t.tebal - 0.9 * u : t.tebal * (1 - u) ** 0.85 + 0.55;
      cakram(x, y, r, t.klip);
      if (i % 6 === 3 && r > 1.9 && i > 4) {
        // penyedot di satu sisi saja, menghadap ke dalam lengkungnya
        const [nx, ny] = jalur[Math.min(i + 1, jalur.length - 1)];
        const th = Math.atan2(ny - y, nx - x) + (t.sisi * Math.PI) / 2;
        sedot.push([Math.round(x + Math.cos(th) * (r - 1.1) - 0.5), Math.round(y + Math.sin(th) * (r - 1.1) - 0.5), t.klip ?? H]);
      }
    });
    busa.push(...t.busa);
  }

  // kepala: kubah bundar di atas, pipi melebar di garis air
  const diKepala = (x, y) =>
    y <= air &&
    (diElips(x, y, K.x, K.kubah.cy, K.kubah.rx, K.kubah.ry) || diElips(x, y, K.x, K.pipi.cy, K.pipi.rx, K.pipi.ry));
  for (let y = 0; y <= air; y++) for (let x = K.x - 20; x <= K.x + 20; x++) if (diKepala(x, y)) isi.add(kunci(x, y));

  /*
   * Pewarnaan dari bentuk lokalnya sendiri: piksel yang di ATASNYA kosong
   * menangkap cahaya, yang di BAWAHNYA kosong jatuh ke bayangan. Kepala
   * dapat tambahan gradasi dari kiri-atas supaya kubahnya terbaca bulat.
   */
  for (const kk of isi) {
    const [x, y] = kk.split(',').map(Number);
    const atasKosong = !isi.has(kunci(x, y - 1));
    const bawahKosong = !isi.has(kunci(x, y + 1));
    let warna = KULIT.dasar;
    if (diKepala(x, y)) {
      const jarak = Math.hypot(x - (K.x - 6), y - (K.kubah.cy - 8));
      warna = jarak < 3.2 ? KULIT.kilau : jarak < 7.5 ? KULIT.terang : jarak < 14 ? KULIT.sedang : KULIT.dasar;
      // tepi kanan-bawah kubah dan pangkal di garis air: lebih gelap
      if (Math.hypot(x - (K.x + 9), y - (K.kubah.cy + 6)) > 17 && x > K.x + 6) warna = KULIT.gelap;
      if (y >= air - 1) warna = KULIT.gelap;
    } else if (atasKosong && !bawahKosong) warna = KULIT.terang;
    else if (bawahKosong && !atasKosong) warna = KULIT.gelap;
    gambar(x, y, warna);
  }

  // totol-totol di kubah — pola kulit, bukan taburan titik putih
  for (const [x, y, w, h] of [
    [57, 17, 3, 2],
    [61, 24, 2, 2],
    [53, 21, 2, 1],
    [38, 27, 2, 2],
    [47, 14, 2, 1],
    [58, 30, 2, 1],
  ]) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (isi.has(kunci(x + i, y + j))) gambar(x + i, y + j, KULIT.bintik);
  }

  for (const [x, y, klip] of sedot) if (isi.has(kunci(x, y)) && y <= klip && !diKepala(x, y)) gambar(x, y, KULIT.sedot);

  // wajah: mata hitam berkilau, pipi merona, senyum kecil
  for (const ex of [K.x - 6, K.x + 6]) {
    const ey = 35;
    if (kedip) {
      // mata terpejam tersenyum: lengkung ︶
      gambar(ex - 2, ey - 1, WAJAH.mata);
      gambar(ex - 1, ey, WAJAH.mata);
      gambar(ex, ey, WAJAH.mata);
      gambar(ex + 1, ey - 1, WAJAH.mata);
    } else {
      for (let y = -3; y <= 2; y++) {
        const lebar = y === -3 || y === 2 ? [-1, 0] : [-2, -1, 0, 1];
        for (const x of lebar) gambar(ex + x, ey + y, WAJAH.mata);
      }
      gambar(ex - 1, ey - 2, WAJAH.kilau);
      gambar(ex - 1, ey - 1, WAJAH.kilau);
      gambar(ex, ey + 1, WAJAH.kilau);
    }
    const px = ex < K.x ? ex - 4 : ex + 2;
    for (let i = 0; i < 3; i++) gambar(px + i, ey + 4, WAJAH.pipi);
  }
  gambar(K.x - 2, 40, WAJAH.mulut);
  gambar(K.x - 1, 41, WAJAH.mulut);
  gambar(K.x, 41, WAJAH.mulut);
  gambar(K.x + 1, 40, WAJAH.mulut);

  // garis tepi: satu piksel di sekeliling seluruh bentuk
  for (const kk of isi) {
    const [x, y] = kk.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!isi.has(kunci(x + dx, y + dy))) gambar(x + dx, y + dy, TINTA_GURITA);
    }
  }

  /*
   * Riak di garis air, digambar PALING AKHIR: busanya menutupi pangkal
   * kepala dan tentakel, dan itulah yang membuatnya terbaca "keluar dari
   * air", bukan "ditempel di atas air". Hanya separuh depan elipsnya — yang
   * belakang tertutup badannya sendiri. Putus-putusnya bergeser tiap frame.
   */
  const riak = (cx, cy, rx, ry, geser, jarang = 3) => {
    for (let a = 0; a < 64; a++) {
      const s = (a / 64) * Math.PI;
      const x = Math.round(cx + Math.cos(s) * rx - 0.5);
      const y = Math.round(cy + Math.sin(s) * ry);
      // `jarang` piksel busa, lalu celah 2 — celahnya yang bergeser tiap frame
      const pita = (a + geser) % (jarang + 2);
      if (pita < jarang) gambar(x, y, pita === 0 ? BUSA.biru : BUSA.putih);
    }
  };
  riak(K.x, air + 1, 20.5, 3.2, frame * 2, 7);
  // cincin kedua merambat keluar pelan-pelan, pudar di tepi
  const rambat = (frame % 8) / 8;
  riak(K.x, air + 1, 23 + rambat * 5, 3.6 + rambat, frame, 2 + Math.round(rambat * 2));
  for (const [bx, by] of busa) riak(bx, by, 4.2, 1.5, frame, 3);
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
  for (let f = 0; f < F; f++) gambarFrameGurita(k, f * H, f);
  return k;
}


/* -------------------------------------------------------------- petani */

/**
 * Warga yang sedang mencangkul di petak sawah.
 *
 * Badannya BUKAN gambar baru: ia diturunkan langsung dari frame diam-menghadap-
 * bawah milik karakter utama, lalu ditukar warnanya. Menggambar ulang manusia
 * 32x32 dengan gaya yang sama persis — proporsi, tebal garis, cara bayangan
 * jatuh — jauh lebih sulit daripada kelihatannya, dan hasil yang meleset
 * sedikit saja langsung terbaca sebagai "aset dari pak lain". Menukar warna
 * memberi jaminan yang tidak bisa diberi cara lain: siluetnya identik, jadi
 * ia pasti satu keluarga dengan penghuni desa yang sudah ada.
 *
 * Yang digambar sendiri cuma cangkulnya dan ayunannya.
 */
const PETANI = { sisi: 32, frame: 4 };

/**
 * Peta tukar warna. Kunci = warna asli di blonde_man.png, nilai = penggantinya.
 *
 * Garis tepi (#45293f) dan warna mata (#2e222f) sengaja TIDAK ditukar: itu
 * tinta yang dipakai seluruh karakter di dunia ini, dan menggantinya akan
 * membuat wajahnya terbaca beda bahan, bukan beda orang.
 */
const TUKAR_PETANI = {
  '#f79617': '#8a5a2f', // rambut, nada tengah  → cokelat
  '#fb6b1d': '#633d1f', // rambut, bayangan
  '#f9c22b': '#a97a44', // rambut, kilau
  '#fdcbb0': '#e2ab7c', // kulit                → lebih gelap, kena matahari
  '#fca790': '#c2855c', // kulit, bayangan
  '#e83b3b': '#4a8f52', // baju                 → hijau kebun
  '#ae2334': '#2f6b3a', // baju, bayangan
  '#ffffff': '#ece0c0', // garis baju           → krem, bukan putih
  '#cd683d': '#6d5c3a', // celana               → khaki
  '#9e4539': '#4b3f27', // celana, bayangan
};

const CANGKUL = {
  kayu: rgb('#8a5a2b'),
  kayuGelap: rgb('#5f3c1c'),
  besi: rgb('#c3cad6'),
  besiGelap: rgb('#798494'),
  tinta: rgb('#45293f'),
  tanah: rgb('#7a5433'),
  tanahGelap: rgb('#573a22'),
};

/**
 * Satu putaran mencangkul, empat frame.
 *
 * `pangkal`/`ujung` = kedua ujung gagang; `bungkuk` = berapa piksel kepala dan
 * badan turun pada frame itu. Ditulis sebagai koordinat gagang, bukan sudut,
 * karena yang harus dijaga justru ujung bawahnya: pangkal gagang wajib jatuh
 * di tangan kanan (x21 y26 pada sprite aslinya) di keempat frame, kalau tidak
 * cangkulnya terbaca melayang lepas dari genggaman.
 */
/**
 * Satu putaran mencangkul, empat frame.
 *
 * Yang ditulis di sini KEDUA GENGGAMAN, bukan kedua ujung gagang. Gagangnya
 * justru diturunkan dari situ: arahnya garis yang melewati dua genggaman
 * itu, lalu diperpanjang ke depan sampai mata cangkul dan ke belakang
 * sepanjang sisa batangnya. Dengan begitu kedua telapak dijamin duduk DI
 * gagang di frame mana pun — kalau sebaliknya, letak tangan cuma hasil
 * sampingan yang harus dihitung ulang tiap kali ayunannya diubah.
 *
 * Semua genggaman ditahan di baris 23 ke bawah. Wajahnya menempati baris
 * 19-23; genggaman yang lebih tinggi dari itu membuat lengannya melintas di
 * depan muka, dan pada 32 piksel yang terbaca bukan lengan melainkan wajah
 * yang hilang.
 */
const AYUN = [
  { pegang: [[17, 26], [20, 23]], depan: 9, belakang: 1, bungkuk: 0, tanah: [] },
  { pegang: [[17, 26], [21, 25]], depan: 7, belakang: 1, bungkuk: 0, tanah: [] },
  { pegang: [[16, 27], [20, 27]], depan: 7, belakang: 1, bungkuk: 2, tanah: [[23, 30], [24, 30], [28, 31], [29, 31]] },
  { pegang: [[17, 26], [21, 24]], depan: 7, belakang: 1, bungkuk: 1, tanah: [[26, 29], [27, 29]] },
];

/** Pangkal lengan di bahu, diukur dari sprite aslinya. */
const BAHU = [
  [12, 26],
  [19, 26],
];

/**
 * Menempelkan sekumpulan piksel ke kanvas berikut garis tepinya.
 *
 * Garis tepi hanya ditulis di piksel yang MASIH KOSONG. Badannya sudah
 * digambar duluan, dan tinta yang dipasang tanpa syarat akan menggerogoti
 * bahu dan tangan yang bersentuhan dengan gagang.
 */
function tuang(sel, kumpulan, turun) {
  for (const kunci of kumpulan.keys()) {
    const [x, y] = kunci.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = `${x + dx},${y + dy}`;
      if (!kumpulan.has(n) && !sel.ada(x + dx, y + dy + turun)) {
        sel.set(x + dx, y + dy + turun, CANGKUL.tinta);
      }
    }
  }
  for (const [kunci, warna] of kumpulan) {
    const [x, y] = kunci.split(',').map(Number);
    sel.set(x, y + turun, warna);
  }
}

async function gambarPetani() {
  const { sisi: S, frame: F } = PETANI;
  const sumber = path.join(
    SRC_DIR,
    'RPG Top Down Characters - Free Version/Blonde Man/blonde_man.png'
  );
  // frame kiri-atas = diam menghadap bawah
  const { data } = await sharp(sumber)
    .extract({ left: 0, top: 0, width: S, height: S })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tukar = new Map(Object.entries(TUKAR_PETANI).map(([a, b]) => [a, rgb(b)]));
  const k = new Kanvas(S * F, S);

  AYUN.forEach((pose, f) => {
    const ox = f * S;
    /*
     * Semua penulisan piksel lewat `sel`, yang MEMOTONG di batas frame.
     *
     * Tanpa itu, x = 32 pada frame ini jatuh di kolom 0 frame berikutnya —
     * lembarnya satu gambar panjang, batas frame cuma kesepakatan. Mata
     * cangkul yang menjulur sedikit terlalu jauh muncul sebagai titik tinta
     * menggantung di sebelah KIRI orangnya pada frame sesudahnya, dan dari
     * luar terlihat seperti kotoran di layar, bukan seperti kesalahan
     * menggambar.
     */
    const sel = {
      set: (x, y, warna) => {
        if (x >= 0 && x < S && y >= 0 && y < S) k.set(ox + x, y, warna);
      },
      hapus: (x, y) => {
        if (x >= 0 && x < S && y >= 0 && y < S) k.hapus(ox + x, y);
      },
      ada: (x, y) => x >= 0 && x < S && y >= 0 && y < S && k.ada(ox + x, y),
    };

    // badan: disalin piksel per piksel sambil ditukar warnanya. Bagian atas
    // (kepala sampai pinggang) diturunkan `bungkuk` piksel — itu yang membuat
    // ayunannya terbaca sebagai membungkuk, bukan sekadar tangan bergerak.
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (data[i + 3] < 128) continue;
        const asli = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        const warna = tukar.get(asli) ?? [data[i], data[i + 1], data[i + 2], 255];
        const turun = y <= 27 ? pose.bungkuk : 0;
        sel.set(x, y + turun, warna);
      }
    }

    /*
     * Kedua lengan bawaan sprite menggantung di sisi badan — itu pose DIAM,
     * dan orang yang mencangkul tidak berdiri begitu. Lengannya dihapus dulu
     * sampai badannya jadi kotak berbingkai rapi, baru digambar ulang menuju
     * genggamannya di gagang. Tanpa langkah ini cangkulnya cuma menempel di
     * sebelah orang yang sedang bertolak pinggang.
     */
    for (let y = 25; y <= 27; y++) {
      for (const x of [9, 10, 11, 20, 21, 22]) sel.hapus(x, y + pose.bungkuk);
      for (const x of [11, 20]) sel.set(x, y + pose.bungkuk, CANGKUL.tinta);
    }

    /*
     * Cangkulnya: gagang lalu mata cangkul, keduanya diukur dari arah gagang
     * itu sendiri. Mata cangkul dipasang TEGAK LURUS gagang dan menjulur ke
     * satu sisi saja — itu yang membedakannya dari kapak, yang matanya
     * melebar simetris ke dua sisi. Waktu gagangnya mendatar saat membentur,
     * tegak lurus itu otomatis menunjuk ke bawah, ke tanah.
     */
    const [g1, g2] = pose.pegang;
    const bentang = Math.hypot(g2[0] - g1[0], g2[1] - g1[1]);
    const ux = (g2[0] - g1[0]) / bentang;
    const uy = (g2[1] - g1[1]) / bentang;
    const sx = -uy; // tegak lurus, diputar +90 derajat
    const sy = ux;
    const x1 = g2[0] + ux * pose.depan; // ujung tempat mata cangkul dipasang
    const y1 = g2[1] + uy * pose.depan;

    const alat = new Map();
    const pasang = (x, y, warna) => alat.set(`${Math.round(x)},${Math.round(y)}`, warna);
    for (let n = -pose.belakang; n <= bentang + pose.depan; n++) {
      pasang(g1[0] + ux * n, g1[1] + uy * n, CANGKUL.kayu);
      pasang(g1[0] + ux * n + sx, g1[1] + uy * n + sy, CANGKUL.kayuGelap);
    }
    for (let d = 0; d <= 4; d++) {
      for (let t = -1; t <= 0; t++) {
        pasang(x1 + sx * d + ux * t, y1 + sy * d + uy * t, d >= 3 ? CANGKUL.besiGelap : CANGKUL.besi);
      }
    }
    tuang(sel, alat, pose.bungkuk);

    /*
     * Lengan digambar SESUDAH gagang, supaya telapaknya tampak di depan
     * batang kayunya — itu satu-satunya hal yang membedakan "memegang" dari
     * "kebetulan bersentuhan". Tebalnya satu piksel: pada badan selebar 13
     * piksel, lengan dua piksel terbaca seperti paha.
     */
    const lengan = new Map();
    const kulit = tukar.get('#fdcbb0');
    pose.pegang.forEach((g, i) => {
      const [bx, by] = BAHU[i];
      const jauh = Math.max(Math.abs(g[0] - bx), Math.abs(g[1] - by), 1);
      for (let n = 0; n <= jauh; n++) {
        const u = n / jauh;
        lengan.set(`${Math.round(bx + (g[0] - bx) * u)},${Math.round(by + (g[1] - by) * u)}`, kulit);
      }
      // telapak: gumpalan 2x2 tepat di gagang
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        lengan.set(`${g[0] + dx - 1},${g[1] + dy - 1}`, kulit);
      }
    });
    /*
     * Garis tinta DI ATAS lengan dipaksa, bukan cuma diisi di piksel kosong
     * seperti bagian lain. Lengan yang melintas di depan dada tidak pernah
     * bersinggungan dengan piksel kosong, jadi tanpa paksaan ini ia menyatu
     * dengan bajunya dan dua lengan yang memegang gagang terbaca sebagai satu
     * palang kulit selebar dada.
     */
    for (const kunci of lengan.keys()) {
      const [x, y] = kunci.split(',').map(Number);
      if (!lengan.has(`${x},${y - 1}`)) sel.set(x, y - 1 + pose.bungkuk, CANGKUL.tinta);
    }
    tuang(sel, lengan, pose.bungkuk);

    // cipratan tanah, hanya pada frame yang membentur
    pose.tanah.forEach(([tx, ty], i) => sel.set(tx, ty, i % 2 ? CANGKUL.tanahGelap : CANGKUL.tanah));
  });

  return k;
}


/* -------------------------------------------------------------- pemuda */

/**
 * Pemuda bertopi yang duduk di bangku taman.
 *
 * Sama seperti petani, badannya diturunkan dari frame diam-menghadap-bawah
 * milik karakter utama lalu ditukar warnanya — itu satu-satunya cara yang
 * menjamin ia satu keluarga dengan penghuni desa lain. Yang digambar sendiri
 * cuma topi, kaki yang menjuntai, dan gerakannya.
 */
const PEMUDA = { sisi: 32, frame: 4 };

const TUKAR_PEMUDA = {
  '#f79617': '#2f2b33', // rambut         → hitam, toh nyaris tertutup topi
  '#fb6b1d': '#1e1b23',
  '#f9c22b': '#43404b',
  '#fdcbb0': '#efbf9d', // kulit
  '#fca790': '#cf9878',
  '#e83b3b': '#3a3f52', // baju           → abu tua
  '#ae2334': '#25293a',
  '#ffffff': '#e0563f', // garis baju     → merah, jadi satu-satunya warna terang
  '#cd683d': '#3d5480', // celana         → biru denim, biar beda tegas dari baju
  '#9e4539': '#2a3a5c',
};

const TOPI = {
  atas: rgb('#3d4459'),
  badan: rgb('#2f3446'),
  bawah: rgb('#232838'),
  garis: rgb('#e0563f'),
  tinta: rgb('#45293f'),
};

/**
 * Empat frame duduk-santai.
 *
 * `kepala` = geseran mendatar kepala saja, `bahu` = geseran tegak lengan
 * kanan. TIDAK ADA geseran tegak untuk seluruh badan, dan itu disengaja:
 * versi sebelumnya menggeser badannya satu piksel ke bawah sekali per
 * putaran, dan pada gambar sebesar ini yang terbaca bukan orang mengangguk
 * melainkan gambar yang meloncat naik-turun. Geseran mendatar tidak punya
 * masalah itu — ia terbaca sebagai kepala yang menengok, bukan sebagai
 * gambar yang bergetar.
 */
const DUDUK = [
  { kepala: 0, bahu: 0 },
  { kepala: -1, bahu: 1 },
  { kepala: 0, bahu: 0 },
  { kepala: 1, bahu: 1 },
];

async function gambarPemuda() {
  const { sisi: S, frame: F } = PEMUDA;
  const sumber = path.join(SRC_DIR, 'RPG Top Down Characters - Free Version/Blonde Man/blonde_man.png');
  const { data } = await sharp(sumber)
    .extract({ left: 0, top: 0, width: S, height: S })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tukar = new Map(Object.entries(TUKAR_PEMUDA).map(([a, b]) => [a, rgb(b)]));
  const k = new Kanvas(S * F, S);

  DUDUK.forEach((pose, f) => {
    const ox = f * S;
    const sel = {
      set: (x, y, warna) => {
        if (x >= 0 && x < S && y >= 0 && y < S) k.set(ox + x, y, warna);
      },
      ada: (x, y) => x >= 0 && x < S && y >= 0 && y < S && k.ada(ox + x, y),
    };

    /*
     * Yang digambar CUMA badan atas: kepala sampai pinggang, baris 13-27,
     * apa adanya dari sprite aslinya. Tidak ada kaki, tidak ada pangkuan.
     *
     * Itu bukan penghematan, melainkan cara duduk digambar di gim seperti
     * ini: bangkunya sendiri yang menutupi kaki. Dua percobaan sebelumnya
     * mencoba MENGGAMBAR bagian bawah tubuhnya — sekali sebagai dua kaki
     * menjuntai, sekali sebagai pangkuan melebar — dan keduanya gagal karena
     * alasan yang sama: pada 32 piksel, tubuh bagian bawah orang duduk cuma
     * punya 4-5 baris, terlalu sedikit untuk membentuk apa pun yang terbaca.
     * Yang tersisa cuma gumpalan gelap, dan gumpalan itu justru merusak
     * proporsi badan atasnya yang sebenarnya sudah benar.
     */
    for (let y = 13; y <= 27; y++) {
      const geser = y <= 23 ? pose.kepala : 0;
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (data[i + 3] < 128) continue;
        const asli = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        const turun = x >= 19 && y >= 25 ? pose.bahu : 0; // lengan kanan saja
        sel.set(x + geser, y + turun, tukar.get(asli) ?? [data[i], data[i + 1], data[i + 2], 255]);
      }
    }

    /*
     * Topi menutupi empat baris teratas kepala saja, dan bibirnya menjulur
     * tiga piksel. Versi sebelumnya menutup lima baris dengan bibir empat
     * piksel; hasilnya topi selebar kepala yang jadi benda paling besar di
     * seluruh gambar, dan orangnya tinggal sepasang mata di bawahnya.
     *
     * Dipakai miring karena topi menghadap depan pada karakter tampak-depan
     * cuma jadi pita mendatar di dahi: bibirnya sejajar garis pandang, jadi
     * tidak ada satu piksel pun yang bisa menunjukkan bahwa itu bibir topi.
     */
    const g = pose.kepala;
    for (let y = 13; y <= 16; y++) {
      for (let x = 10; x <= 21; x++) {
        if (!sel.ada(x + g, y)) continue;
        sel.set(x + g, y, y === 13 ? TOPI.atas : y === 16 ? TOPI.garis : TOPI.badan);
      }
    }
    const bibir = new Map();
    for (let x = 22; x <= 24; x++) bibir.set(`${x + g},15`, TOPI.badan);
    for (let x = 22; x <= 24; x++) bibir.set(`${x + g},16`, TOPI.bawah);
    tuang(sel, bibir, 0);

    /*
     * Badan bawah: pangkuan yang duduk di papan bangku.
     *
     * Empat baris saja, dan dua baris terakhirnya dipecah jadi dua lutut
     * dengan celah di tengah. Celah itu yang menahan siluetnya supaya tidak
     * jatuh jadi satu kotak — kotak pejal terbaca sebagai meja, bukan orang.
     *
     * Tidak lebih panjang dari ini dengan sengaja: pada 32 piksel, kaki
     * orang duduk cuma kebagian beberapa baris, dan tiap baris tambahan
     * justru mengubahnya jadi kaki orang berdiri.
     */
    const bawah = new Map();
    const celana = tukar.get('#cd683d');
    const celanaGelap = tukar.get('#9e4539');
    for (let x = 11; x <= 20; x++) {
      bawah.set(`${x},28`, celana);
      bawah.set(`${x},29`, x <= 12 || x >= 19 ? celanaGelap : celana);
    }
    for (const x of [11, 12, 13, 17, 18, 19]) {
      bawah.set(`${x},30`, celana);
      bawah.set(`${x},31`, celanaGelap);
    }
    tuang(sel, bawah, 0);
  });

  return k;
}


/* -------------------------------------------------------------- kepala */

/**
 * Kepala karakter untuk penanda "kamu di sini" di minimap.
 *
 * Dipotong langsung dari sprite aslinya, bukan digambar ulang: penanda ini
 * satu-satunya gambar di minimap yang harus dikenali sebagai ORANG TERTENTU,
 * dan kemiripan itu hilang begitu digambar ulang sebesar 14 piksel.
 *
 * Diberi bayangan tinta setebal satu piksel di luar garis tepinya sendiri.
 * Minimap ini peta sungguhan yang penuh detail — rumput, atap jingga, jalan
 * tanah, air — dan garis tepi bawaan sprite yang cuma satu piksel tenggelam
 * di atas latar segelap atap. Halo gelap memberi jarak yang sama di mana pun
 * kepala ini kebetulan berada.
 */
const KEPALA = { x0: 9, x1: 22, y0: 13, y1: 23 };

async function gambarKepala() {
  const { x0, x1, y0, y1 } = KEPALA;
  const lebar = x1 - x0 + 1;
  const tinggi = y1 - y0 + 1;
  const sumber = path.join(SRC_DIR, 'RPG Top Down Characters - Free Version/Blonde Man/blonde_man.png');
  const { data } = await sharp(sumber)
    .extract({ left: 0, top: 0, width: 32, height: 32 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // +1 piksel di tiap sisi untuk halonya
  const k = new Kanvas(lebar + 2, tinggi + 2);
  const isi = new Set();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * 32 + x) * 4;
      if (data[i + 3] < 128) continue;
      isi.add(`${x - x0 + 1},${y - y0 + 1}`);
    }
  }
  const HALO = rgb('#1b2416');
  for (const kunci of isi) {
    const [x, y] = kunci.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      if (!isi.has(`${x + dx},${y + dy}`)) k.set(x + dx, y + dy, HALO);
    }
  }
  for (const kunci of isi) {
    const [x, y] = kunci.split(',').map(Number);
    const i = ((y - 1 + y0) * 32 + (x - 1 + x0)) * 4;
    k.set(x, y, [data[i], data[i + 1], data[i + 2], 255]);
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
const gurita = gambarGurita();
const petani = await gambarPetani();
const pemuda = await gambarPemuda();
const kepala = await gambarKepala();

await mkdir(OUT_DIR, { recursive: true });
const a = await bingkai.simpan(path.join(OUT_DIR, 'minimap_frame.png'));
const b = await kupu.simpan(path.join(OUT_DIR, 'kupu_kupu.png'));
const c = await gurita.simpan(path.join(OUT_DIR, 'gurita.png'));
const d = await petani.simpan(path.join(OUT_DIR, 'petani.png'));
const e = await pemuda.simpan(path.join(OUT_DIR, 'pemuda.png'));
const f = await kepala.simpan(path.join(OUT_DIR, 'kepala.png'));

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
  path.join(SRC_DIR, 'Pemuda.tsx'),
  tsx({ nama: 'Pemuda', berkas: 'pemuda.png', w: pemuda.w, h: pemuda.h, tile: PEMUDA.sisi })
);
await writeFile(
  path.join(SRC_DIR, 'Petani.tsx'),
  tsx({ nama: 'Petani', berkas: 'petani.png', w: petani.w, h: petani.h, tile: PETANI.sisi })
);
await writeFile(
  path.join(SRC_DIR, 'Gurita.tsx'),
  tsx({ nama: 'Gurita', berkas: 'gurita.png', w: gurita.w, h: gurita.h, tile: 16 })
);

console.log(`kupu_kupu.png     ${kupu.w}×${kupu.h} → ${(b / 1024).toFixed(1)} KB`);
console.log(`gurita.png        ${gurita.w}×${gurita.h} → ${(c / 1024).toFixed(1)} KB`);
console.log(`petani.png        ${petani.w}×${petani.h} → ${(d / 1024).toFixed(1)} KB`);
console.log(`pemuda.png        ${pemuda.w}×${pemuda.h} → ${(e / 1024).toFixed(1)} KB`);
console.log(`kepala.png        ${kepala.w}×${kepala.h} → ${(f / 1024).toFixed(1)} KB`);
console.log('tsx: Minimap Frame.tsx, Kupu Kupu.tsx, Gurita.tsx, Petani.tsx');
