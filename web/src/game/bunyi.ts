import { derau, latarTetap, pasangUji, saluran, type Jalur } from './suara';

/**
 * Bunyi desa: semua disintesis dengan Web Audio, tanpa satu berkas pun.
 *
 * Sama seperti denting bakso dan kentongan ronda yang lebih dulu ada,
 * tiap bunyi di sini dirangkai dari osilator, derau, dan saringan: ayam
 * berkotek, anjing menggonggong, bel sepeda, tawa bapak-bapak di bangku,
 * jangkrik, kodok, tokek, burung hantu, wajan nasi goreng. Unduhan situsnya
 * tidak bertambah, dan tiap bunyi sedikit berbeda setiap kali — nadanya
 * digeser acak, jadi ayam yang sama tidak pernah berkotek persis dua kali.
 *
 * Tiap bunyi diberi TITIK di dunia, bukan kekerasan. Kerasnya dihitung dari
 * jarak ke pemain dan kiri-kanannya dari posisinya terhadap pemain: tokek di
 * dinding kiri terdengar di telinga kiri, dan kodok di seberang sungai makin
 * pelan saat pemain menjauh.
 */

export interface Titik {
  x: number;
  y: number;
}

let telinga: () => Titik | undefined = () => undefined;

/** Titik dengar: posisi pemain. Dipasang WorldScene. */
export function pasangTelinga(f: () => Titik | undefined) {
  telinga = f;
}

/** Saat merekam untuk dites, semua bunyi dianggap tepat di sebelah telinga. */
let paksaDekat = false;

/**
 * Seberapa keras (0..1) dan dari mana (-1 kiri .. 1 kanan) sebuah titik
 * terdengar. Kerasnya turun melengkung, bukan lurus: di dekat sumbernya
 * selangkah tidak mengubah banyak, di pinggir jangkauannya bunyinya lekas
 * hilang — seperti telinga sungguhan.
 */
export function dengar(x: number, y: number, jangkau: number) {
  if (paksaDekat) return { kuat: 1, pan: 0 };
  const p = telinga();
  if (!p) return { kuat: 0, pan: 0 };
  const d = Math.hypot(x - p.x, y - p.y);
  const k = Math.max(0, 1 - d / jangkau);
  return { kuat: k * k * (1.6 - 0.6 * k), pan: Math.max(-0.75, Math.min(0.75, (x - p.x) / 170)) };
}

/* ---------------- catatan untuk tes ---------------- */

/**
 * Bunyi yang benar-benar dibunyikan, dicatat di `window.__bunyi` selama
 * pengembangan — tes ujung-ke-ujung membacanya untuk memastikan tiap benda
 * bersuara. Di situs yang sudah jadi tidak dicatat apa pun.
 */
function catat(nama: string, kuat: number) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  const w = window as unknown as { __bunyi?: { nama: string; kuat: number; t: number }[] };
  (w.__bunyi ??= []).push({ nama, kuat: Math.round(kuat * 100) / 100, t: Math.round(performance.now()) });
  if (w.__bunyi.length > 400) w.__bunyi.splice(0, 100);
}

/** Buka saluran untuk bunyi `nama` di titik (x, y), atau null kalau tak terdengar. */
function buka(nama: string, x: number, y: number, jangkau: number, lama: number, latar = false, keras = 1) {
  const { kuat, pan } = dengar(x, y, jangkau);
  const j = saluran(kuat * keras, pan, lama, latar);
  if (j) catat(nama, kuat);
  return j;
}

/* ---------------- bahan dasar ---------------- */

const acak = (a: number, b: number) => a + Math.random() * (b - a);

function osilator(j: Jalur, jenis: OscillatorType, f: number, t0: number, t1: number) {
  const o = j.c.createOscillator();
  o.type = jenis;
  o.frequency.setValueAtTime(f, t0);
  o.start(t0);
  o.stop(t1 + 0.05);
  return o;
}

function penguat(j: Jalur, awal = 0.0001) {
  const g = j.c.createGain();
  g.gain.value = awal;
  return g;
}

function saringan(j: Jalur, jenis: BiquadFilterType, f: number, q = 1) {
  const s = j.c.createBiquadFilter();
  s.type = jenis;
  s.frequency.value = f;
  s.Q.value = q;
  return s;
}

/** Sepotong derau putih dari titik acak di bank derau. */
function desir(j: Jalur, t0: number, lama: number) {
  const s = j.c.createBufferSource();
  s.buffer = derau(j.c);
  s.start(t0, Math.random() * 1.2, lama + 0.05);
  return s;
}

/** Selubung serang-tahan-lepas di sebuah AudioParam penguat. */
function selubung(g: GainNode, t0: number, puncak: number, serang: number, tahan: number, lepas: number) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t0);
  p.exponentialRampToValueAtTime(Math.max(0.0002, puncak), t0 + serang);
  p.setValueAtTime(Math.max(0.0002, puncak), t0 + serang + tahan);
  p.exponentialRampToValueAtTime(0.0001, t0 + serang + tahan + lepas);
}

/** Pukulan singkat: naik seketika lalu padam melengkung. */
function pukul(g: GainNode, t0: number, puncak: number, padam: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, puncak), t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + padam);
}

/**
 * Nada logam atau kayu: beberapa nada sinus/segitiga yang padam bersama.
 * `nada` = [frekuensi, porsi kekerasan, lama padam (detik)].
 */
