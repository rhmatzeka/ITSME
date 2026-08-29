/**
 * Peta alamat ↔ tempat di dunia game.
 *
 * Satu-satunya berkas tempat keduanya dipasangkan. Sebelumnya id POI bocor
 * langsung ke alamat (`/#/rumah_cv`) — nama internal yang kebetulan terbaca
 * orang, dan ikut berubah setiap kali map diutak-atik. Alamatnya sekarang
 * dipilih sendiri, jadi id POI bebas berganti tanpa mematikan tautan yang
 * sudah beredar.
 *
 * Dipakai bersama oleh halaman Astro (untuk membuat rute & judulnya) dan oleh
 * skrip di browser (untuk membaca alamat saat halaman dibuka).
 */
export interface Rute {
  /** Ruas alamat, tanpa garis miring. */
  ruas: string;
  /** Id POI di dalam game. */
  poi: string;
  /** Teks tombol di menu atas. */
  label: string;
  /** Judul tab & hasil pencarian. */
  judul: string;
  deskripsi: string;
}

export const RUTE: Rute[] = [
  {
    ruas: 'about',
    poi: 'rumah_about',
    label: 'About me',
    judul: 'About Me',
    deskripsi: 'Kenalan dengan Rahmat Eka Satria — latar belakang, minat, dan cara saya bekerja.',
  },
  {
    ruas: 'cv',
    poi: 'rumah_cv',
    label: 'CV',
    judul: 'CV',
    deskripsi: 'Riwayat pendidikan, pengalaman, dan organisasi Rahmat Eka Satria.',
  },
  {
    ruas: 'projects',
    poi: 'rumah_projects',
    label: 'Projects',
    judul: 'Projects',
    deskripsi: 'Proyek-proyek yang pernah saya kerjakan, dari web sampai play-to-earn.',
  },
  {
    ruas: 'tech-stack',
    poi: 'kios_stack',
    label: 'Tech Stack',
    judul: 'Tech Stack',
    deskripsi: 'Bahasa, framework, dan alat yang saya pakai sehari-hari.',
  },
  {
    ruas: 'contact',
    poi: 'rumah_contact',
    label: 'Contact',
    judul: 'Contact',
    deskripsi: 'Email, LinkedIn, dan GitHub — cara paling cepat menghubungi saya.',
  },
];

/** Alamat untuk sebuah POI. POI yang tidak punya alamat pulang ke beranda. */
export function alamatPoi(poi: string) {
  const r = RUTE.find((x) => x.poi === poi);
  return r ? `/${r.ruas}` : '/';
}

/** Kebalikannya: POI untuk alamat yang sedang dibuka, atau null di beranda. */
export function poiAlamat(pathname: string) {
  const ruas = pathname.replace(/^\/+|\/+$/g, '');
  return RUTE.find((x) => x.ruas === ruas)?.poi ?? null;
}
