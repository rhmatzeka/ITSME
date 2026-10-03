/**
 * Suara untuk MATS-BOT: bicara lewat mikrofon, dan jawabannya dibacakan.
 *
 * Semuanya fitur bawaan browser (Web Speech API), tanpa server dan tanpa
 * biaya: pengenal ucapan (SpeechRecognition — Chrome, Edge, Safari; tidak
 * ada di Firefox, tombol mikrofonnya lalu disembunyikan) dan pembaca teks
 * (speechSynthesis — hampir semua browser). Bahasanya mengikuti bahasa
 * pengunjung: id-ID atau en-US.
 */
import type { Bahasa } from './ingat';

type Pengenal = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type PembuatPengenal = new () => Pengenal;

const Pembuat = (): PembuatPengenal | undefined => {
  const w = window as unknown as { SpeechRecognition?: PembuatPengenal; webkitSpeechRecognition?: PembuatPengenal };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const bisaDengar = () => !!Pembuat();
export const bisaBaca = () => 'speechSynthesis' in window;

const LOGAT: Record<Bahasa, string> = { id: 'id-ID', en: 'en-US' };

/**
 * Dengarkan satu kalimat. `sela` menerima teks sementara (untuk ditampilkan
 * di kolom tanya selagi bicara), `selesai` teks akhirnya — kosong kalau
 * batal, tidak terdengar, atau izin mikrofon ditolak (`galat` diisi).
 * Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function dengar(b: Bahasa, sela: (t: string) => void, selesai: (t: string, galat?: string) => void) {
  const P = Pembuat();
  if (!P) {
    selesai('', 'tidak-didukung');
    return () => {};
  }
  const r = new P();
  r.lang = LOGAT[b];
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let akhir = '';
  let galat: string | undefined;
  r.onresult = (e) => {
    let sementara = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const h = e.results[i];
      if (h.isFinal) akhir += h[0].transcript;
      else sementara += h[0].transcript;
    }
    sela((akhir + sementara).trim());
  };
  r.onerror = (e) => {
    galat = e.error;
  };
  r.onend = () => selesai(akhir.trim(), galat);
  try {
    r.start();
  } catch {
    selesai('', 'gagal-mulai');
  }
  return () => r.stop();
}

/** Suara terbaik untuk bahasanya: yang lokal (tanpa internet) didahulukan. */
function pilihSuara(b: Bahasa) {
  const semua = speechSynthesis.getVoices();
  const cocok = semua.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(b));
  return cocok.find((v) => v.localService) ?? cocok[0];
}

/** Bacakan jawaban; yang sedang dibacakan sebelumnya dihentikan. */
export function baca(teks: string, b: Bahasa, mulai?: () => void, akhir?: () => void) {
  if (!bisaBaca()) return;
  speechSynthesis.cancel();
  // tautan dan tanda baca dekoratif tidak ikut dibacakan
  const bersih = teks
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•✓›↗]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!bersih) return;
  const u = new SpeechSynthesisUtterance(bersih.slice(0, 600));
  u.lang = LOGAT[b];
  const v = pilihSuara(b);
  if (v) u.voice = v;
  // suara robot kecil: sedikit lebih tinggi dan cepat dari biasanya
  u.pitch = 1.25;
  u.rate = 1.05;
  if (mulai) u.onstart = mulai;
  if (akhir) u.onend = u.onerror = akhir;
  speechSynthesis.speak(u);
}

export function diam() {
  if (bisaBaca()) speechSynthesis.cancel();
}

// daftar suara di Chrome baru terisi setelah event ini; dipanggil sekali supaya siap saat dibutuhkan
if (typeof window !== 'undefined' && bisaBaca()) speechSynthesis.getVoices();