function denting(j: Jalur, t0: number, nada: [number, number, number][], kuat: number, jenis: OscillatorType = 'sine', turun = 1) {
  for (const [f, porsi, padam] of nada) {
    const o = osilator(j, jenis, f, t0, t0 + padam);
    if (turun !== 1) o.frequency.exponentialRampToValueAtTime(f * turun, t0 + padam);
    const g = penguat(j);
    pukul(g, t0, kuat * porsi, padam);
    o.connect(g).connect(j.out);
  }
}

/** Derau pendek yang disaring — ketuk kayu, kresek api, cipratan kecil. */
function letup(j: Jalur, t0: number, jenis: BiquadFilterType, f: number, q: number, kuat: number, lama: number) {
  const n = desir(j, t0, lama);
  const s = saringan(j, jenis, f, q);
  const g = penguat(j);
  pukul(g, t0, kuat, lama);
  n.connect(s).connect(g).connect(j.out);
  return s;
}

/* ---------------- suara makhluk: sumber gergaji + formant ---------------- */

/** Formant vokal (F1, F2) — cukup dua untuk membedakan a/e/i/o/u. */
const VOKAL = {
  a: [780, 1250],
  e: [480, 1850],
  i: [310, 2250],
  o: [520, 900],
  u: [360, 780],
} as const;
type Vokal = keyof typeof VOKAL;

interface Ucapan {
  t: number;
  lama: number;
  /** Lengkung nada: [waktu relatif 0..1, Hz]. */
  nada: [number, number][];
  /** Formant: [Hz, Q, porsi]. Boleh bergeser: [Hz awal, Hz akhir, Q, porsi]. */
  formant: ([number, number, number] | [number, number, number, number])[];
  kuat: number;
  serang?: number;
  lepas?: number;
  /** Desah di awal suku kata ("h" pada "ha"), 0..1. */
  desah?: number;
  /** Getaran nada: [Hz, kedalaman dalam Hz]. */
  getar?: [number, number];
  jenis?: OscillatorType;
}

/**
 * Satu bunyi bersuara: gelombang gergaji (pita suara) yang disaring
 * beberapa formant (rongga mulut). Dipakai untuk tawa, gumam, kotek ayam,
 * lenguh sapi, meong, gonggong, kwek bebek, tokek, dan burung hantu —
 * yang membedakan mereka cuma lengkung nada dan letak formantnya.
 */
function ucap(j: Jalur, u: Ucapan) {
  const t0 = u.t;
  const t1 = t0 + u.lama;
  const o = osilator(j, u.jenis ?? 'sawtooth', u.nada[0][1], t0, t1);
  for (const [w, f] of u.nada.slice(1)) o.frequency.exponentialRampToValueAtTime(f, t0 + w * u.lama);
  if (u.getar) {
    const lfo = osilator(j, 'sine', u.getar[0], t0, t1);
    const dalam = j.c.createGain();
    dalam.gain.value = u.getar[1];
    lfo.connect(dalam).connect(o.frequency);
  }
  const env = penguat(j);
  const serang = u.serang ?? 0.015;
  const lepas = u.lepas ?? 0.05;
  selubung(env, t0, u.kuat, serang, Math.max(0, u.lama - serang - lepas), lepas);
  env.connect(j.out);
  for (const fm of u.formant) {
    const [f0, f1, q, porsi] = fm.length === 4 ? fm : [fm[0], fm[0], fm[1], fm[2]];
    const s = saringan(j, 'bandpass', f0, q);
    if (f1 !== f0) s.frequency.exponentialRampToValueAtTime(f1, t1);
    const g = j.c.createGain();
    g.gain.value = porsi;
    o.connect(s).connect(g).connect(env);
  }
  if (u.desah) {
    const n = desir(j, t0, 0.06);
    const s = saringan(j, 'bandpass', 1600, 0.8);
    const g = penguat(j);
    pukul(g, t0, u.kuat * u.desah, 0.06);
    n.connect(s).connect(g).connect(j.out);
  }
}

/* ================================================================= */
/*                          BUNYI BENDA                               */
/* ================================================================= */

/** Denting sendok di mangkok abang bakso. */
export function ting(x: number, y: number) {
  const j = buka('ting', x, y, 170, 0.7);
  if (!j) return;
  denting(j, j.t, [
    [2093, 1, 0.55],
    [3136, 0.45, 0.4],
    [4186, 0.2, 0.3],
  ], 0.22);
}

/** Kentongan bambu: "tok" kayu yang pendek, nadanya sedikit turun. */
export function tok(x: number, y: number, jangkau = 200) {
  const j = buka('tok', x, y, jangkau, 0.3);
  if (!j) return;
  denting(j, j.t, [
    [620, 1, 0.16],
    [940, 0.5, 0.12],
  ], 0.3, 'triangle', 0.82);
}

/**
 * Bel sepeda ontel: "kriiing kriing". Pemukul kecil di dalam tudung bel
 * mengetuk berkali-kali dengan cepat — itu yang membuatnya berderai, bukan
 * satu "ting" — dan tudung logamnya berdengung dengan nada-nada yang tidak
 * harmonis, nada khas logam.
 */
export function kring(x: number, y: number) {
  const j = buka('kring', x, y, 220, 1.6);
  if (!j) return;
  const nada: [number, number][] = [
    [2480, 1],
    [3790, 0.55],
    [5260, 0.3],
    [6900, 0.12],
  ];
  for (const [mulai, ketuk] of [
    [0, 9],
    [0.5, 6],
  ]) {
    const t0 = j.t + mulai;
    const g = penguat(j);
    // derai: tiap ketukan melonjak lalu meluruh sedikit sebelum ketukan berikutnya
    for (let k = 0; k < ketuk; k++) {
      const tk = t0 + k * 0.034;
      g.gain.setValueAtTime(0.16, tk);
      g.gain.exponentialRampToValueAtTime(0.07, tk + 0.03);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ketuk * 0.034 + 0.55);
    g.connect(j.out);
    for (const [f, porsi] of nada) {
      const o = osilator(j, 'sine', f * acak(0.995, 1.005), t0, t0 + 0.9);
      const p = j.c.createGain();
      p.gain.value = porsi;
      o.connect(p).connect(g);
    }
  }
}

