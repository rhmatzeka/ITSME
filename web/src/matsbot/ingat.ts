/**
 * Ingatan MATS-BOT tentang pengunjung — hanya di browser pengunjung itu
 * sendiri (localStorage), tidak pernah dikirim ke server.
 *
 * - Kunjungan: dihitung sekali per kunjungan (jeda lebih dari 30 menit
 *   dianggap kunjungan baru), supaya yang datang lagi disapa "Welcome back".
 * - Bahasa: bahasa pertanyaan terakhirnya, supaya MATS-BOT menyapa di desa
 *   dengan bahasa yang sama.
 * - Obrolan: beberapa pesan terakhir, ditampilkan lagi saat jendela obrolan
 *   dibuka di kunjungan berikutnya. Isian titip pesan (nama, kontak) tidak
 *   pernah ikut disimpan. Bisa dihapus lewat "Forget this chat".
 */
export type Bahasa = 'id' | 'en';
export type PesanLama = { peran: 'tamu' | 'bot'; teks: string };

const KUNCI = 'mapporto:matsbot';
const JEDA_KUNJUNGAN = 30 * 60_000;
const SIMPAN_PESAN = 24;

type Ingatan = { kunjungan: number; terakhir: number; bahasa?: Bahasa; obrolan: PesanLama[] };

function baca(): Ingatan {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI) ?? 'null') as Partial<Ingatan> | null;
    if (x && typeof x === 'object')
      return {
        kunjungan: Number(x.kunjungan) || 0,
        terakhir: Number(x.terakhir) || 0,
        bahasa: x.bahasa === 'id' || x.bahasa === 'en' ? x.bahasa : undefined,
        obrolan: Array.isArray(x.obrolan)
          ? x.obrolan.filter((m): m is PesanLama => !!m && (m.peran === 'tamu' || m.peran === 'bot') && typeof m.teks === 'string')
          : [],
      };
  } catch {
    /* diblokir atau rusak: mulai dari kosong */
  }
  return { kunjungan: 0, terakhir: 0, obrolan: [] };
}
function tulis(x: Ingatan) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(x));
  } catch {
    /* penyimpanan diblokir: MATS-BOT cuma lupa */
  }
}

let kunjunganIni: { ke: number; kembali: boolean } | undefined;
/**
 * Kunjungan keberapa ini. Dihitung sekali per halaman: panggilan berikutnya
 * mengembalikan hasil yang sama. `kembali`: pernah datang sebelumnya.
 */
export function kunjungan() {
  if (kunjunganIni) return kunjunganIni;
  const x = baca();
  const kini = Date.now();
  if (kini - x.terakhir > JEDA_KUNJUNGAN) x.kunjungan++;
  x.terakhir = kini;
  tulis(x);
  kunjunganIni = { ke: x.kunjungan, kembali: x.kunjungan > 1 };
  return kunjunganIni;
}

/** Bahasa pengunjung: dari pertanyaan terakhirnya, kalau belum pernah bertanya dari bahasa browser. */
export function bahasa(): Bahasa {
  return baca().bahasa ?? (/^(id|ms)\b/i.test(navigator.language || '') ? 'id' : 'en');
}
export function ingatBahasa(b: Bahasa) {
  const x = baca();
  if (x.bahasa === b) return;
  tulis({ ...x, bahasa: b });
}

export function obrolanLama(): PesanLama[] {
  return baca().obrolan;
}
export function simpanObrolan(pesan: PesanLama[]) {
  const x = baca();
  x.obrolan = pesan.slice(-SIMPAN_PESAN).map((m) => ({ peran: m.peran, teks: m.teks.slice(0, 800) }));
  x.terakhir = Date.now();
  tulis(x);
}
export function lupakanObrolan() {
  const x = baca();
  tulis({ ...x, obrolan: [] });
}
