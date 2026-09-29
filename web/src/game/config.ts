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
  full: { fadeOut: 160, strike: 310, flash: 70, land: 230, ui: 260 },
  /*
   * Mode cepat sengaja bukan setengah kecepatan: 310 ms total membuat
   * petirnya cuma kedipan yang tidak sempat terbaca. Yang dipangkas
   * jedanya, bukan sambarannya.
   */
  fast: { fadeOut: 70, strike: 200, flash: 45, land: 130, ui: 120 },
  /**
   * Sesudah sekian transisi, otomatis pindah ke mode cepat.
   *
   * Dulu 5 — terlalu dini: orang yang baru melihat-lihat sudah kehabisan
   * animasi sebelum sempat memperhatikannya sekali pun.
   */
  autoFastAfter: 10,
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
 * Apakah tekanan/lepasan jari ini benar-benar terjadi di atas kanvas game?
 *
 * Phaser tetap memproses pointer yang dilepas DI LUAR kanvas. Untuk seretan
 * yang berakhir di luar jendela itu perilaku yang benar, tapi di sini salah:
 * panel, daftar menu, dan peta besar adalah elemen DOM yang menutupi kanvas,
 * dan sentuhan pada tombol tutupnya ikut terbaca sebagai sentuhan pada dunia
 * di bawahnya.
 *
 * Yang paling sering kena minimap. Di layar ponsel minimap naik ke kanan atas,
 * dan tombol tutup panel berhenti tepat di atasnya — jadi satu sentuhan
 * menutup panel sekaligus membuka peta besar. Terukur di 390x760: tombol tutup
 * menempati x324..373 y19..67, minimap x259..376 y66..165. Bersinggungan, dan
 * di ponsel yang punya poni jaraknya makin masuk karena kartunya digeser
 * turun oleh safe-area.
 *
 * Menggeser salah satunya cuma memindahkan cacatnya ke perangkat lain. Yang
 * benar: sentuhan yang mendarat di DOM bukan milik dunia.
 */