/** Derit engsel pintu kayu yang dibuka. */
export function derit(x: number, y: number) {
  const j = buka('derit', x, y, 150, 0.8);
  if (!j) return;
  const lama = acak(0.35, 0.5);
  ucap(j, {
    t: j.t,
    lama,
    nada: [
      [0, 70],
      [0.3, 110],
      [0.55, 85],
      [1, 125],
    ],
    formant: [
      [1150, 9, 1],
      [2300, 12, 0.5],
    ],
    kuat: 1,
    serang: 0.04,
    lepas: 0.1,
    getar: [23, 12],
  });
}

/** Pintu kayu yang menutup: debam rendah. */
export function debam(x: number, y: number) {
  const j = buka('debam', x, y, 150, 0.4);
  if (!j) return;
  denting(j, j.t, [[115, 1, 0.14]], 0.45, 'sine', 0.55);
  letup(j, j.t, 'lowpass', 500, 0.7, 0.25, 0.07);
}

/** Katrol sumur yang berputar: cicit kayu pendek. */
export function cicitKatrol(x: number, y: number) {
  const j = buka('katrol', x, y, 130, 0.3);
  if (!j) return;
  ucap(j, {
    t: j.t,
    lama: 0.1,
    nada: [
      [0, 820],
      [1, 1080],
    ],
    formant: [[1900, 6, 1]],
    kuat: 0.9,
    jenis: 'triangle',
    serang: 0.01,
    lepas: 0.04,
  });
}

/** "Byur": ember menyentuh air sumur, atau apa pun yang tercebur. */
export function byur(x: number, y: number, besar = 1) {
  const j = buka('byur', x, y, 150, 0.8);
  if (!j) return;
  const s = letup(j, j.t, 'lowpass', 4200, 0.9, 0.5 * besar, 0.4);
  s.frequency.exponentialRampToValueAtTime(420, j.t + 0.35);
  denting(j, j.t + 0.01, [[330, 1, 0.18]], 0.25 * besar, 'sine', 0.5);
}

/** Tetes air: "plip" yang nadanya naik. */
export function tetes(x: number, y: number) {
  const j = buka('tetes', x, y, 110, 0.2);
  if (!j) return;
  const o = osilator(j, 'sine', acak(850, 1100), j.t, j.t + 0.06);
  o.frequency.exponentialRampToValueAtTime(acak(1900, 2400), j.t + 0.05);
  const g = penguat(j);
  pukul(g, j.t, 0.16, 0.07);
  o.connect(g).connect(j.out);
}

/** Ikan melompat keluar-masuk air: cipratan kecil. */
export function cebur(x: number, y: number, kecil = false) {
  const j = buka('cebur', x, y, 150, 0.4, true);
  if (!j) return;
  const s = letup(j, j.t, 'bandpass', kecil ? 2600 : 1700, 0.9, kecil ? 0.18 : 0.3, kecil ? 0.14 : 0.24);
  s.frequency.exponentialRampToValueAtTime(700, j.t + 0.2);
}

/** Kotak surat logam: amplop jatuh ke dalamnya, "klontang". */
export function klontang(x: number, y: number) {
  const j = buka('klontang', x, y, 150, 0.6);
  if (!j) return;
  denting(j, j.t, [
    [540, 1, 0.3],
    [1170, 0.6, 0.22],
    [1830, 0.35, 0.16],
    [2710, 0.2, 0.1],
  ], 0.2, 'triangle');
}

/** Tutup kotak surat dibuka / bendera diturunkan: klik logam kecil. */
export function klik(x: number, y: number) {
  const j = buka('klik', x, y, 120, 0.2);
  if (!j) return;
  letup(j, j.t, 'bandpass', 3200, 2, 0.35, 0.03);
  denting(j, j.t, [[1650, 1, 0.05]], 0.08, 'square');
}

/** Tali ayunan yang berderit di ujung ayunannya. */
export function deritTali(x: number, y: number, kuat = 1) {
  const j = buka('tali', x, y, 150, 0.6, true, kuat);
  if (!j) return;
  ucap(j, {
    t: j.t,
    lama: acak(0.22, 0.32),
    nada: [
      [0, 95],
      [0.6, 130],
      [1, 110],
    ],
    formant: [[900, 7, 1]],
    kuat: 0.6,
    serang: 0.05,
    lepas: 0.1,
    getar: [31, 9],
  });
}

/** Kaki anak mendarat di tanah: debuk empuk. */
export function debuk(x: number, y: number) {
  const j = buka('debuk', x, y, 120, 0.2, true);
  if (!j) return;
  letup(j, j.t, 'lowpass', 320, 0.8, 0.9, 0.08);
}

/** Gacuk (batu engklek) jatuh ke tanah berkapur: "tak" kecil. */
export function tak(x: number, y: number) {
  const j = buka('tak', x, y, 130, 0.2);
  if (!j) return;
  denting(j, j.t, [
    [1350, 1, 0.05],
    [2150, 0.6, 0.035],
  ], 0.2, 'triangle');
}

