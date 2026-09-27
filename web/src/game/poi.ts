import type { Dir } from './config';

export interface Poi {
  id: string;
  label: string;
  /** Slug konten yang dibuka di panel. */
  panel: string;
  /** Tile yang diklik (pusat bangunan/objek). */
  at: [number, number];
  /** Tile tempat karakter mendarat — di depan pintu, bukan di tengah atap. */
  enterAt: [number, number];
  facing: Dir;
  /** Kalimat yang muncul di bubble chat saat mendarat. */
  greeting: string;
  /**
   * Setengah lebar bangunannya ditambah sedikit, px dunia — batas zona
   * "di samping rumah" untuk petunjuk pintu. Ukuran tiap rumah berbeda.
   */
  lebar?: number;
}

/**
 * Fallback POI — dipakai selama layer `poi` belum ada di map.tmx.
 *
 * Koordinat di bawah dibaca dari map hasil build (39×33 tile) dan sudah
 * DIVALIDASI: tiap `enterAt` terbukti bisa dicapai dari titik spawn lewat BFS
 * di atas grid collision. Begitu kamu menggambar layer `poi` di Tiled,
 * daftar ini otomatis diabaikan.
 */
export const FALLBACK_POIS: Poi[] = [
  {
    id: 'rumah_projects',
    lebar: 34,
    label: 'Projects',
    panel: 'projects',
    at: [29, 4],
    enterAt: [29, 6],
    facing: 'up',
    greeting: 'This is the workshop where I build my projects.',
  },
  {
    id: 'rumah_about',
    lebar: 44,
    label: 'About Me',
    panel: 'about',
    at: [11, 15],
    enterAt: [11, 17],
    facing: 'up',
    greeting: 'My house. Come in and say hi.',
  },
  {
    id: 'rumah_cv',
    lebar: 42,
    label: 'CV',
    panel: 'cv',
    at: [26, 19],
    enterAt: [26, 21],
    facing: 'up',
    greeting: 'My work history is kept in here.',
  },
  {
    id: 'rumah_contact',
    lebar: 58,
    label: 'Contact',
    panel: 'contact',
    at: [19, 27],
    enterAt: [19, 29],
    facing: 'up',
    greeting: 'Want to chat? This is the post office.',
  },
  {
    id: 'kios_stack',
    lebar: 38,
    label: 'Tech Stack',
    panel: 'stack',
    at: [10, 27],
    enterAt: [10, 29],
    facing: 'up',
    greeting: 'My stall — everything I have on offer.',
  },
];

/** Titik spawn awal, di persimpangan jalan tengah desa. */
export const FALLBACK_SPAWN: [number, number] = [23, 19];

// Kalimat pembuka harus menyebut cara yang sekarang benar-benar berlaku:
// mendekat sudah cukup, dan klik hanya mengenai tempat bernama — bukan
// "tempat mana pun" seperti dulu.
export const GREETING_START = "Hi! I'm Rahmat. Walk up to a house's front door to drop in, or click its name.";

/**
 * Sedekat apa harus berdiri sebelum panelnya terbuka sendiri, dalam piksel.
 *
 * Diukur dari `enterAt` — petak tempat karakter mendarat, di depan pintu,
 * bukan dari tengah atapnya. 22px kira-kira satu setengah tile: cukup dekat
 * untuk terbaca sebagai "masuk ke sini", cukup jauh untuk tidak terpicu saat
 * cuma lewat di jalan depannya.
 */
export const POI_DEKAT = 22;

/**
 * Bantuan menemukan pintu, dalam piksel dunia.
 *
 * `lebarRumah` (setengah lebar) dan `tinggiRumah` membentuk kotak di sekitar
 * pusat bangunan (`at`); `depan` adalah batas bawahnya — sedikit di bawah
 * pusat, masih di atas garis pintu. Karakter di dalam kotak itu sedang berada
 * di samping atau di belakang rumah, jadi diberi tahu bahwa pintunya di depan.
 * Yang lewat di jalan depan rumah tidak masuk kotak ini: mereka cukup dibantu
 * panah, tidak perlu diceramahi gelembung.
 */
export const PINTU = {
  /** Dipakai kalau POI tidak menyebut `lebar` sendiri. */
  lebarRumah: 44,
  tinggiRumah: 60,
  depan: 12,
  /** Jeda minimal antar gelembung petunjuk, ms. */
  jeda: 5000,
} as const;
