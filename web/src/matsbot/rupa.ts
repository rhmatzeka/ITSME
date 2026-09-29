/**
 * Rupa MATS-BOT, robot penjawab di samping meja Rahmat — satu sumber untuk
 * sprite di game (Phaser, lewat spritesheetTeks) dan potretnya di jendela
 * obrolan (SVG), supaya keduanya selalu sama.
 *
 * Gambar teks 15×19: tiap huruf satu piksel, `.` kosong. Garis tepinya warna
 * tinta yang sama dengan warga desa, antenanya kuning seperti panah pintu,
 * lampu dadanya merah seperti baju Rahmat. Dia melayang: di bawahnya api
 * pendorong kecil yang berkedip.
 */

/** Bagian yang sama di semua frame; `A` = lampu antena (menyala/padam per frame). */
const KEPALA = [
  '......ooo......',
  '......oAo......',
  '.......o.......',
  '....ooooooo....',
  '...owwwwwwwo...',
  '..owwwwwwwwWo..',
];
const BADAN = [
  '..owwwwwwwwWo..',
  '...oWWWWWWWo...',
  '....ooooooo....',
  '...owwwcwwWo...',
  '..oWowwwwwoWo..',
  '...ooWWWWWoo...',
  '.....ooooo.....',
];

/** Isi layar wajah (7 kolom × 4 baris), per ekspresi. */
const WAJAH = {
  diam: ['sssssss', 'seessee', 'seessee', 'sssssss'],
  kedip: ['sssssss', 'sssssss', 'seessee', 'sssssss'],
  bicara: ['sssssss', 'seessee', 'sssssss', 'ssmmmss'],
  senyum: ['sssssss', 'sessses', 'esesese', 'sssssss'],
  pikir: ['seessee', 'sssssss', 'sssssss', 'sssssss'],
} as const;

/** Nyala api pendorong, dua bentuk yang bergantian. */
const API = [
  ['......fFf......', '.......f.......'],
  ['.......F.......', '......f.f......'],
];

function frame(wajah: keyof typeof WAJAH, antena: boolean, api: 0 | 1) {
  const layar = WAJAH[wajah].map((b) => `..ow${b}Wo..`);
  return [...KEPALA, ...layar, ...BADAN, ...API[api]].map((b) =>
    b.replace('A', antena ? 'y' : 'Y')
  );
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

export const PALET_BOT: Record<string, string> = {
  o: '#2e222f', // garis tepi
  w: '#eef3f5', // badan
  W: '#aebcc6', // bayangan badan
  s: '#1b2b38', // layar wajah
  S: '#24394a',
  e: '#7fe8ff', // mata
  m: '#7fe8ff', // mulut
  y: '#ffd23f', // antena menyala
  Y: '#8a6a1c', // antena padam
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
  return `<svg viewBox="0 0 15 ${baris.length}" aria-hidden="true" shape-rendering="crispEdges">${kotak.join('')}</svg>`;
}