/** Tuts papan ketik. `besar` = tuts spasi yang lebih berat. */
export function ketik(x: number, y: number, besar = false) {
  const j = buka('ketik', x, y, 90, 0.1, true);
  if (!j) return;
  letup(j, j.t, 'bandpass', besar ? 1200 : acak(2800, 4200), besar ? 1.2 : 2, besar ? 0.45 : 0.34, besar ? 0.035 : 0.02);
}

/** "Build passed": dua nada naik yang cerah. */
export function sukses(x: number, y: number) {
  const j = buka('sukses', x, y, 110, 0.8);
  if (!j) return;
  denting(j, j.t, [[1047, 1, 0.35]], 0.12);
  denting(j, j.t + 0.11, [[1568, 1, 0.5]], 0.12);
}

/** Kilau piala: arpeggio bernada tinggi. */
export function kilau(x: number, y: number) {
  const j = buka('kilau', x, y, 130, 1);
  if (!j) return;
  [1568, 2093, 2637, 3136].forEach((f, i) => denting(j, j.t + i * 0.07, [[f, 1, 0.45]], 0.09));
}

/** Kertas pengumuman yang disentuh: gemerisik singkat. */
export function kertas(x: number, y: number) {
  const j = buka('kertas', x, y, 110, 0.4);
  if (!j) return;
  for (let i = 0; i < 4; i++) letup(j, j.t + i * acak(0.04, 0.07), 'bandpass', acak(2500, 4500), 0.7, 0.12, 0.05);
}

/** Batu patung yang disentuh: gesek batu pelan. */
export function batu(x: number, y: number) {
  const j = buka('batu', x, y, 110, 0.3);
  if (!j) return;
  letup(j, j.t, 'lowpass', 900, 0.8, 0.25, 0.12);
  denting(j, j.t, [[240, 1, 0.1]], 0.15, 'triangle', 0.7);
}

/** Cangkul menghantam tanah garapan: debuk berat bercampur tanah. */
export function cangkul(x: number, y: number) {
  const j = buka('cangkul', x, y, 160, 0.3, true);
  if (!j) return;
  denting(j, j.t, [[95, 1, 0.12]], 0.4, 'sine', 0.6);
  letup(j, j.t, 'lowpass', 750, 0.8, 0.3, 0.12);
}

/** Tanaman dipanen, tercabut dari tanah: "pluk". */
export function pluk(x: number, y: number) {
  const j = buka('pluk', x, y, 140, 0.2, true);
  if (!j) return;
  const o = osilator(j, 'sine', 380, j.t, j.t + 0.08);
  o.frequency.exponentialRampToValueAtTime(900, j.t + 0.06);
  const g = penguat(j);
  pukul(g, j.t, 0.2, 0.08);
  o.connect(g).connect(j.out);
}

/** Telur retak di sarang. */
export function retakTelur(x: number, y: number) {
  const j = buka('retak', x, y, 120, 0.3);
  if (!j) return;
  for (let i = 0; i < 3; i++) letup(j, j.t + i * 0.05, 'highpass', 2500, 0.7, 0.2, 0.02);
}

