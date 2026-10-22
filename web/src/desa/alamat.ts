/**
 * Alamat layanan "desa ramai" (terminal-server/desa/desa.mjs): pengunjung
 * live lewat WebSocket dan buku tamu. Tinggal di server yang sama dengan
 * terminal dan MATS-BOT, jadi bawaannya asal PUBLIC_TERMINAL_URL; untuk
 * menguji di laptop, isi PUBLIC_DESA_URL (mis. http://127.0.0.1:7683).
 * Kosong = kedua fitur diam: desanya tetap jalan seperti biasa.
 */
const mentah =
  (import.meta.env.PUBLIC_DESA_URL as string | undefined)?.trim() ||
  (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() ||
  '';

function asal(u: string) {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
}

export const ALAMAT_DESA = mentah ? asal(mentah) : '';
export const alamatWs = () => (ALAMAT_DESA ? ALAMAT_DESA.replace(/^http/, 'ws') + '/desa/ws' : '');

/** Satu pesan buku tamu, sama dengan yang disimpan server. */
export interface PesanTamu {
  id: string;
  nama: string;
  isi: string;
  t: number;
  lencana?: boolean;
}
