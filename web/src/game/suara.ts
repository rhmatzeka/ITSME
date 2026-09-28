import { aset } from './aset';

/**
 * Suara: musik latar yang berputar terus, dan efek pendek saat tombol ditekan
 * atau petir menyambar.
 *
 * Sengaja TIDAK lewat sound manager Phaser, karena dua alasan:
 *
 *  1. Tombol menunya ada di DOM, bukan di dalam kanvas. Lewat modul lepas
 *     seperti ini, sebuah klik tombol tidak perlu pegangan ke scene mana pun.
 *  2. Phaser mendekode tiap berkas jadi PCM utuh di memori. Musiknya dua menit
 *     44,1 kHz stereo — sekitar 40 MB kalau dibentangkan, dari berkas yang di
 *     disk cuma 4,7 MB. Mahal sekali untuk ponsel. Di sini musiknya dialirkan
 *     lewat <audio> (dibaca sambil diputar, tidak pernah utuh di memori),
 *     sementara dua efeknya — total 18 KB — memang didekode, karena justru
 *     harus berbunyi seketika tanpa jeda muat.
 */

type Efek = 'klik' | 'petir';

const BERKAS: Record<Efek, string> = {
  klik: 'audio/klikmenu.mp3',
  petir: 'audio/kilatteleport.mp3',
};

/**
 * Musik ditahan jauh di bawah efek. Dia latar, bukan acara utamanya: kalau
 * disamakan, gelegar petirnya tenggelam dan yang terdengar cuma lagu.
 */
const VOLUME = { musik: 0.3, efek: 0.55 } as const;

const KUNCI = 'mapporto:bisu';
const KUNCI_VOL = 'mapporto:volume';

const mentah: Partial<Record<Efek, ArrayBuffer>> = {};
const bank: Partial<Record<Efek, AudioBuffer>> = {};
let ctx: AudioContext | null = null;
let keran: GainNode | null = null;
let musik: HTMLAudioElement | null = null;

let bisu = false;
/**
 * Pengali volume pilihan pengunjung, 0..1. Dikalikan dengan angka di VOLUME,
 * bukan menggantikannya: perbandingan antara musik dan efek sudah ditimbang,
 * dan menggesernya turun tidak boleh mengubah perbandingan itu.
 */
let volume = 1;
try {
  bisu = localStorage.getItem(KUNCI) === '1';
  /*
   * Diperiksa null lebih dulu, bukan langsung dilewatkan Number().
   * `Number(null)` bernilai 0 — terhingga, dan masuk rentang 0..1 — jadi
   * pengunjung yang belum pernah menyentuh pengatur volume akan dianggap
   * sudah mengecilkannya sampai habis, dan seluruh situs jadi bisu diam-diam.
   */
  const simpanan = localStorage.getItem(KUNCI_VOL);
  if (simpanan !== null) {
    const v = Number(simpanan);
    if (Number.isFinite(v) && v >= 0 && v <= 1) volume = v;
  }
} catch {
  /* localStorage bisa diblokir; bukan alasan gagal berbunyi */
}

/**
 * Ambil berkas efeknya lebih awal, tapi jangan didekode dulu.
 *
 * Mendekode butuh AudioContext, dan AudioContext yang dibuat sebelum
 * pengunjung menyentuh apa pun lahir dalam keadaan tertahan — browser memang
 * melarang halaman berbunyi sendiri. Jadi yang dikerjakan di sini cuma
 * unduhannya (18 KB, tidak terasa di bar loading); dekodenya menunggu tombol
 * PLAY ditekan, dan itu cuma sepersekian milidetik.
 */
export function siapkan() {
  for (const nama of Object.keys(BERKAS) as Efek[]) {
    if (mentah[nama]) continue;
    fetch(aset(BERKAS[nama]))
      .then((r) => r.arrayBuffer())
      .then((b) => {
        mentah[nama] = b;
        dekode(nama);
      })
      .catch(() => {
        /* suara hilang tidak boleh menjatuhkan permainan */
      });
  }
}

