/** Angka-angka yang sering diutak-atik, dikumpulkan di satu tempat. */

export const TILE = 16;

/** Zoom kamera harus BILANGAN BULAT — zoom pecahan bikin pixel goyang saat jalan. */
export const ZOOM = { desktop: 3, mobile: 2 } as const;

export const PLAYER = {
  /** Spritesheet 128×256 → grid 4 kolom × 8 baris, tiap frame 32×32. */
  frameWidth: 32,
  frameHeight: 32,
  speed: 74, // px/detik
  /**
   * Kotak tabrakan menutupi badan, bukan cuma telapak kaki.
   *
   * Gambar karakter menempati y 13..30 dari frame 32px. Dengan kotak di
   * y 22..29 (versi lama), saat mentok ke dinding puncak kepala berhenti
   * 9px di atas dasar dinding — dan karena tile pagar sebagian transparan
   * (bentuknya gundukan), kepalanya menyembul lewat celah itu ke sisi seberang.
   *
   * Kotak y 20..28 membuat karakter bisa mendekat sampai kepalanya masuk
   * ke dalam tile penghalang — tertutup olehnya, bukan menyembul ke seberang.
   * Lebarnya tetap 12 (< 1 tile) supaya masih muat lewat gerbang dan jembatan.
   */
  body: { width: 12, height: 11, offsetX: 10, offsetY: 20 },
  /**
   * Jarak dari titik y sprite ke garis pijaknya — dipakai sebagai kunci urutan
   * gambar. Sama dengan tepi bawah kotak tabrakan, yang sekarang sengaja
   * disejajarkan dengan baris terakhir gambar karakter (y30 dari frame 32px).
   *
   * Sebelumnya kotaknya berhenti 1px lebih tinggi. Satu piksel itu cukup untuk
   * membuat baris terbawah sepatu masuk ke tile tanggul di bawahnya lalu
   * tertutup olehnya — terbaca sebagai kaki yang hilang.
   */
  baseY: 15,
} as const;

/**
 * Baris spritesheet, hasil pembacaan langsung dari blonde_man.png:
 * baris 2 terbukti cerminan persis baris 1, dan pusat wajah baris 1 condong ke kiri.
 */
export const ROW = {
  idle: { down: 0, left: 1, right: 2, up: 3 },
  walk: { down: 4, left: 5, right: 6, up: 7 },
} as const;

export type Dir = keyof typeof ROW.idle;

/** Petir: 832×64 = 13 frame @64×64. Splash: 672×48 = 14 frame @48×48. */
export const THUNDER = {
  strike: { frameWidth: 64, frameHeight: 64, frames: 13 },
  splash: { frameWidth: 48, frameHeight: 48, frames: 14 },
} as const;

/** Timeline transisi, dalam ms. Lihat plan.md bagian 6. */
export const TRANSITION = {
  full: { fadeOut: 160, strike: 310, flash: 70, land: 230, ui: 130 },
  fast: { fadeOut: 60, strike: 140, flash: 40, land: 80, ui: 30 },
  /** Sesudah sekian transisi, otomatis pindah ke mode cepat. */
  autoFastAfter: 5,
} as const;

/**
 * Kedalaman gambar.
 *
 * Bagian tengahnya bukan angka tetap melainkan sebuah pita: apa pun yang
 * BERDIRI di atas tanah — karakter, sapi, pagar, tanggul, rumah — memakai
 * `urut + y garis pijaknya`. Yang garis pijaknya lebih ke bawah layar berarti
 * lebih dekat ke kamera, jadi dia yang menutupi.
 *
 * Aturan tetap tidak pernah bisa benar di sini. Versi sebelumnya menaikkan
 * semua yang menghalangi ke atas karakter: benar untuk dinding di selatan,
 * tapi membuat kepala karakter hilang saat merapat ke tanggul dari bawah.
 * Kebalikannya cuma memindahkan cacatnya ke sisi seberang. Yang membedakan
 * kedua kasus itu memang posisi, jadi posisi yang jadi kuncinya.
 */
