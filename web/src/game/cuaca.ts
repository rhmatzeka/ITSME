/**
 * Cuaca desa, dibaca bersama oleh semua penghuni.
 *
 * Diisi Hujan.ts tiap frame. Yang lain cukup membacanya — kodok makin
 * riuh, anak-anak pulang, warga membuka payung — tanpa perlu tahu siapa
 * yang mengatur hujannya. Sengaja satu objek biasa, bukan event: nilainya
 * berubah perlahan, dan yang membaca memang butuh angkanya saat itu juga.
 */
export const cuaca = {
  /** Derasnya gerimis sekarang: 0 cerah .. 1 gerimis penuh. */
  hujan: 0,
  /** Seberapa basah tanahnya: naik selama hujan, surut pelan sesudahnya. */
  basah: 0,
};

/**
 * Seberapa "tidak ada di luar" anak-anak sekarang: pulang saat gelap atau
 * saat gerimis. Dipakai engklek, layangan, ayunan, dan anak bola, supaya
 * semuanya berteduh bersamaan.
 */
export function gelapAtauHujan(gelap: number) {
  return Math.max(gelap, cuaca.hujan * 0.9);
}
