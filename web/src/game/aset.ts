import { VERSI } from './versi';

/**
 * URL berkas di /assets, dicap versi build.
 *
 * Nama berkasnya tetap sama antar deploy, jadi tanpa cap ini browser yang
 * sudah pernah menyimpan salinannya tidak punya alasan untuk mengambil yang
 * baru — dan salinan lama itu pernah ditandai berlaku setahun. Cap-nya adalah
 * sidik isi seluruh aset: berubah hanya kalau isinya memang berubah, jadi
 * kunjungan berulang tetap memakai cache selama petanya belum diperbarui.
 */
export function aset(nama: string) {
  return `/assets/${nama}?v=${VERSI}`;
}
