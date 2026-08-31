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

const mentah: Partial<Record<Efek, ArrayBuffer>> = {};
const bank: Partial<Record<Efek, AudioBuffer>> = {};
let ctx: AudioContext | null = null;
let keran: GainNode | null = null;
let musik: HTMLAudioElement | null = null;

let bisu = false;
try {
  bisu = localStorage.getItem(KUNCI) === '1';
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
    keran.gain.value = VOLUME.efek;
    keran.connect(ctx.destination);
    for (const nama of Object.keys(BERKAS) as Efek[]) dekode(nama);
  }
  void ctx.resume();

  if (!musik) {
    musik = new Audio(aset('audio/musik.mp3'));
    musik.loop = true;
    musik.volume = VOLUME.musik;
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

export function sedangBisu() {
  return bisu;
}

export function setelBisu(diam: boolean) {
  bisu = diam;
  try {
    localStorage.setItem(KUNCI, diam ? '1' : '0');
  } catch {
    /* pilihannya tidak tersimpan, tapi tetap berlaku selama kunjungan ini */
  }
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
    if (!musik) return;
    if (document.hidden) musik.pause();
    else putarMusik();
  });
}
