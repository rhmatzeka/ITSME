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
   * Kotak y 14..28 membuat kepala berhenti tepat di tepi dinding.
   * Lebarnya tetap 12 (< 1 tile) supaya masih muat lewat gerbang dan jembatan.
   */
  body: { width: 12, height: 14, offsetX: 10, offsetY: 14 },
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

export const DEPTH = {
  ground: 0,
  /** Permukaan yang diinjak: jembatan, tangga, rumput taman. */
  floor: 1,
  below: 2,
  shadow: 9,
  player: 10,
  above: 20,
  fx: 30,
  debug: 40,
} as const;

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
