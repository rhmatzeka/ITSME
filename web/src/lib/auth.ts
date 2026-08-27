/**
 * Sesi admin: cookie yang ditandatangani, bukan basis data sesi.
 *
 * Isinya cuma waktu kedaluwarsa plus tanda tangan HMAC. Server tidak perlu
 * menyimpan apa pun, dan cookie yang diubah-ubah akan gagal verifikasi.
 */
const enc = new TextEncoder();

async function kunci(rahasia: string) {
  return crypto.subtle.importKey('raw', enc.encode(rahasia), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

const keHex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function buatSesi(rahasia: string, jamBerlaku = 12) {
  const kedaluwarsa = Date.now() + jamBerlaku * 3600_000;
  const tanda = await crypto.subtle.sign('HMAC', await kunci(rahasia), enc.encode(String(kedaluwarsa)));
  return `${kedaluwarsa}.${keHex(tanda)}`;
}

export async function sesiSah(rahasia: string, nilai: string | undefined) {
  if (!nilai) return false;
  const [kedaluwarsa, tanda] = nilai.split('.');
  if (!kedaluwarsa || !tanda) return false;
  if (Number(kedaluwarsa) < Date.now()) return false;
  const harusnya = keHex(
    await crypto.subtle.sign('HMAC', await kunci(rahasia), enc.encode(kedaluwarsa))
  );
  // panjangnya tetap, jadi perbandingan waktu-tetap sederhana sudah cukup
  if (harusnya.length !== tanda.length) return false;
  let beda = 0;
  for (let i = 0; i < tanda.length; i++) beda |= harusnya.charCodeAt(i) ^ tanda.charCodeAt(i);
  return beda === 0;
}

/** Bandingkan password tanpa membocorkan panjangnya lewat waktu eksekusi. */
export function passwordCocok(a: string, b: string) {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

export const NAMA_COOKIE = 'mapporto_admin';