/** Gelembung dari gurita di sungai: "blub". */
export function blub(x: number, y: number) {
  const j = buka('blub', x, y, 140, 0.4, true);
  if (!j) return;
  for (let i = 0; i < 3; i++) {
    const t = j.t + i * acak(0.07, 0.12);
    const o = osilator(j, 'sine', acak(260, 380), t, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(acak(700, 1000), t + 0.04);
    const g = penguat(j);
    pukul(g, t, 0.12, 0.05);
    o.connect(g).connect(j.out);
  }
}

/** Kresek kayu bakar di api unggun: satu letupan kecil. */
export function kresek(x: number, y: number, jangkau = 150) {
  const j = buka('kresek', x, y, jangkau, 0.1, true);
  if (!j) return;
  letup(j, j.t, 'highpass', acak(1500, 3500), 0.7, acak(0.12, 0.3), acak(0.008, 0.02));
}

/** Gemuruh api unggun: satu gelombang derau rendah yang pelan. */
export function gemuruhApi(x: number, y: number) {
  const j = buka('gemuruh', x, y, 130, 1.4, true);
  if (!j) return;
  const n = desir(j, j.t, 1.2);
  const s = saringan(j, 'lowpass', 420, 0.6);
  const g = penguat(j);
  selubung(g, j.t, 0.12, 0.3, 0.5, 0.4);
  n.connect(s).connect(g).connect(j.out);
}

/** Wajan nasi goreng dipukul sutil: "tek". */
export function tek(x: number, y: number) {
  const j = buka('tek', x, y, 230, 0.3);
  if (!j) return;
  denting(j, j.t, [
    [1720, 1, 0.12],
    [2630, 0.6, 0.08],
    [3900, 0.25, 0.05],
  ], 0.16, 'triangle');
  letup(j, j.t, 'highpass', 3000, 0.8, 0.15, 0.015);
}

/** Desis minyak panas di wajan. */
export function desis(x: number, y: number, lama = 1.4) {
  const j = buka('desis', x, y, 170, lama + 0.3, true);
  if (!j) return;
  const n = desir(j, j.t, lama);
  const s = saringan(j, 'highpass', 3200, 0.7);
  const g = penguat(j);
  selubung(g, j.t, 0.065, 0.08, lama - 0.4, 0.3);
  n.connect(s).connect(g).connect(j.out);
  // letupan minyak kecil-kecil di atasnya
  for (let i = 0; i < 6; i++) letup(j, j.t + acak(0.05, lama - 0.2), 'highpass', 4000, 1, 0.08, 0.012);
}

/**
 * Kembang api lidi yang menyala: desis tajam penuh letupan kecil. Satu
 * panggilan = satu detik nyala; pemanggil mengulanginya selama batangnya
 * masih terbakar.
 */
export function kembangApi(x: number, y: number) {
  const j = buka('kembang_api', x, y, 180, 1.3, true);
  if (!j) return;
  const n = desir(j, j.t, 1);
  const s = saringan(j, 'bandpass', 5200, 0.8);
  const g = penguat(j);
  selubung(g, j.t, 0.06, 0.05, 0.75, 0.2);
  n.connect(s).connect(g).connect(j.out);
  for (let i = 0; i < 14; i++) letup(j, j.t + acak(0, 0.95), 'highpass', acak(3000, 6000), 1, acak(0.05, 0.14), 0.01);
}

/** Aliran sungai: desir air yang terus mengalir, makin keras makin dekat. */
export const aliranSungai = latarTetap((c, ke) => {
  const s = c.createBufferSource();
  s.buffer = derau(c);
  s.loop = true;
  const rendah = c.createBiquadFilter();
  rendah.type = 'lowpass';
  rendah.frequency.value = 900;
  const tengah = c.createBiquadFilter();
  tengah.type = 'peaking';
  tengah.frequency.value = 420;
  tengah.gain.value = 6;
  // gemericik: kerasnya berombak pelan, tidak rata seperti desis radio
  const ombak = c.createOscillator();
  ombak.frequency.value = 0.35;
  const dalam = c.createGain();
  dalam.gain.value = 0.25;
  const g = c.createGain();
  g.gain.value = 0.6;
  ombak.connect(dalam).connect(g.gain);
  s.connect(rendah).connect(tengah).connect(g).connect(ke);
  s.start();
  ombak.start();
});

/* ================================================================= */
/*                          SUARA ORANG                               */
/* ================================================================= */

/** Nada dasar suara tiap jenis warga, Hz. */
export const SUARA_ORANG = {
  kakek: 118,
  bapak: 138,
  pria: 150,
  wanita: 225,
  anak: 290,
} as const;
export type JenisSuara = keyof typeof SUARA_ORANG;

/**
 * Tawa "ha-ha-ha-ha": empat-lima suku kata "ha", tiap suku kata diawali
 * desah dan nadanya melonjak lalu turun, makin ke belakang makin rendah dan
 * pelan — seperti tawa yang pelan-pelan reda.
 */
export function tawa(x: number, y: number, jenis: JenisSuara = 'bapak', mulai = 0) {
  const j = buka('tawa', x, y, 200, 1.6);
  if (!j) return;
  const dasar = SUARA_ORANG[jenis] * acak(0.95, 1.08);
  const n = Math.round(acak(4, 6));
  const jarak = acak(0.14, 0.18);
  for (let i = 0; i < n; i++) {
    const t = j.t + mulai + i * jarak;
    const f = dasar * (1.45 - i * 0.07) * acak(0.97, 1.03);
    ucap(j, {
      t,
      lama: jarak * 0.72,
      nada: [
        [0, f * 1.12],
        [0.35, f],
        [1, f * 0.86],
      ],
      formant: [
        [VOKAL.a[0], 7, 1],
        [VOKAL.a[1], 9, 0.55],
        [2600, 10, 0.18],
      ],
      kuat: 0.55 * (1 - i * 0.1),
      serang: 0.012,
      lepas: 0.04,
      desah: 0.9,
    });
  }
}

/**
 * Gumam obrolan: suku kata yang tidak bermakna dengan vokal dan nada acak,
 * seperti suara warga di gim-gim desa — terdengar sedang bicara tanpa ada
 * kata yang bisa ditangkap, jadi tidak mengganggu dan tidak perlu
 * diterjemahkan.
 */
export function gumam(x: number, y: number, jenis: JenisSuara = 'pria', suku = 0, pelan = 1) {
  const j = buka('gumam', x, y, 170, 1.4, false, pelan);
  if (!j) return;
  const dasar = SUARA_ORANG[jenis];
  const n = suku || Math.round(acak(3, 6));
  let t = j.t;
  const huruf = Object.keys(VOKAL) as Vokal[];
  for (let i = 0; i < n; i++) {
    const v = VOKAL[huruf[Math.floor(Math.random() * huruf.length)]];
    const lama = acak(0.07, 0.12);
    const f = dasar * acak(0.9, 1.25) * (i === n - 1 ? 0.9 : 1);
    ucap(j, {
      t,
      lama,
      nada: [
        [0, f],
        [1, f * acak(0.9, 1.1)],
      ],
      formant: [
        [v[0], 5, 1],
        [v[1], 7, 0.5],
      ],
      kuat: 0.32,
      serang: 0.012,
      lepas: 0.03,
    });
    t += lama + acak(0.02, 0.05);
  }
}

/* ================================================================= */
/*                          SUARA HEWAN                               */
/* ================================================================= */

/** Anjing: "guk!" — `kali` gonggongan beruntun. */
export function guk(x: number, y: number, kali = 1) {
  const j = buka('guk', x, y, 220, 0.3 + kali * 0.25);
  if (!j) return;
  for (let i = 0; i < kali; i++) {
    const t = j.t + i * acak(0.2, 0.26);
    const f = acak(360, 430);
    ucap(j, {
      t,
      lama: 0.13,
      nada: [
        [0, f * 0.8],
        [0.25, f],
        [1, f * 0.6],
      ],
      formant: [
        [850, 4, 1],
        [1700, 6, 0.6],
      ],
      kuat: 0.8,
      serang: 0.006,
      lepas: 0.06,
      desah: 0.7,
    });
  }
}

/** Anjing kecil yang mengigau dalam tidur: dengking pelan. */
export function dengking(x: number, y: number) {
  const j = buka('dengking', x, y, 100, 0.5, true);
  if (!j) return;
  ucap(j, {
    t: j.t,
    lama: 0.3,
    nada: [
      [0, 700],
      [0.5, 900],
      [1, 620],
    ],
    formant: [[1400, 5, 1]],
    kuat: 0.14,
    serang: 0.05,
    lepas: 0.12,
  });
}

/** Kucing: "meong" — nadanya naik lalu turun, mulut membuka lalu menutup. */
export function meong(x: number, y: number) {
  const j = buka('meong', x, y, 180, 0.9);
  if (!j) return;
  const f = acak(520, 620);
  const lama = acak(0.5, 0.65);
  ucap(j, {
    t: j.t,
    lama,
    nada: [
      [0, f],
      [0.3, f * 1.35],
      [1, f * 0.8],
    ],
    formant: [
      [700, 1700, 5, 1],
      [1500, 2900, 7, 0.5],
    ],
    kuat: 0.45,
    serang: 0.07,
    lepas: 0.18,
  });
}

/** Induk ayam: "petok-petok" — beberapa kotek pendek, kadang ditutup kotek panjang. */
export function petok(x: number, y: number, panjang = Math.random() < 0.3) {
  const j = buka('petok', x, y, 160, 1.2, true);
  if (!j) return;
  const n = Math.round(acak(2, 4));
  let t = j.t;
  for (let i = 0; i < n; i++) {
    const f = acak(300, 360);
    ucap(j, {
      t,
      lama: 0.07,
      nada: [
        [0, f * 1.2],
        [1, f],
      ],
      formant: [
        [1050, 5, 1],
        [2300, 7, 0.5],
      ],
      kuat: 0.35,
      serang: 0.005,
      lepas: 0.03,
    });
    t += acak(0.12, 0.18);
  }
  if (panjang) {
    ucap(j, {
      t: t + 0.05,
      lama: 0.28,
      nada: [
        [0, 380],
        [0.3, 560],
        [1, 470],
      ],
      formant: [
        [1150, 5, 1],
        [2500, 7, 0.5],
      ],
      kuat: 0.4,
      serang: 0.02,
      lepas: 0.08,
    });
  }
}

/**
 * Ayam jago berkokok: "ku-ku-ru-yuuuk", suku terakhir panjang, serak, dan
 * menurun di ujungnya. Dibunyikan saat fajar, waktu ayam turun dari
 * tenggerannya.
 */
export function kokok(x: number, y: number) {
  const j = buka('kokok', x, y, 320, 1.8);
  if (!j) return;
  const suku: [number, number, number, number][] = [
    // mulai, lama, nada awal, nada akhir
    [0, 0.13, 520, 600],
    [0.17, 0.13, 640, 700],
    [0.34, 0.2, 700, 780],
    [0.58, 0.72, 820, 520],
  ];
  for (const [m, l, a, b] of suku) {
    ucap(j, {
      t: j.t + m,
      lama: l,
      nada: [
        [0, a],
        [0.3, (a + b) / 2 + 40],
        [1, b],
      ],
      formant: [
        [900, 5, 1],
        [2100, 6, 0.6],
        [3200, 8, 0.2],
      ],
      kuat: 0.5,
      serang: 0.02,
      lepas: l > 0.5 ? 0.25 : 0.04,
      getar: [38, 18],
      desah: 0.3,
    });
  }
}

/** Anak ayam: "ciap-ciap" nyaring. */
export function ciap(x: number, y: number) {
  const j = buka('ciap', x, y, 120, 0.6, true);
  if (!j) return;
  const n = Math.round(acak(2, 3));
  for (let i = 0; i < n; i++) {
    const t = j.t + i * acak(0.12, 0.18);
    const o = osilator(j, 'sine', acak(3100, 3500), t, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(acak(3900, 4400), t + 0.03);
    o.frequency.exponentialRampToValueAtTime(3300, t + 0.07);
    const g = penguat(j);
    selubung(g, t, 0.11, 0.008, 0.04, 0.02);
    o.connect(g).connect(j.out);
  }
}

/** Sapi melenguh: "mbooo" yang dalam, pelan membuka. */
export function lenguh(x: number, y: number) {
  const j = buka('lenguh', x, y, 220, 1.8, true);
  if (!j) return;
  const f = acak(100, 125);
  const lama = acak(1.1, 1.5);
  ucap(j, {
    t: j.t,
    lama,
    nada: [
      [0, f * 0.9],
      [0.35, f * 1.12],
      [1, f * 0.82],
    ],
    formant: [
      [320, 720, 4, 1],
      [700, 1100, 5, 0.45],
    ],
    kuat: 0.6,
    serang: 0.22,
    lepas: 0.4,
    getar: [5, 2],
  });
}

/** Bebek: "kwek-kwek" sengau. */
export function kwek(x: number, y: number, kali = 2) {
  const j = buka('kwek', x, y, 180, 0.9, true);
  if (!j) return;
  for (let i = 0; i < kali; i++) {
    const f = acak(360, 420);
    ucap(j, {
      t: j.t + i * acak(0.17, 0.22),
      lama: 0.12,
      nada: [
        [0, f],
        [1, f * 0.85],
      ],
      formant: [
        [1200, 4, 1],
        [2500, 6, 0.6],
      ],
      kuat: 0.4,
      serang: 0.008,
      lepas: 0.04,
      desah: 0.4,
    });
  }
}

/** Pipit berkicau: "cuit-cuit" kecil yang cepat. */
export function cuit(x: number, y: number) {
  const j = buka('cuit', x, y, 150, 0.5, true);
  if (!j) return;
  const n = Math.round(acak(2, 4));
  for (let i = 0; i < n; i++) {
    const t = j.t + i * acak(0.07, 0.11);
    const a = acak(3600, 4200);
    const o = osilator(j, 'sine', a, t, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(a * acak(1.2, 1.35), t + 0.02);
    o.frequency.exponentialRampToValueAtTime(a * 0.95, t + 0.045);
    const g = penguat(j);
    selubung(g, t, 0.09, 0.005, 0.025, 0.015);
    o.connect(g).connect(j.out);
  }
}

/** Kepak sayap burung yang kabur: derai derau yang cepat. */
export function kepak(x: number, y: number) {
  const j = buka('kepak', x, y, 120, 0.5, true);
  if (!j) return;
  for (let i = 0; i < 5; i++) letup(j, j.t + i * 0.045, 'bandpass', 1100, 0.8, 0.32 * (1 - i * 0.15), 0.035);
}

/** Dengung lebah yang lewat. */
export function dengung(x: number, y: number) {
  const j = buka('dengung', x, y, 90, 1.2, true);
  if (!j) return;
  const lama = acak(0.6, 1);
  const o = osilator(j, 'sawtooth', acak(210, 250), j.t, j.t + lama);
  const lfo = osilator(j, 'sine', acak(9, 14), j.t, j.t + lama);
  const dalam = j.c.createGain();
  dalam.gain.value = 12;
  lfo.connect(dalam).connect(o.frequency);
  const s = saringan(j, 'lowpass', 1400, 1);
  const g = penguat(j);
  selubung(g, j.t, 0.09, lama * 0.4, 0, lama * 0.6);
  o.connect(s).connect(g).connect(j.out);
}

/* ---------------- suara malam ---------------- */

/**
 * Jangkrik: satu "krik" = tiga-empat denyut sinus bernada tinggi yang
 * rapat. Tiap ekor punya nada sendiri, jadi paduannya tidak terdengar
 * seperti satu jangkrik yang diputar ulang.
 */
export function krik(x: number, y: number, nada: number, jangkau = 170, keras = 1) {
  const j = buka('krik', x, y, jangkau, 0.3, true, keras);
  if (!j) return;
  const o = osilator(j, 'sine', nada, j.t, j.t + 0.2);
  const g = penguat(j);
  const denyut = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < denyut; i++) {
    const t = j.t + i * 0.034;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.006);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.022);
  }
  o.connect(g).connect(j.out);
}