export function diKanvas(p: { event?: Event | null }) {
  const t = p.event?.target as Element | null | undefined;
  return !t || t.tagName === 'CANVAS';
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

/** Arah hadap penghuni dunia. */
export type ArahHadap = 'kiri' | 'kanan' | 'atas' | 'bawah';

export interface AturanPenghuni {
  frameWidth: number;
  frameHeight: number;
  /** px/detik */
  speed: number;
  /** Jeda berhenti di antara dua jalan-jalan, ms. */
  jeda: { min: number; max: number };
  /** Frame per detik saat jalan dan saat berhenti. */
  rate: { jalan: number; diam: number };
  /** Frame awal tiap arah. `flip` = baris yang sama, dicerminkan. */
  arah: Record<ArahHadap, { jalan: number; diam: number; flip?: boolean }>;
  /** Ukuran gambar terpakai — dipakai menjaga jarak dari tepi area. */
  gambar: { lebar: number; tinggi: number };
  /** Pakai bayangan kaki di tanah — lihat bayanganKaki() di piksel.ts. */
  bayangan?: boolean;
  /**
   * Seberapa kecil digambar dibanding aslinya, 1 = apa adanya.
   *
   * Angkanya tidak dipakai mentah. `skala × zoom` HARUS bilangan bulat: kalau
   * tidak, satu piksel gambar jatuh ke 1,5 piksel layar dan lebarnya jadi
   * berselang-seling (1,2,1,2…) — sprite kecil jadi terlihat rusak, apalagi
   * saat bergerak. Lihat skalaGambar().
   */
  kecilkan?: number;
}

/**
 * Skala gambar yang aman untuk pixel art: dipilih dari berapa piksel layar
 * per piksel gambar, dibulatkan ke bilangan bulat, lalu dibagi zoom.
 *
 * Pada zoom 3 (desktop) `kecilkan: 0.65` jadi 2 piksel layar per piksel gambar
 * (skala 2/3); pada zoom 2 (ponsel) jadi 1 (skala 1/2). Ukurannya sedikit
 * berbeda antar perangkat — pertukaran yang diambil supaya tidak ada satu pun
 * piksel yang berubah lebar.
 */
export function skalaGambar(aturan: AturanPenghuni, zoom: number) {
  return Math.max(1, Math.round(zoom * (aturan.kecilkan ?? 1))) / zoom;
}

/**
 * Penghuni dunia. Perilakunya identik; yang membedakan cuma spritesheet dan
 * angkanya, jadi semuanya dijelaskan di sini alih-alih jadi kelas sendiri.
 *
 * Angka `arah` adalah FRAME AWAL, bukan nomor baris — spritesheet-nya berbeda
 * lebar sehingga nomor baris tidak berarti sama di ketiganya.
 */
export const PENGHUNI: Record<string, AturanPenghuni> = {
  // 128×96 → 4 kolom × 3 baris @32px: samping, depan, belakang
  sapi: {
    frameWidth: 32,
    frameHeight: 32,
    speed: 13, // sapi tidak buru-buru; di bawah seperlima kecepatan pemain
    jeda: { min: 1600, max: 5200 },
    rate: { jalan: 7, diam: 2 },
    arah: {
      kiri: { jalan: 0, diam: 0 },
      kanan: { jalan: 0, diam: 0, flip: true },
      bawah: { jalan: 4, diam: 4 },
      atas: { jalan: 8, diam: 8 },
    },
    gambar: { lebar: 22, tinggi: 21 },
  },
  // 64×32 → 4 kolom × 2 baris @16px: samping, depan. Tidak ada tampak
  // belakang, jadi jalan ke atas memakai barisan depan — pada 16px tidak ada
  // yang menyadarinya, dan menggambar sendiri barisannya bukan tugas kode ini.
  ayam: {
    frameWidth: 16,
    frameHeight: 16,
    speed: 22,
    jeda: { min: 600, max: 2600 }, // ayam gelisah: berhenti sebentar-sebentar
    rate: { jalan: 8, diam: 3 },
    arah: {
      kiri: { jalan: 0, diam: 0 },
      kanan: { jalan: 0, diam: 0, flip: true },
      bawah: { jalan: 4, diam: 4 },
      atas: { jalan: 4, diam: 4 },
    },
    gambar: { lebar: 14, tinggi: 16 },
    // Digambar penuh 16px, sama tinggi dengan manusia di dunia ini — jelas
    // salah untuk seekor ayam. Dikecilkan sampai kira-kira dua pertiga.
    kecilkan: 0.65,
  },
  /*
   * 64×48 → 4 kolom × 3 baris @16px: samping, depan, telur. Barisan telurnya
   * tidak dipakai.
   *
   * Dulu digambar apa adanya, dengan alasan gambarnya (10×11px di dalam
   * framenya) sudah mungil dibanding manusia 18px. Pembandingnya yang salah:
   * yang di sebelahnya bukan manusia melainkan ayam dewasa, dan ayam dewasa
   * itu sendiri sudah dikecilkan jadi dua pertiga. Hasilnya anak ayam 10×11
   * penuh berdiri di samping induk 14×16 yang menyusut ke 9,3×10,7 — anaknya
   * justru lebih besar dari induknya.
   *
   * 0,6 mengembalikan urutan yang benar: pada zoom 3 anaknya jadi 6,7×7,3 dan
   * induknya tetap 9,3×10,7, jadi tingginya kira-kira dua pertiga induknya.
   */
  anak_ayam: {
    frameWidth: 16,
    frameHeight: 16,
    speed: 26, // anak ayam lebih gesit dan lebih sering berhenti
    jeda: { min: 400, max: 2000 },
    rate: { jalan: 9, diam: 3 },
    arah: {
      kiri: { jalan: 0, diam: 0 },
      kanan: { jalan: 0, diam: 0, flip: true },
      bawah: { jalan: 4, diam: 4 },
      atas: { jalan: 4, diam: 4 },
    },
    gambar: { lebar: 10, tinggi: 11 },
    /*
     * Angkanya tidak dipakai mentah — lihat skalaGambar(). Yang menentukan
     * hasilnya cuma `bulat(zoom × angka ini)`, jadi 0,6 dan 0,65 sama saja:
     * dua pertiga di zoom 3, setengah di zoom 2. Ditulis 0,6 supaya jelas
     * bahwa maksudnya lebih kecil dari induknya, bukan sama.
     */
    kecilkan: 0.6,
  },
  // spritesheet karakter: 4 kolom × 8 baris @32px, diam dan jalan terpisah
  warga: {
    frameWidth: 32,
    frameHeight: 32,
    speed: 28,
    jeda: { min: 2200, max: 6000 },
    rate: { jalan: 9, diam: 4 },
    arah: {
      bawah: { jalan: 16, diam: 0 },
      kiri: { jalan: 20, diam: 4 },
      kanan: { jalan: 24, diam: 8 },
      atas: { jalan: 28, diam: 12 },
    },
    gambar: { lebar: 16, tinggi: 18 },
    bayangan: true,
  },
  // remaja: lembar turunan blonde_man.png, tata letaknya sama dengan warga
  remaja: {
    frameWidth: 32,
    frameHeight: 32,
    speed: 28,
    jeda: { min: 2200, max: 6000 },
    rate: { jalan: 9, diam: 4 },
    arah: {
      bawah: { jalan: 16, diam: 0 },
      kiri: { jalan: 20, diam: 4 },
      kanan: { jalan: 24, diam: 8 },
      atas: { jalan: 28, diam: 12 },
    },
    gambar: { lebar: 16, tinggi: 18 },
    bayangan: true,
  },
};

/**
 * Taman berpagar di utara desa — yang berumput di dalam tanggul.
 *
 * Yang bisa dipijak cuma baris 9 dan 10; sisanya tanggul yang menghalangi.
 * Di dalam dua baris itu masih ada rintangan (ember, orang-orangan sawah,
 * batu nisan), jadi ruangnya terpecah jadi kantong-kantong. Masing-masing
 * ditulis terpisah ketimbang satu kotak besar, supaya anak ayamnya tidak
 * pernah memilih tujuan yang ternyata di dalam benda.
 *
 * Kantong timur (x 19-21) sekarang tempat sarang lebah, dan x 4-6 tempat
 * tikar piknik — lihat Bukit.ts. Anak ayamnya tinggal di antara keduanya.
 */
/**
 * Remaja bertas punggung yang berkeliaran di pelataran tanah sebelah timur
 * rumah CV — petak terbuka yang sebelumnya tidak dihuni siapa pun.
 */
export const REMAJA = { x0: 30, y0: 19, x1: 31, y1: 20 } as const;

export const TAMAN: { x0: number; y0: number; x1: number; y1: number }[] = [
  { x0: 7, y0: 9, x1: 11, y1: 10 },
  { x0: 13, y0: 9, x1: 17, y1: 10 },
];

/**
 * Halaman rumput terbuka di depan rumah About — tempat warga dan ayam
 * berkeliaran. Seluruh petaknya sudah dipastikan bebas rintangan.
 */
export const HALAMAN = {
  dalam: { x0: 12, y0: 17, x1: 16, y1: 21 },
} as const;

/**
 * Bingkai minimap — aset nine-patch `minimap_frame.png`.
 *
 * `tebal` harus sama dengan tebal cincin di tools/aset-buatan.mjs: itulah
 * berapa piksel bingkainya menjorok ke luar dari gambar petanya, dan angka
 * itu yang dipakai menghitung letak minimap maupun jarak aman gelembung.
 * `potong` adalah lebar sudut yang tidak boleh diregangkan.
 */
export const MINI_BINGKAI = { tebal: 10, potong: 16 } as const;

/**
 * Kupu-kupu penghias taman.
 *
 * Bukan Penghuni: penghuni berjalan di tanah dan urutan gambarnya ditentukan
 * garis pijaknya sendiri. Kupu-kupu melayang di atas tanah, jadi titik
 * pijaknya (yang menentukan urutan gambar) dan titik gambarnya berbeda
 * beberapa piksel — perbedaan kecil yang tidak muat dipaksakan ke aturan
 * Penghuni tanpa membuat aturan itu penuh pengecualian.
 */
export const KUPU = {
  frameWidth: 16,
  frameHeight: 16,
  /** 3 baris warna × 4 frame kepakan. */
  ragam: 3,
  kecilkan: 0.66,
  /**
   * px/detik. Lebih cepat dari ayam (26) — kupu-kupu yang bergerak lebih
   * lambat dari ayam terbaca seperti sedang kelelahan.
   */
  laju: { santai: 31, kabur: 58 },
  /**
   * Jeda hinggap di antara dua penerbangan, ms.
   *
   * Sengaja pendek. Yang bikin kupu-kupu terlihat hidup itu perpindahannya,
   * bukan hinggapnya; jeda panjang membuatnya tampak diam di tempat walau
   * sayapnya tetap mengepak.
   */
  jeda: { min: 250, max: 1300 },
  /** Sejauh apa ia menghambur waktu kaget, px. */
  hambur: 42,
  /**
   * Seberapa jauh arah terbangnya berbelok dari garis lurus ke tujuan, radian.
   *
   * Inilah yang membedakan terbang dari berjalan: ayam boleh menempuh garis
   * lurus, kupu-kupu tidak. Arahnya digoyang bolak-balik sehingga lintasannya
   * meliuk, tapi tetap mengarah ke tujuan jadi ia selalu sampai.
   */
  liuk: 0.55,
  /** Tinggi melayang di atas titik pijaknya, px. */
  terbang: { min: 5, max: 11 },
  /** Tinggi waktu benar-benar hinggap — hampir menyentuh tanah. */
  hinggapTinggi: 1,
  /** Peluang satu jeda dipakai hinggap sungguhan, bukan menggantung di udara. */
  peluangHinggap: 0.45,
  /** Baris bayangan di spritesheet, tepat setelah tiga baris warna. */
  barisBayangan: 3,
  /** Kepekatan bayangan waktu menempel tanah. */
  bayangan: 0.32,
  /** Frame per detik kepakan sayap: diam vs terbang. */
  kepak: { hinggap: 5, terbang: 14 },
  /** Sedekat apa pemain harus datang sebelum kupu-kupunya kabur, px. */
  kaget: 34,
} as const;

/**
 * Gurita raksasa di sungai.
 *
 * Tikungan barat, tempat sungai tegak di kolom 0-2 bertemu sungai mendatar
 * di baris 23-25. Itu genangan air terluas di peta — di tempat lain airnya
 * cuma pita setinggi 3 tile, di sini ia melebar ke atas, jadi badan sebesar
 * ini punya ruang untuk duduk tanpa terlihat sesak.
 *
 * Kolom 0 bukan sekadar "mepet kiri": jembatan pertama menyeberang di kolom
 * 7-8, dan lebar guritanya tepat 7 tile — jadi ia mengisi persis bentangan
 * antara tepi peta dan jembatan itu, dengan ujung tentakel kanan berhenti
 * setengah tile sebelum papan pertama.
 *
 * Baris 22 membuat badannya jatuh tepat di ketiga baris air sementara
 * tentakelnya menjulur ke rumput di atas dan di bawah.
 *
 * Sempat ditaruh di kolom 12, di bentangan antara kedua jembatan. Airnya
 * cukup, tapi di sana ia jadi benda paling mencolok tepat di jalur orang
 * berjalan dari Tech Stack ke Contact.
 */
export const GURITA = {
  frameWidth: 7 * 16,
  frameHeight: 5 * 16,
  /** Sudut kiri-atas gambar, dalam tile. */
  di: { x: 0, y: 22 },
  /** 16 frame: dua ayunan tentakel dan satu kedipan per putaran. */
  frame: 16,
  /** Satu ayunan 1,3 detik — selambat hewan sebesar ini bergerak. */
  fps: 6,
} as const;

/**
 * Warga yang mencangkul di petak sawah timur.
 *
 * Petaknya menempati baris 26-29, kolom 29-37. Ia ditaruh di kolom 28 —
 * sejengkal di sebelah kiri petak pertama, bukan di dalamnya: cangkulnya
 * mengayun ke KANAN, jadi dari situ mata cangkulnya jatuh tepat di tanah
 * garapan, sementara badannya tetap berdiri di rumput yang bebas.
 *
 * `jeda` menahan sebentar sesudah satu ayunan selesai. Tanpa itu ia
 * mencangkul tanpa henti seperti mesin; orang yang benar-benar bekerja
 * menarik napas di antara ayunan.
 */
export const PETANI = {
  frameWidth: 32,
  frameHeight: 32,
  frame: 4,
  fps: 5,
  /** Titik pijak, dalam tile. */
  di: { x: 28, y: 29 },
  jeda: 420,
} as const;

/**
 * Pemuda bertopi yang duduk di bangku taman timur laut.
 *
 * Bangkunya dua tile: sandaran di baris 8, dudukan di baris 9, kolom 27-28.
 * Dibaca dari gambarnya, sandaran menempati baris dunia 133-145 dan papan
 * dudukan 147-156.
 *
 * `kedalaman` 163 menaruhnya DI DEPAN seluruh bangku. Sempat diselipkan di
 * antara kedua tile bangku — di depan sandaran, di belakang dudukan — dan
 * itu ternyata mustahil: rumput taman di petak itu bukan bagian dari layer
 * dasar melainkan ikut layer `padat`, jadi ia digambar pada kedalaman yang
 * sama dengan bangkunya (260). Apa pun yang lebih dangkal dari itu tertutup
 * rumput, termasuk badan pemuda ini — dan di celah setinggi satu piksel
 * antara palang dan papan dudukan, rumput itu menyembul persis di tengah
 * badannya sehingga terbaca seperti lubang tembus.
 *
 * Titik pijak 152 menaruh kepalanya di sandaran dan pangkuannya di papan
 * dudukan, dengan separuh depan papan tetap terlihat di bawahnya.
 */
export const PEMUDA = {
  frameWidth: 32,
  frameHeight: 32,
  frame: 4,
  /** Lambat: gerakan duduk santai, bukan gelisah. */
  fps: 3,
  di: { x: 27 * 16 + 12, y: 152 },
  kedalaman: 163,
} as const;

/**
 * Tiang lampu jalan, dalam tile: petak ujung lengan tiang tempat lenteranya
 * menggantung (tile yang sama di layer `di atas map 1`, dibaca dari map.json).
 * Lenteranya sendiri ada di `lentera` piksel dari pojok kiri atas petak itu.
 */
export const LAMPU = {
  tiang: [
    [4, 3],
    [7, 12],
    [23, 12],
    [30, 13],
    [7, 26],
    [23, 26],
  ] as [number, number][],
  lentera: { x: 4.5, y: 16 },
  /** Genangan cahaya di tanah: jarak di bawah lentera dan jari-jari elipsnya, px dunia. */
  genangan: { turun: 20, rx: 34, ry: 20 },
} as const;

/**
 * Siang-malam: warna "tirai" MULTIPLY di atas dunia, per jam lokal pengunjung.
 * Putih = siang, tidak mengubah apa pun. Di antara dua titik warnanya dicampur.
 */
export const WAKTU = {
  titik: [
    [0, 0x55669f],
    [5, 0x55669f],
    [6, 0xb89ab8],
    [7.5, 0xffffff],
    [16.5, 0xffffff],
    [17.5, 0xffe2bc],
    [18.5, 0xe6b2a4],
    [19.5, 0x55669f],
    [24, 0x55669f],
  ] as [number, number][],
  /** Jam yang dipakai pilihan tetap di Setelan. */
  preset: { siang: 12, senja: 18.1, malam: 22 },
  /** Lama peralihan warna saat pilihan diganti, ms. */
  peralihan: 1400,
} as const;

/** Awan putih pixel art yang melayang pelan di atas desa. */
export const AWAN = {
  /**
   * Banyaknya awan. Dibagi ke `lajur` jalur ketinggian yang rata dari tepi
   * atas sampai bawah peta, dua awan per jalur berjarak setengah putaran —
   * jadi layar sempit sekalipun (ponsel, zoom 2) selalu kebagian awan.
   */
  jumlah: { hp: 20, desktop: 12 },
  /**
   * Desktop memotret area peta kira-kira dua kali lebih luas daripada ponsel
   * (zoom 3 di layar lebar lawan zoom 2 di layar sempit), jadi dengan jumlah
   * yang sama desktop terlihat penuh sesak. Terukur: 20 awan = 5–6 di layar
   * ponsel (pas) tapi 6–8 di desktop (kebanyakan).
   */
  lajur: { hp: 10, desktop: 6 },
  /** Jumlah variasi bentuk yang digambar. */
  ragam: 5,
  /** Kepekatan awan: cukup tembus supaya desa di bawahnya tetap terbaca. */
  pekat: 0.82,
  /**
   * Seberapa banyak awan menipis di malam hari (0..1). Separuh awan hilang
   * sama sekali, separuhnya lagi tinggal 40% — lihat Suasana.pakaiWarna().
   */
  malam: 0.6,
  /** px dunia per detik, ke timur; tiap awan diacak di rentang ini. */
  laju: { min: 6, max: 11 },
} as const;

/**
 * Empat petak sawah di tenggara, dalam tile (pojok kiri atas tiap petak).
 * Tiap petak 2 × 4 tile, satu tanaman per tile. Frame dari Sprout Lands
 * "Basic Plants" (16×16, 6 kolom): jagung di baris atas, bit di baris bawah,
 * masing-masing empat tahap tumbuh.
 */
export const SAWAH = {
  petak: [
    { x: 29, y: 26 },
    { x: 31, y: 26 },
    { x: 33, y: 26 },
    { x: 35, y: 26 },
  ],
  lebar: 2,
  tinggi: 4,
  jenis: [
    [1, 2, 3, 4],
    [7, 8, 9, 10],
  ] as number[][],
  /** Lama tiap tahap tumbuh, ms (ditambah acakan ±15%). */
  tahap: 7000,
  /** Lama berdiri matang sebelum dipanen, ms. */
  matang: 11000,
} as const;

/**
 * Strip rumput di utara jalan atas, antara sungai dan rumah Projects — dulu
 * cuma rumput dengan benda-benda diam. Semua angka dalam piksel dunia; baca
 * dari tangkapan layar bergaris petak, bukan tebakan.
 */
export const UTARA = {
  /**
   * Bangku kayu di petak 7-8 baris 5: dua warga duduk mengobrol. Sandaran
   * bangku ini ada di layer `di atas map 1` (kedalaman DEPTH.above), bukan di
   * pita terurut — jadi yang duduk digambar tepat di atas layer itu, bukan
   * dengan garis pijak: badannya menutupi sandaran, pangkuannya di dudukan.
   */
  bangku: { kiri: 121, kanan: 137, kaki: 88 },
  /** Api unggun di celah antara patok kayu dan ujung kiri bangku. */
  unggun: { x: 102, kaki: 95 },
  /** Anak main layangan di rumput terbuka di antara cemara dan patung. */
  anak: { x: 250, kaki: 58 },
  /** Gerobak bakso di lapangan kecil sebelah rumah Projects, menghadap jalan. */
  gerobak: { x: 530, kaki: 112 },
  /**
   * Jemuran di utara bangku: dua tiang dan tali di antaranya. Tidak lebih ke
   * kiri (kanopi pohon di x < 80 menutupinya) dan tidak lebih ke kanan
   * (bunga merah muda di x 131).
   */
  jemuran: { kiri: 82, kanan: 128, kaki: 46 },
  /** Kucing oren tidur di antara bunga putih dan jamur, di atas sumur. */
  kucing: { x: 170, kaki: 61 },
  /** Kupu-kupu yang dikejar kucing. */
  kupu: { x: 150, y: 22, lebar: 140, tinggi: 38 },
  /** Papan pengumuman di atas peti, dekat rumah Projects. */
  papan: { x: 506, kaki: 62 },
} as const;

/**
 * Pekarangan rumah About, piksel dunia — dibaca dari map_full.png bergaris
 * petak. Dinding depan rumah x 159-214 dengan dasar di y 263; kaca jendela
 * kiri mulai x 164, kanan x 200, baris 251-256; pintu x 180-193. Peti kayu di
 * kanan atap berhenti di y 238, patung batu x 146-157 berdasar di y 320.
 */
export const ABOUT = {
  /**
   * Meja kerja di sisi kanan rumah, di bawah peti kayu: puncak monitornya
   * berhenti tepat di bawah peti (y 238). Kursinya di selatan meja, jadi yang
   * duduk membelakangi kamera dan layar monitornya menghadap ke kita —
   * satu-satunya susunan yang memperlihatkan baris kodenya.
   */
  meja: { x: 236, kaki: 266 },
  /**
   * Tempat MATS-BOT muncul pertama kali (sebelum karakternya ada): di kanan
   * meja kerja, antara ujung meja (x 253) dan pagar kandang sapi (±x 279).
   * Setelah itu dia mengikuti karakternya.
   */
  bot: { x: 266, kaki: 262 },
  /** Dasar dinding depan rumah — garis tanah tempat cahaya jendela jatuh. */
  dasarRumah: 263,
  /**
   * Kotak surat di kiri petak pintu (11,17): kurir yang berdiri di pintu
   * cukup menoleh ke kiri untuk memasukkan suratnya.
   */
  kotakSurat: { x: 163, kaki: 298 },
  /** Sumur timba di sebelah kanan-bawah patung batu, kiri bangku. */
  sumur: { x: 172, kaki: 358 },
  /** Anjing penjaga di keset sebelah kanan pintu, di bawah jendela kanan. */
  anjing: { x: 206, kaki: 281 },
  /**
   * Patung batu yang sudah ada di peta (tile 9,19): tengahnya, puncak
   * kepalanya, dan dasarnya. Tengahnya bilangan bulat supaya pipit selebar
   * 12 piksel jatuh tepat di grid piksel.
   */
  patung: { x: 152, kepala: 304, kaki: 320 },
  /** Sepeda ontel di pojok kiri rumah, keranjangnya menempel ke dinding. */
  sepeda: { x: 146, kaki: 270 },
  /**
   * Tile hiasan di layer `lantai` yang tertimpa benda baru — jamur di bawah
   * kursi teras dan di tapak sumur. Dibuang saat scene dibuat.
   */
  buang: [
    [14, 16],
    [10, 20],
  ] as [number, number][],
} as const;

/**
 * Lapangan tanah di timur rumah CV (petak x 30-34, y 13-20) dan sekitarnya —
 * piksel dunia, dibaca dari map_full.png bergaris petak. Remaja bertas
 * punggung yang dulu memakai seluruh lapangan kini cuma di pojok kiri bawahnya
 * (REMAJA), supaya tidak menginjak engklek atau menembus pos ronda.
 */
export const LAPANGAN = {
  /** Kotak engklek dari kapur: tengahnya dan dasar kotak pertama. */
  engklek: { x: 498, kaki: 290 },
  /** Tiang bendera di tepi utara lapangan, di kiri batu besar. */
  bendera: { x: 520, kaki: 228 },
  /** Piala di kiri pintu rumah CV, menggantikan jamur di petak (25,21). */
  prestasi: { x: 406, kaki: 348 },
  /** Pos ronda di pojok kanan bawah lapangan, di kiri tanggul. */
  ronda: { x: 538, kaki: 334 },
  /**
   * Ayunan ban di pohon timur tanggul (petak 37,17-18): tajuknya x 583-603,
   * jadi dahannya ditambahkan menjulur ke kanan dan talinya turun dari ujungnya.
   */
  ayunan: { dahan: { x: 596, y: 280 }, poros: { x: 618, y: 286 }, tali: 20 },
  buang: [[25, 21]] as [number, number][],
  /**
   * Bangku kayu di utara rumah CV (petak 25-26, sandaran baris 14 di layer
   * `di atas map 1`, dudukan baris 15 di `padat`): x 400-432, sandaran mulai
   * y 233, papan dudukan y 245-253. Susunannya sama dengan bangku UTARA,
   * jadi titik duduknya diukur dengan cara yang sama.
   */
  bangku: { kiri: 410, kanan: 424, kaki: 248 },
  /**
   * Tali umbul-umbul: dari ujung lengan tiang lampu (23,12) ke puncak tiang
   * lampu (30,13), lalu dari ujung lengan tiang itu ke tiang bendera. Titik
   * dibaca dari map_full.png; `lendut` = seberapa dalam talinya melengkung.
   */
  umbul: [
    { dari: { x: 377, y: 199 }, ke: { x: 471, y: 214 }, lendut: 9 },
    { dari: { x: 489, y: 215 }, ke: { x: 518, y: 199 }, lendut: 5 },
  ],
  /**
   * Tanah lapang tempat bola bergulir: tepi rumputnya x 484-557, y 212-332.
   * Pos ronda (x 517-559, y 296-334) ikut jadi dinding, supaya bola tidak
   * menggelinding ke kolong panggungnya dan tergambar di balik tiangnya.
   */
  bola: { x0: 484, y0: 212, x1: 557, y1: 332, pos: { x0: 516, y0: 296, x1: 560, y1: 336 } },
  /** Motor bebek tamu pos ronda, di rumput di bawah pos, antara batu dan tanggul. */
  motor: { x: 546, kaki: 350 },
  /** Tamu pos ronda yang jongkok di kiri pos, menghadap bapak ronda. */
  tamu: { x: 511, kaki: 328 },
} as const;

/**
 * Teras rumah CV, piksel dunia: dinding x 402-451 berdasar y 320, pintu
 * x 420-433, jendela berdaun x 410-419 dan 434-443.
 */
export const TERAS_CV = {
  keset: { x: 427, y: 322 },
  sandal: { x: 414, y: 324 },
  /** Keduanya di kanan pintu: sisi kiri sudah ditempati piala (x 398-414). */
  pot: [
    { x: 438, kaki: 326 },
    { x: 448, kaki: 326 },
  ],
} as const;

/**
 * Benda kecil di depan rumah lain — dibaca dari map_full.png bergaris petak,
 * semuanya di petak yang bebas dan tidak menutupi pintu.
 */
export const PERABOT = {
  /** Tong sampah: kanan rumah Projects (di bawah peti), kanan kios Tech Stack. */
  tong: [
    { x: 503, kaki: 95 },
    { x: 196, kaki: 464 },
  ],
  /** Pot bunga: kiri pintu Projects, kiri-kanan pintu About. */
  pot: [
    { x: 461, kaki: 97 },
    { x: 177, kaki: 266 },
    { x: 197, kaki: 266 },
  ],
  /** Pagar bambu pendek di kiri rumah Contact, antara patung batu dan dindingnya. */
  pagar: [{ x0: 226, x1: 243, kaki: 463 }],
} as const;

/**
 * Pohon yang menggugurkan daun: pusat tajuk dan jari-jarinya, px dunia,
 * dibaca dari map_full.png.
 */
export const POHON = [
  { x: 64, y: 22, r: 16 },
  { x: 305, y: 70, r: 10 },
  { x: 400, y: 48, r: 26 },
  { x: 592, y: 34, r: 24 },
  { x: 592, y: 146, r: 12 },
  { x: 592, y: 282, r: 12 },
  { x: 97, y: 264, r: 12 },
  { x: 97, y: 324, r: 12 },
  { x: 192, y: 506, r: 10 },
  { x: 289, y: 504, r: 12 },
  { x: 334, y: 496, r: 14 },
] as const;

/** Warga menyapu halaman tanah di timur rumah Projects, di bawah gerobak bakso. */
export const NYAPU = { x0: 506, x1: 548, kaki: 146 } as const;
