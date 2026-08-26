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
    label: 'Projects',
    panel: 'projects',
    at: [29, 4],
    enterAt: [29, 6],
    facing: 'up',
    greeting: 'Ini bengkel tempat saya ngerjain proyek.',
  },
  {
    id: 'rumah_about',
    label: 'About Me',
    panel: 'about',
    at: [11, 15],
    enterAt: [11, 17],
    facing: 'up',
    greeting: 'Rumah saya. Masuk, kenalan dulu.',
  },
  {
    id: 'rumah_cv',
    label: 'CV',
    panel: 'cv',
    at: [26, 19],
    enterAt: [26, 21],
    facing: 'up',
    greeting: 'Riwayat kerja saya ada di dalam sini.',
  },
  {
    id: 'rumah_contact',
    label: 'Contact',
    panel: 'contact',
    at: [19, 27],
    enterAt: [19, 29],
    facing: 'up',
    greeting: 'Mau ngobrol? Ini kantor posnya.',
  },
  {
    id: 'kios_stack',
    label: 'Tech Stack',
    panel: 'stack',
    at: [10, 27],
    enterAt: [10, 29],
    facing: 'up',
    greeting: 'Kios saya — ini semua yang saya jual.',
  },
  {
    id: 'bangku_1',
    label: 'Memo #1',
    panel: 'memo-1',
    at: [8, 5],
    enterAt: [8, 6],
    facing: 'up',
    greeting: 'Ada catatan ketinggalan di bangku ini.',
  },
  {
    id: 'bangku_2',
    label: 'Memo #2',
    panel: 'memo-2',
    // (28,10) ada di dalam taman berpagar dan tak tercapai — digeser ke luar pagar.
    at: [28, 9],
    enterAt: [28, 12],
    facing: 'up',
    greeting: 'Bangku di taman. Enak buat mikir.',
  },
  {
    id: 'bangku_3',
    label: 'Memo #3',
    panel: 'memo-3',
    at: [26, 15],
    enterAt: [26, 16],
    facing: 'up',
    greeting: 'Catatan lagi. Saya memang suka nulis.',
  },
  {
    id: 'bangku_4',
    label: 'Memo #4',
    panel: 'memo-4',
    at: [13, 22],
    enterAt: [13, 23],
    facing: 'up',
    greeting: 'Yang terakhir. Duduk dulu sebentar.',
  },
];

/** Titik spawn awal, di persimpangan jalan tengah desa. */
export const FALLBACK_SPAWN: [number, number] = [23, 19];

export const GREETING_START = 'Halo! Saya Mats. Klik tempat mana pun untuk mampir.';