/**
 * Kodok: "krok" — getaran kasar bernada rendah (denyut cepat yang
 * dimodulasi), disaring supaya berbunyi seperti rongga kantung suaranya.
 */
export function krok(x: number, y: number, nada = 1, kali = 2) {
  const j = buka('krok', x, y, 190, 1, true);
  if (!j) return;
  for (let i = 0; i < kali; i++) {
    const t = j.t + i * acak(0.24, 0.3);
    const lama = acak(0.13, 0.18);
    const o = osilator(j, 'sawtooth', 150 * nada, t, t + lama);
    o.frequency.exponentialRampToValueAtTime(125 * nada, t + lama);
    // denyut kasar ~28 kali sedetik: "rrrok", bukan dengung halus
    const am = osilator(j, 'square', acak(26, 32), t, t + lama);
    const amG = j.c.createGain();
    amG.gain.value = 0.5;
    const g = penguat(j);
    selubung(g, t, 0.32, 0.015, lama - 0.06, 0.045);
    const bawa = j.c.createGain();
    bawa.gain.value = 0.5;
    am.connect(amG).connect(bawa.gain);
    const s = saringan(j, 'bandpass', 620 * nada, 3);
    const s2 = saringan(j, 'bandpass', 1400 * nada, 5);
    const s2g = j.c.createGain();
    s2g.gain.value = 0.4;
    o.connect(bawa);
    bawa.connect(s).connect(g);
    bawa.connect(s2).connect(s2g).connect(g);
    g.connect(j.out);
  }
}