export const DEPTH = {
  ground: 0,
  /** Permukaan yang diinjak: jembatan, tangga, rumput taman. */
  floor: 1,
  below: 2,
  /** Pangkal pita terurut-y. Map tertinggi 33 tile = 528px, jadi muat. */
  urut: 100,
  /** Menggantung di atas kepala: kanopi pohon, lengan lampu, tenda gerai. */
  above: 1000,
  fx: 1100,
  debug: 1200,
} as const;

/** Kedalaman untuk sesuatu yang garis pijaknya ada di `baseY`. */
export function kedalaman(baseY: number) {
  return DEPTH.urut + baseY;
}

/** Joystick virtual — muncul kalau perangkatnya sentuh atau layarnya sempit. */
export const TOUCH = {
  /** Radius cincin luar di layar (px). Aset aslinya 48×48. */
  baseRadius: 46,
  /** Sejauh mana knob boleh menjauh dari pusat sebelum dianggap dorong penuh. */
  maxDrag: 34,
  /** Di bawah nilai ini dianggap diam — mencegah karakter bergetar. */
  deadZone: 0.22,
  margin: 22,
  buttonSize: 58,
  /**
   * Posisi istirahat joystick, diukur dari sudut kiri-bawah. Lebih masuk ke
   * dalam daripada sekadar margin: di sudut layar cincinnya terpotong dan
   * jempol harus menjangkau terlalu jauh ke bawah.
   */
  homeX: 96,
  homeY: 118,
} as const;

/**
 * Apakah alat tunjuk utamanya jari. `pointer: coarse` adalah pembeda yang
 * benar — `device.input.touch` juga bernilai true di laptop layar-sentuh yang
 * dipakai dengan mouse, dan di situ joystick cuma menghalangi.
 *
 * Dipakai WorldScene maupun UIScene supaya keduanya tidak pernah berbeda
 * pendapat. Sebelumnya nilainya dititipkan lewat registry saat UIScene dibuat,
 * dan WorldScene sempat membacanya sebelum sempat diisi.
 */
export function pakaiKontrolSentuh() {
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  return coarse || (typeof window !== 'undefined' && window.innerWidth < 700);
}

/**
 * Area layar yang dimiliki joystick. Dipakai bersama oleh joystick dan
 * WorldScene: sentuhan di sini tidak boleh menembus ke zona POI di bawahnya,
 * kalau tidak menggerakkan joystick bisa ikut memicu perpindahan tempat.
 */
export function diZonaJoystick(x: number, y: number, lebar: number, tinggi: number) {
  return x < lebar * 0.55 && y > tinggi * 0.45;
}

/**
 * Kandang berpagar di tengah desa, tile x17..21 y15..21.
 *
 * Pagarnya menutup rapat — keempat sisinya ada di grid tabrakan — jadi pemain
 * tidak akan pernah bisa masuk ke dalamnya. Karena itu sapinya tidak perlu
 * badan fisika sama sekali: cukup dijaga tetap di dalam kotak, dan tidak ada
 * yang bisa menabraknya.
 */
export const KANDANG = {
  /** Tanah di dalam pagar, dalam tile. Batas kanan/bawah ikut terhitung. */
  dalam: { x0: 18, y0: 16, x1: 20, y1: 20 },
} as const;

export const COW = {
  /** Spritesheet 128×96 → 4 kolom × 3 baris, tiap frame 32×32. */
  frameWidth: 32,
  frameHeight: 32,
  /** px/detik. Sapi tidak buru-buru; di bawah seperlima kecepatan pemain. */
  speed: 13,
  /** Baris awal tiap arah hadap. Arah kanan = baris samping yang dicerminkan. */
  baris: { samping: 0, bawah: 4, atas: 8 },
  /** Jeda merumput di antara dua jalan-jalan, dalam ms. */
  jeda: { min: 1600, max: 5200 },
  /**
   * Jarak aman dari pagar, diukur dari kaki sapi.
   *
   * Gambar sapinya setinggi 21px di atas kaki dan selebar 22px, jadi `atas`
   * harus lebih besar dari sisi lain — kalau tidak, kepalanya menyembul lewat
   * pagar atas alih-alih berdiri di depannya.
   */
  pinggir: { x: 12, atas: 24, bawah: 4 },
} as const;
