/**
 * Rupa MATS-BOT, robot pendamping di desa — satu sumber untuk sprite di game
 * (Phaser, lewat spritesheetTeks) dan potretnya di jendela obrolan (SVG),
 * supaya keduanya selalu sama.
 *
 * Gambar teks 17×21: tiap huruf satu piksel, `.` kosong. Garis tepinya warna
 * tinta yang sama dengan warga desa; antena bola dan baut telinganya kuning
 * seperti panah pintu; lampu dadanya merah seperti baju Rahmat; mata di layar
 * wajahnya berkilau putih, pipinya merona. Dia melayang di atas api
 * pendorong kecil.
 *
 * Di malam hari badannya ikut digelapkan tirai, tapi FRAME_NYALA — hanya
 * piksel mata, antena, lampu dada, dan api — digambar di atas tirai: yang
 * menyala tetap tajam per piksel, bukan pendar kabur yang menutupi wajahnya.
 */

const ANTENA = [
  '.......ooo.......',
  '......oYyyo......',
  '......oyyyo......',
  '.......ooo.......',
  '........o........',
];
const KEPALA_ATAS = [
  '....ooooooooo....',
  '...owwwwwwwwwo...',
  '..owwwwwwwwwwWo..',
];
const KEPALA_BAWAH = [
  '..owkwwwwwwwkWo..',
  '...oWWWWWWWWWo...',
];
const BADAN = [
  '.....ooooooo.....',
  '....owwwcwwWo....',
  '...oWowwwwwoWo...',
  '....ooWWWWWoo....',
  '......ooooo......',
];

/** Isi layar wajah (9 kolom × 4 baris) per ekspresi; `E` = kilau mata. */
const WAJAH = {
  diam: ['sssssssss', 'sEesssEes', 'seesssees', 'sssssssss'],
  kedip: ['sssssssss', 'sssssssss', 'seesssees', 'sssssssss'],
  bicara: ['sssssssss', 'sEesssEes', 'seesssees', 'sssmmmsss'],
  senyum: ['sssssssss', 'ssesssess', 'seseseses', 'sssssssss'],
  pikir: ['sssEessEe', 'ssseessee', 'sssssssss', 'sssssssss'],
} as const;

/** Nyala api pendorong, dua bentuk yang bergantian. */
const API = [
  ['.......fFf.......', '........f........'],
  ['........F........', '.......f.f.......'],
];

function frame(wajah: keyof typeof WAJAH, antena: boolean, api: 0 | 1) {
  // baris 1-2 layar wajah diapit baut telinga
  const layar = WAJAH[wajah].map((b, i) => (i === 1 || i === 2 ? `obow${b}Wobo` : `..ow${b}Wo..`));
  const ant = ANTENA.map((b) => (antena ? b : b.replace(/[yY]/g, 'Z')));
  return [...ant, ...KEPALA_ATAS, ...layar, ...KEPALA_BAWAH, ...BADAN, ...API[api]];
}

/**
 * Urutan frame spritesheet:
 * 0-1 diam (antena berkedip, api bergantian), 2 kedip,
 * 3-4 bicara (mulut membuka-menutup), 5-6 berpikir (mata melirik ke atas,
 * antena berkedip), 7 senyum (mata ^ ^).
 */
export const FRAME_BOT = [
  frame('diam', true, 0),
  frame('diam', false, 1),
  frame('kedip', true, 0),
  frame('bicara', true, 1),
  frame('diam', true, 0),
  frame('pikir', true, 1),
  frame('pikir', false, 0),
  frame('senyum', true, 1),
];

/** Lapisan yang menyala di malam hari: frame yang sama, hanya piksel bercahaya. */
const MENYALA = new Set('eEmyYcfF');
export const FRAME_NYALA = FRAME_BOT.map((f) => f.map((b) => [...b].map((c) => (MENYALA.has(c) ? c : '.')).join('')));

export const PALET_BOT: Record<string, string> = {
  o: '#2e222f', // garis tepi
  w: '#f3f6f7', // badan
  W: '#b8c4cc', // bayangan badan
  s: '#17242f', // layar wajah
  e: '#7fe8ff', // mata
  E: '#ffffff', // kilau mata
  m: '#7fe8ff', // mulut
  k: '#ff9aa8', // pipi
  b: '#ffd23f', // baut telinga
  y: '#ffd23f', // antena menyala
  Y: '#fff3a0', // kilau antena
  Z: '#8a6a1c', // antena padam
  c: '#e83b3b', // lampu dada
  f: '#ff9f43', // api
  F: '#fff3a0',
};

/** Potret MATS-BOT (frame senyum) sebagai SVG untuk jendela obrolan. */
export function svgBot(fr = 7) {
  const baris = FRAME_BOT[fr];
  const kotak: string[] = [];
  baris.forEach((b, y) =>
    [...b].forEach((c, x) => {
      if (c !== '.') kotak.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${PALET_BOT[c]}"/>`);
    })
  );
  return `<svg viewBox="0 0 ${baris[0].length} ${baris.length}" aria-hidden="true" shape-rendering="crispEdges">${kotak.join('')}</svg>`;
}