/**
 * Tokek: dengkur "krrrr" pembuka, lalu "to-kek" berulang yang makin
 * lambat dan makin lemah — persis tokek sungguhan yang kehabisan napas.
 * `ulang` = berapa kali "to-kek"-nya. Mengembalikan jadwal tiap "to-kek"
 * (detik dari sekarang) supaya gambarnya bisa ikut menggembung.
 */
export function tokek(x: number, y: number, ulang = 5): number[] {
  const jadwal: number[] = [];
  let t = 0.55;
  for (let i = 0; i < ulang; i++) {
    jadwal.push(t);
    t += 0.62 + i * 0.07;
  }
  const j = buka('tokek', x, y, 240, t + 0.5);
  if (!j) return jadwal;
  // dengkur pembuka
  {
    const n = desir(j, j.t, 0.4);
    const s = saringan(j, 'bandpass', 700, 2);
    const g = penguat(j);
    selubung(g, j.t, 0.18, 0.05, 0.25, 0.1);
    const am = osilator(j, 'square', 34, j.t, j.t + 0.4);
    const amG = j.c.createGain();
    amG.gain.value = 0.09;
    am.connect(amG).connect(g.gain);
    n.connect(s).connect(g).connect(j.out);
  }
  jadwal.forEach((w, i) => {
    const lemah = 1 - i * 0.1;
    ucap(j, {
      t: j.t + w,
      lama: 0.11,
      nada: [
        [0, 190],
        [1, 150],
      ],
      formant: [
        [650, 5, 1],
        [1100, 6, 0.4],
      ],
      kuat: 0.55 * lemah,
      serang: 0.008,
      lepas: 0.04,
      desah: 0.2,
    });
    ucap(j, {
      t: j.t + w + 0.16,
      lama: 0.16,
      nada: [
        [0, 270],
        [0.4, 300],
        [1, 230],
      ],
      formant: [
        [520, 1500, 5, 1],
        [2400, 7, 0.45],
      ],
      kuat: 0.6 * lemah,
      serang: 0.01,
      lepas: 0.06,
      desah: 0.35,
    });
  });
  return jadwal;
}