function dekode(nama: Efek) {
  const b = mentah[nama];
  if (!ctx || !b || bank[nama]) return;
  // decodeAudioData mengambil alih buffer-nya sampai kosong, jadi disalin dulu
  ctx
    .decodeAudioData(b.slice(0))
    .then((buf) => {
      bank[nama] = buf;
    })
    .catch(() => {});
}

/**
 * Nyalakan sistem suaranya. HARUS dipanggil dari dalam penanganan klik atau
 * tekan tombol — bukan sesudahnya lewat timer — karena di situlah browser
 * memberi izin berbunyi. Tempatnya: tombol PLAY di layar judul.
 */
export function mulai() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    keran = ctx.createGain();
    keran.gain.value = bisu ? 0 : VOLUME.efek * volume;
    /*
     * Penahan puncak sebelum speaker. Efek berkas (klik, petir) sudah
     * ditakar, tapi bunyi sintesis desa bisa menumpuk — kentongan, gonggong,
     * dan tawa di detik yang sama — dan tanpa ini jumlahnya pecah.
     */
    const tahan = ctx.createDynamicsCompressor();
    tahan.threshold.value = -10;
    tahan.knee.value = 8;
    tahan.ratio.value = 6;
    tahan.attack.value = 0.004;
    tahan.release.value = 0.2;
    keran.connect(tahan).connect(ctx.destination);
    for (const nama of Object.keys(BERKAS) as Efek[]) dekode(nama);
  }
  void ctx.resume();

  if (!musik) {
    musik = new Audio(aset('audio/musik.mp3'));
    musik.loop = true;
    musik.volume = VOLUME.musik * volume;
  }
  putarMusik();
}

function putarMusik() {
  // Ditolak kalau izinnya belum ada — itu jawaban yang wajar, bukan galat.
  if (musik && !bisu && !document.hidden) musik.play().catch(() => {});
}

/** Bunyikan satu efek. Aman dipanggil kapan pun, termasuk sebelum `mulai()`. */
export function efek(nama: Efek) {
  const buf = bank[nama];
  if (!ctx || !keran || !buf || bisu) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const sumber = ctx.createBufferSource();
  sumber.buffer = buf;
  sumber.connect(keran);
  sumber.start();
}

/* ---------------- saluran untuk bunyi sintesis (bunyi.ts) ---------------- */

/**
 * Batas atas suara sintesis yang berbunyi bersamaan. Malam hari jangkrik,
 * kodok, api unggun, dan tokek bisa jatuh di detik yang sama; di ponsel
 * puluhan osilator sekaligus terdengar sebagai kresek. Yang lewat batas
 * dilewati saja — bunyi latar yang hilang satu tidak ada yang merasa.
 */
const BATAS_SUARA = 48;
let berbunyi = 0;

/** Konteks pengganti saat merekam bunyi untuk dites — lihat `rekamUji()` di bunyi.ts. */
let uji: { ctx: BaseAudioContext; keran: AudioNode } | null = null;

export interface Jalur {
  c: BaseAudioContext;
  /** Masukan saluran: sambungkan bunyi ke sini. */
  out: AudioNode;
  /** Waktu mulai, detik di jam konteksnya. */
  t: number;
}

/**
 * Buka satu saluran untuk sebuah bunyi: penguat sekeras `kuat` (0..1, dari
 * jarak) dan penggeser kiri-kanan `pan` (-1..1), menuju `keran` bersama —
 * jadi ikut bisu dan pengatur volume seperti efek lain. Mengembalikan null
 * kalau bunyinya tidak perlu dibuat sama sekali: sistem suara belum
 * dinyalakan, bisu, terlalu jauh, atau sedang terlalu ramai (`latar`).
 *
 * Simpulnya dilepas sendiri sesudah `lama` detik, supaya grafik audionya
 * tidak menumpuk selama pengunjung berlama-lama di desa.
 */