/** Burung hantu: "hu... huuu" — lembut, bernada sedang, yang kedua lebih panjang. */
export function huhu(x: number, y: number) {
  const j = buka('huhu', x, y, 260, 1.6);
  if (!j) return;
  const f = acak(370, 410);
  for (const [m, l, k] of [
    [0, 0.22, 0.8],
    [0.42, 0.62, 1],
  ]) {
    ucap(j, {
      t: j.t + m,
      lama: l,
      nada: [
        [0, f * 1.04],
        [0.4, f],
        [1, f * 0.93],
      ],
      formant: [[f * 1.02, 2.5, 1]],
      kuat: 0.28 * k,
      serang: 0.06,
      lepas: 0.14,
      getar: [5.5, 4],
      jenis: 'triangle',
      desah: 0.12,
    });
  }
}

/** Cicit kelelawar: sangat tinggi dan singkat, nyaris tak terdengar. */
export function cicitKelelawar(x: number, y: number) {
  const j = buka('kelelawar', x, y, 110, 0.2, true);
  if (!j) return;
  const o = osilator(j, 'sine', acak(7200, 8600), j.t, j.t + 0.03);
  o.frequency.exponentialRampToValueAtTime(acak(5500, 6200), j.t + 0.025);
  const g = penguat(j);
  pukul(g, j.t, 0.05, 0.03);
  o.connect(g).connect(j.out);
}

/* ---------------- tes ---------------- */

/**
 * Rekam sebuah bunyi ke memori tanpa memutarnya — untuk tes di browser
 * (lihat tools/uji-bunyi). Mengembalikan puncak dan RMS tiap kanal, supaya
 * tes bisa memastikan bunyinya tidak sunyi dan tidak pecah.
 */
export async function rekamUji(nama: string, detik = 2) {
  const c = new OfflineAudioContext(2, Math.ceil(44100 * detik), 44100);
  const keran = c.createGain();
  keran.gain.value = 0.55;
  keran.connect(c.destination);
  pasangUji({ ctx: c, keran });
  paksaDekat = true;
  try {
    const f = (DAFTAR_UJI as Record<string, () => unknown>)[nama];
    if (!f) throw new Error(`bunyi tidak dikenal: ${nama}`);
    f();
  } finally {
    paksaDekat = false;
    pasangUji(null);
  }
  const buf = await c.startRendering();
  const d = buf.getChannelData(0);
  let puncak = 0;
  let jumlah = 0;
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    if (v > puncak) puncak = v;
    jumlah += v * v;
  }
  return { nama, puncak, rms: Math.sqrt(jumlah / d.length), sampel: d };
}

/** Semua bunyi dengan argumen contoh — dipakai rekamUji. */
export const DAFTAR_UJI = {
  ting: () => ting(0, 0),
  tok: () => tok(0, 0),
  kring: () => kring(0, 0),
  derit: () => derit(0, 0),
  debam: () => debam(0, 0),
  katrol: () => cicitKatrol(0, 0),
  byur: () => byur(0, 0),
  tetes: () => tetes(0, 0),
  cebur: () => cebur(0, 0),
  klontang: () => klontang(0, 0),
  klik: () => klik(0, 0),
  tali: () => deritTali(0, 0),
  debuk: () => debuk(0, 0),
  tak: () => tak(0, 0),
  ketik: () => ketik(0, 0),
  sukses: () => sukses(0, 0),
  kilau: () => kilau(0, 0),
  kertas: () => kertas(0, 0),
  batu: () => batu(0, 0),
  cangkul: () => cangkul(0, 0),
  pluk: () => pluk(0, 0),
  retak: () => retakTelur(0, 0),
  blub: () => blub(0, 0),
  kresek: () => kresek(0, 0),
  gemuruh: () => gemuruhApi(0, 0),
  tek: () => tek(0, 0),
  desis: () => desis(0, 0),
  kembang_api: () => kembangApi(0, 0),
  tawa: () => tawa(0, 0),
  gumam: () => gumam(0, 0),
  guk: () => guk(0, 0, 2),
  dengking: () => dengking(0, 0),
  meong: () => meong(0, 0),
  petok: () => petok(0, 0, true),
  kokok: () => kokok(0, 0),
  ciap: () => ciap(0, 0),
  lenguh: () => lenguh(0, 0),
  kwek: () => kwek(0, 0),
  cuit: () => cuit(0, 0),
  kepak: () => kepak(0, 0),
  dengung: () => dengung(0, 0),
  krik: () => krik(0, 0, 4600),
  krok: () => krok(0, 0),
  tokek: () => tokek(0, 0, 3),
  huhu: () => huhu(0, 0),
  kelelawar: () => cicitKelelawar(0, 0),
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__rekamBunyi = rekamUji;
  (window as unknown as Record<string, unknown>).__daftarBunyi = Object.keys(DAFTAR_UJI);
}