export function saluran(kuat: number, pan = 0, lama = 2, latar = false): Jalur | null {
  const c = uji?.ctx ?? ctx;
  const ujung = uji?.keran ?? keran;
  if (!c || !ujung || kuat <= 0.02) return null;
  if (!uji) {
    if (bisu || document.hidden) return null;
    if (latar && berbunyi >= BATAS_SUARA * 0.6) return null;
    if (berbunyi >= BATAS_SUARA) return null;
    if ((c as AudioContext).state === 'suspended') void (c as AudioContext).resume();
  }
  const g = c.createGain();
  g.gain.value = Math.min(1, kuat);
  let akhir: AudioNode = g;
  if (pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    akhir = p;
  }
  akhir.connect(ujung);
  if (!uji) {
    berbunyi++;
    setTimeout(() => {
      berbunyi--;
      g.disconnect();
      if (akhir !== g) akhir.disconnect();
    }, lama * 1000 + 200);
  }
  return { c, out: g, t: c.currentTime + 0.01 };
}

const bankDerau = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Derau putih dua detik, dibuat sekali per konteks — bahan cipratan, desis, dan kresek. */
export function derau(c: BaseAudioContext) {
  let b = bankDerau.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    bankDerau.set(c, b);
  }
  return b;
}

/**
 * Suara latar yang terus berbunyi (aliran sungai): sebuah simpul penguat
 * yang tetap tersambung selama kunjungan. `buat` merangkai sumbernya sekali,
 * begitu sistem suara menyala. Kerasnya diatur lewat `setel()` tiap
 * beberapa ratus milidetik; bisu dan tab tersembunyi ditangani `keran`.
 */
export function latarTetap(buat: (c: BaseAudioContext, ke: AudioNode) => void) {
  let g: GainNode | null = null;
  let p: StereoPannerNode | null = null;
  return {
    setel(kuat: number, pan = 0) {
      if (!ctx || !keran) return;
      if (!g) {
        g = ctx.createGain();
        g.gain.value = 0;
        p = ctx.createStereoPanner();
        g.connect(p).connect(keran);
        buat(ctx, g);
      }
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(Math.max(0, kuat), t, 0.4);
      p?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.4);
    },
  };
}

/** Pasang konteks pengganti untuk merekam (null = kembali ke yang asli). */
export function pasangUji(k: { ctx: BaseAudioContext; keran: AudioNode } | null) {
  uji = k;
}

export function sedangBisu() {
  return bisu;
}

export function volumeSekarang() {
  return volume;
}

/**
 * Geser volume. Menaikkannya dari nol sekalian melepas bisu — kalau tidak,
 * menggeser sampai penuh tapi tetap sunyi terbaca sebagai rusak.
 */
export function setelVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(KUNCI_VOL, String(volume));
  } catch {
    /* tidak tersimpan, tapi tetap berlaku selama kunjungan ini */
  }
  if (keran && !bisu) keran.gain.value = VOLUME.efek * volume;
  if (musik) musik.volume = VOLUME.musik * volume;
  if (volume > 0 && bisu) setelBisu(false);
}

export function setelBisu(diam: boolean) {
  bisu = diam;
  try {
    localStorage.setItem(KUNCI, diam ? '1' : '0');
  } catch {
    /* pilihannya tidak tersimpan, tapi tetap berlaku selama kunjungan ini */
  }
  // suara latar yang terus mengalir ikut diam lewat keran, bukan cuma bunyi baru
  if (keran) keran.gain.value = diam ? 0 : VOLUME.efek * volume;
  if (!musik) return;
  if (diam) musik.pause();
  else putarMusik();
}

/*
 * Tab yang ditinggalkan berhenti bernyanyi.
 *
 * Musik yang terus mengalir dari tab yang sudah lama tidak dilihat adalah
 * gangguan klasik — dan orang biasanya menutup tabnya, bukan mencari tombol
 * bisunya. Dijeda, bukan dimatikan: kembali ke tab ini melanjutkan dari
 * tempatnya berhenti.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // aliran sungai dan jangkrik juga berhenti, bukan cuma musiknya
    if (ctx) void (document.hidden ? ctx.suspend() : ctx.resume());
    if (!musik) return;
    if (document.hidden) musik.pause();
    else putarMusik();
  });
}
