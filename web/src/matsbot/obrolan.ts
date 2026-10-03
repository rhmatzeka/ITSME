/**
 * Jendela obrolan MATS-BOT. Pertanyaan dikirim ke layanan kecil di server
 * terminal (terminal-server/tanya/: Groq, cadangan Gemini) — alamatnya sama
 * dengan PUBLIC_TERMINAL_URL, jalur /tanya. Kunci API-nya hanya di server.
 *
 * Irit: riwayat yang ikut dikirim cuma beberapa pesan terakhir, pertanyaan
 * dibatasi 300 huruf, dan batas pemakaian diurus server. Kalau server tidak
 * bisa dihubungi, MATS-BOT tetap menjawab dengan kalimat cadangan — bukan
 * pesan galat.
 *
 * MATS-BOT juga BERTINDAK (lihat Aksi): disuruh membuka CV, Projects, satu
 * projek tertentu, peta atau terminal, mengubah desanya (siang/malam,
 * hujan, suara), atau mengajak tur keliling, dia menutup obrolan dan
 * melakukannya sendiri. Aksinya datang dari server (tanda [[open:…]],
 * [[set:…]], [[tour]] di jawaban AI); kalau server tidak mengirimnya —
 * AI-nya lupa, atau server mati — niatnya dibaca di sini dari pertanyaannya
 * (niat), jadi "buka cv" atau "bikin malam" selalu jalan. Dulu dia cuma
 * bisa menjawab "klik menu CV".
 *
 * Di bawah tiap jawaban ada chip lanjutan: pertanyaan berikutnya yang tinggal
 * diketuk (dari AI, atau dari daftar saran kalau AI tidak memberi), dan
 * tautan DEMO / CODE kalau jawabannya soal satu projek.
 *
 * Lebih jauh lagi:
 * - Titip pesan: "aku mau ngobrol sama Rahmat soal kerjaan" → MATS-BOT
 *   menanyakan nama, kontak, dan pesannya satu per satu (tanpa AI), lalu
 *   meneruskannya ke Telegram Rahmat lewat /tanya/pesan. Isiannya tidak ikut
 *   riwayat AI dan tidak disimpan di browser.
 * - Recruiter: lowongan yang ditempel (sampai 1500 huruf) atau "we're hiring
 *   a Web3 developer" → AI menilai kecocokannya dari profil Rahmat (tanda
 *   [[hire]]), lalu jawabannya diberi tombol projek yang paling cocok, CV
 *   PDF, dan titip pesan — tidak ada yang jalan sendiri.
 * - Kejutan desa ([[surprise:…]]: kembang api, tukang nasi goreng) dan
 *   prestasi pengunjung ([[achievements]], dijawab dari jejak.ts).
 * - Ingatan (ingat.ts): pengunjung yang kembali disapa dan obrolan terakhirnya
 *   tampil lagi; bisa dihapus.
 * - Suara (bicara.ts): tanya lewat mikrofon, jawaban dibacakan.
 */
import { svgBot } from './rupa';
import { bahasa as bahasaAwal, ingatBahasa, kunjungan, lupakanObrolan, obrolanLama, simpanObrolan, type Bahasa } from './ingat';
import { ringkasan as ringkasanJejak } from './jejak';
import { baca, bisaBaca, bisaDengar, dengar, diam } from './bicara';

type Peran = 'tamu' | 'bot';
type Pesan = { peran: Peran; teks: string };
export type ModeObrolan = 'diam' | 'pikir' | 'bicara';

/** Tempat yang bisa dibuka MATS-BOT: ruas alamat rumahnya (src/rute.ts), peta, atau terminal. */
const TUJUAN = ['about', 'cv', 'projects', 'tech-stack', 'contact', 'map', 'terminal'] as const;
export type Tujuan = (typeof TUJUAN)[number];
/** Setelan desa yang bisa diubah MATS-BOT, dengan nilai yang sama seperti tombol di Settings. */
const ATUR = {
  waktu: ['siang', 'senja', 'malam', 'otomatis'],
  cuaca: ['gerimis', 'cerah', 'otomatis'],
  suara: ['nyala', 'mati'],
} as const;
export type Aksi =
  /** Buka tempat; `proyek`: slug projek yang disorot di panel Projects. */
  | { tujuan: Tujuan; proyek?: string }
  | { atur: keyof typeof ATUR; nilai: string }
  /** Tur keliling; `indo`: narasinya berbahasa Indonesia. */
  | { tur: true; indo?: boolean }
  /** Kejutan malam di desa. */
  | { kejutan: Kejutan; indo?: boolean };
/** Bukan aksi di desa, tapi lanjutan di obrolan itu sendiri. */
type AksiObrolan = { titip: true } | { jejak: true };
const KEJUTAN = ['kembang-api', 'nasgor'] as const;
export type Kejutan = (typeof KEJUTAN)[number];
type Proyek = { slug: string; title: string; demo?: string; repo?: string };
type Kontak = { label: string; value: string; url: string };

/** Aksi dari server hanya dipakai kalau bentuknya dikenal. */
function sah(a: unknown): Aksi | AksiObrolan | undefined {
  const x = a as { tujuan?: string; proyek?: string; atur?: string; nilai?: string; tur?: boolean; titip?: boolean; jejak?: boolean; kejutan?: string } | null;
  if (!x || typeof x !== 'object') return;
  if (x.tur === true) return { tur: true };
  if (x.titip === true) return { titip: true };
  if (x.jejak === true) return { jejak: true };
  if ((KEJUTAN as readonly string[]).includes(x.kejutan ?? '')) return { kejutan: x.kejutan as Kejutan };
  if (x.atur && x.atur in ATUR && (ATUR[x.atur as keyof typeof ATUR] as readonly string[]).includes(x.nilai ?? ''))
    return { atur: x.atur as keyof typeof ATUR, nilai: x.nilai! };
  if ((TUJUAN as readonly string[]).includes(x.tujuan ?? ''))
    return { tujuan: x.tujuan as Tujuan, ...(typeof x.proyek === 'string' ? { proyek: x.proyek } : {}) };
}

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';
const RIWAYAT = 4;
const WAKTU_TUNGGU = 45_000;
/** Pertanyaan biasa dibatasi server 300 huruf; lowongan kerja yang ditempel recruiter sampai 1500. */
const PANJANG = 1500;
/** CV satu halaman yang sama dengan tombol Download di cv.rahmateka.my.id. */
const CV_PDF = 'https://cv.rahmateka.my.id/Rahmat_Eka_Satria_CV.pdf';

/** Tombol pertanyaan cepat. Satu dalam bahasa Indonesia: tanda bahwa dia menjawab dalam bahasa penanya. */
const SARAN = [
  'Who is Rahmat?',
  'Show me his best project',
  "I'm hiring a Web3 developer",
  'Take me on a tour',
  'Leave Rahmat a message',
  'Light the sparklers',
  'Open his CV',
  'Ceritakan tentang Rahmat',
];
const SAPAAN: Record<Bahasa, string> = {
  en: "Beep boop! I'm MATS-BOT, Rahmat's little AI helper. Ask me about his projects, skills, or how to reach him, or tell me what to do: \"open the CV\", \"take me on a tour\", \"bikin malam\", \"leave him a message\". I answer in your language!",
  id: 'Bip bup! Aku MATS-BOT, asisten AI kecil Rahmat. Tanya aku soal projek, keahlian, atau cara menghubunginya, atau suruh aku: "buka CV", "ajak aku keliling", "bikin malam", "titip pesan buat Rahmat". Aku menjawab dalam bahasamu!',
};
const SAPAAN_KEMBALI: Record<Bahasa, string> = {
  en: 'Welcome back! Good to see you again. Want to pick up where we left off?',
  id: 'Selamat datang lagi! Senang ketemu kamu lagi. Mau lanjut dari obrolan terakhir?',
};

const indo = (s: string) =>
  /\b(apa|siapa|kamu|aku|saya|bisa|gimana|bagaimana|yang|dan|itu|ini|nya|dong|kak|mas|halo|hai|ceritakan|tolong|coba|mau|ajak|bikin|buat|buka(?:in|kan)?|lihat|liat|nyalain|matiin|hujan|malam|siang|suara|titip|pesan|panggil(?:in|kan)?|kasih|prestasi(?:ku)?|petunjuk|kami|lowongan|kerja|soal|sama|dengan|untuk|gak|nggak|ya)\b|\wnya\b/i.test(
    s
  );
const PUTUS = [
  "My antenna lost the signal. Try again in a moment, or explore the houses: each one opens part of Rahmat's portfolio!",
  'Antenaku kehilangan sinyal. Coba lagi sebentar lagi, atau jelajahi rumah-rumah di desa: tiap rumah membuka bagian portfolio Rahmat!',
];

/**
 * Tautan di jawaban (situs, email, t.me, github) bisa diklik. Teksnya tetap
 * dimasukkan sebagai teks, bukan HTML: jawaban AI tidak pernah jadi markup.
 */
const TAUTAN = /(https?:\/\/[^\s<>()]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:t\.me|github\.com|linkedin\.com)\/[^\s<>()]+)/g;
function isiTeks(p: HTMLElement, teks: string) {
  let dari = 0;
  for (const m of teks.matchAll(TAUTAN)) {
    let u = m[0].replace(/[.,!?;:]+$/, '');
    const i = m.index ?? 0;
    p.append(teks.slice(dari, i));
    const a = document.createElement('a');
    a.textContent = u;
    if (u.includes('@') && !u.startsWith('http')) u = `mailto:${u}`;
    else if (!u.startsWith('http')) u = `https://${u}`;
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.append(a);
    dari = i + a.textContent.length;
  }
  p.append(teks.slice(dari));
}

/* ---------------- niat pengunjung dibaca dari pertanyaannya ---------------- */

const SURUH =
  /\b(buka(?:in|kan)?|open|show|lihat(?:in|kan)?|liat(?:in)?|tunjuk(?:kan|in)|tampil(?:kan|in)|kasih (?:lihat|liat|tau)|go to|take me|bring me|bawa|antar(?:in|kan)?|pergi|masuk|visit|kunjungi|see|view|mau (?:lihat|liat)|ke)\b/i;
/** Diperiksa berurutan: yang lebih khusus dulu ("project" paling akhir). */
const SASARAN: [Tujuan, RegExp][] = [
  ['terminal', /\b(terminal|komputer|computer|shell)\b/i],
  ['map', /\b(map|peta)\b/i],
  ['cv', /\b(cv|resume|résumé|curriculum|riwayat hidup)\b/i],
  ['contact', /\b(contact|kontak|hubungi|email|telegram)\b/i],
  ['tech-stack', /\b(tech ?stack|stack|skills?|teknologi|keahlian)\b/i],
  ['about', /\b(about|tentang|profil|profile|biodata)\b/i],
  ['projects', /\b(projects?|projek|proyek|portfolio|portofolio|karya)\b/i],
];
const rata = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const TUR = /\b(tur|tour|keliling|jalan[- ]jalan|show me around|look around|guide me|pandu)\b/i;
/** Kata kerja untuk mengubah setelan; tanpa ini "selamat malam" bukan suruhan. */
const UBAH =
  /\b(bikin|buat|jadi(?:kan|in)?|ganti|ubah|set|make|turn|switch|change|nyala(?:in|kan)|hidup(?:in|kan)|mati(?:in|kan)|henti(?:in|kan)|stop|start|mulai|kasih|turun(?:in|kan)|mute|unmute|bisukan|play|mau|pengen|want)\b/i;
const MATIKAN = /\b(mati(?:in|kan)?|henti(?:in|kan)|stop|off|berhenti|hilang(?:in|kan)|no|tanpa|mute|bisu(?:kan)?|diam)\b/i;

/** "bikin malam", "nyalain hujan", "matiin suara" → setelan yang diubah. */
function niatAtur(q: string): Aksi | undefined {
  if (!UBAH.test(q)) return;
  const mati = MATIKAN.test(q);
  if (/\b(suara|sound|musik|music|audio|lagu|mute|unmute|bisukan)(nya)?\b/i.test(q)) return { atur: 'suara', nilai: mati ? 'mati' : 'nyala' };
  if (/\b(hujan|gerimis|rain|raining|drizzle)(nya)?\b/i.test(q)) return { atur: 'cuaca', nilai: mati ? 'cerah' : 'gerimis' };
  if (/\b(cerah|clear|sunny)\b/i.test(q)) return { atur: 'cuaca', nilai: 'cerah' };
  if (/\b(malam|night|gelap|dark)\b/i.test(q)) return { atur: 'waktu', nilai: 'malam' };
  if (/\b(senja|sore|dusk|sunset|evening)\b/i.test(q)) return { atur: 'waktu', nilai: 'senja' };
  if (/\b(siang|pagi|day|daytime|daylight|morning|terang)\b/i.test(q)) return { atur: 'waktu', nilai: 'siang' };
}

/** "Nyalain kembang api", "panggil tukang nasi goreng" — kata kerjanya wajib, "apa itu kembang api?" bukan suruhan. */
const PANGGIL =
  /\b(panggil(?:in|kan)?|call|summon|bring|datang(?:kan|in)?|pesan|order|beli(?:in)?|mau|pengen|ingin|want|light|launch|set off|nyala(?:in|kan)|main(?:in|kan)?|pasang|bikin|buat|start|mulai|show|lihat|liat|play|tunjuk(?:in|kan)?)\b/i;
function niatKejutan(q: string): Aksi | undefined {
  if (!PANGGIL.test(q)) return;
  if (/\b(kembang ?api|fireworks?|sparklers?|petasan|mercon)\b/i.test(q)) return { kejutan: 'kembang-api' };
  if (/\b(nasi ?goreng|nasgor|fried rice)\b/i.test(q)) return { kejutan: 'nasgor' };
}

/** Pertanyaan yang sebenarnya suruhan → aksinya; selain itu undefined. */
export function niat(q: string, proyek: Proyek[] = []): Aksi | undefined {
  if (TUR.test(q)) return { tur: true };
  return niatKejutan(q) ?? niatAtur(q) ?? niatBuka(q, proyek);
}

/** "Aku mau ngobrol sama Rahmat soal kerjaan", "leave him a message": titip pesan, dijawab tanpa AI. */
const TITIP =
  /\b(titip(?:kan)? pesan|tinggal(?:kan|in) pesan|kirim(?:in|kan)? pesan|pesan (?:untuk|buat|ke) (?:rahmat|dia|mas)|leave (?:rahmat |him )?a (?:message|note)|send (?:rahmat |him )?a message|message (?:rahmat|him)|(?:ngobrol|bicara|berbicara|ngomong|diskusi) (?:sama|dengan|ama) (?:rahmat|dia|mas rahmat)|(?:talk|speak|chat) (?:to|with) (?:rahmat|him)|get in touch|kerja ?sama|work (?:with|together)|collaborat\w*|tawar(?:an|in|kan) (?:kerja|kerjaan|project|projek|proyek)|job offer|hire (?:rahmat|him))\b/i;
/** Recruiter yang menempel lowongan atau terang-terangan sedang mencari orang. Sengaja ketat: "pekerjaannya apa?" bukan recruiter. */
const REKRUT =
  /\b(hiring|we(?:'re| are) (?:looking|searching) for|i(?:'m| am) (?:hiring|looking for an? (?:\w+ ){0,3}(?:developer|engineer|dev))|job (?:description|post\w*|opening|vacancy)|vacanc\w*|open (?:position|role)|lowongan|loker|kualifikasi|persyaratan|requirements|qualifications|responsibilities|kami (?:sedang )?(?:cari|mencari|membutuhkan)|dibutuhkan|recruit\w*|rekrut\w*|cari (?:\w+ )?(?:developer|programmer|engineer))\b/i;
/** Prestasi pengunjung di desa — bukan prestasi Rahmat ("prestasinya", "his achievements"). */
const JEJAK_RE = /\b(achievements?|prestasi(?:ku)?|pencapaian(?:ku)?|lencana|badges?|trophies)\b/i;
const JEJAK_KITA = /\b(my|mine|aku|saya|ku|i|desa|village|game|unlock\w*|belum|left|sisa|hints?|petunjuk|progress|dapat|got|dapet)\b|prestasiku|pencapaianku/i;
const JEJAK_RAHMAT = /\b(rahmat|his|he|dia|beliau)\b/i;
const niatJejak = (q: string) => JEJAK_RE.test(q) && JEJAK_KITA.test(q) && !JEJAK_RAHMAT.test(q);

function niatBuka(q: string, proyek: Proyek[]): Aksi | undefined {
  if (!SURUH.test(q)) return;
  const t = ` ${rata(q)} `;
  // nama projeknya disebut: judul lengkap, atau kata pertama slug-nya (ethernest, chessstake, …)
  const p = proyek.find((x) => {
    const awal = x.slug.split('-')[0];
    return t.includes(` ${rata(x.title)} `) || (awal.length >= 5 && t.includes(` ${awal} `));
  });
  if (p) return { tujuan: 'projects', proyek: p.slug };
  const tujuan = SASARAN.find(([, r]) => r.test(q))?.[0];
  return tujuan && { tujuan };
}

/** Nama tujuan di tombol dan di kalimat cadangan: [Inggris, Indonesia]. */
const NAMA: Record<Tujuan, [string, string]> = {
  about: ['About Me', 'About Me'],
  cv: ['the CV', 'CV'],
  projects: ['Projects', 'Projects'],
  'tech-stack': ['the Tech Stack', 'Tech Stack'],
  contact: ['Contact', 'Contact'],
  map: ['the map', 'peta'],
  terminal: ['the terminal', 'terminal'],
};

/** Tulisan tombol aksi dan kalimat cadangannya [Inggris, Indonesia] untuk setelan dan tur. */
const SETELAN: Record<string, [string, string, string]> = {
  'waktu:siang': ['DAYTIME', 'Switching the village to daytime.', 'Desanya kubuat siang.'],
  'waktu:senja': ['DUSK', 'Dusk coming up over the village.', 'Desanya kubuat senja.'],
  'waktu:malam': ['NIGHT', 'Night is falling: watch the street lamps light up.', 'Desanya kubuat malam: lihat lampu jalannya menyala.'],
  'waktu:otomatis': ['FOLLOW CLOCK', 'The village follows your clock again.', 'Desanya kembali mengikuti jam kamu.'],
  'cuaca:gerimis': ['RAIN', 'Here comes the rain. The villagers will open their umbrellas.', 'Hujan turun. Warga bakal membuka payungnya.'],
  'cuaca:cerah': ['CLEAR SKY', 'Clearing the sky for you.', 'Langitnya kubuat cerah.'],
  'cuaca:otomatis': ['AUTO WEATHER', 'The weather is back to now-and-then drizzle.', 'Cuacanya kembali gerimis sesekali.'],
  'suara:nyala': ['SOUND ON', 'Sound is back on.', 'Suaranya kunyalakan lagi.'],
  'suara:mati': ['MUTE', 'Muting the village.', 'Suaranya kumatikan.'],
};
const kunciAtur = (a: { atur: string; nilai: string }) => `${a.atur}:${a.nilai}`;
/** Tulisan tombol kejutan dan kalimat cadangannya [Inggris, Indonesia]. */
const KEJUTAN_TEKS: Record<Kejutan, [string, string, string]> = {
  'kembang-api': [
    'LIGHT SPARKLERS',
    'Sparklers coming up! Watch the field next to the CV house. (They only come out at night, so night is falling.)',
    'Kembang api siap! Lihat lapangan di sebelah rumah CV. (Anak-anak cuma main kalau malam, jadi kubuat malam.)',
  ],
  nasgor: [
    'CALL THE SELLER',
    "Calling the nasi goreng seller! He's pushing his cart in from the west bridge along the north road. Listen for the tek-tek.",
    'Tukang nasi goreng kupanggil! Dia datang mendorong gerobak dari jembatan barat lewat jalan utara. Dengar tek-tek-nya.',
  ],
};

/* ---------------- titip pesan ---------------- */

const TEKS_TITIP = {
  mulai: [
    "Sure! I'll pass your message to Rahmat on Telegram. First, what's your name?",
    'Boleh! Pesanmu kuteruskan ke Telegram Rahmat. Pertama, siapa namamu?',
  ],
  mulaiRekrut: [
    "Happy to pass it on to Rahmat on Telegram. What's your name (and company, if you like)?",
    'Siap, kuteruskan ke Telegram Rahmat. Siapa namamu (dan perusahaannya, kalau mau)?',
  ],
  namaSalah: ["What should I call you? Just your name is fine.", 'Siapa namamu? Nama saja cukup.'],
  kontak: [
    (n: string) => `Nice to meet you, ${n}! Where can Rahmat reply? An email, a @telegram username or a WhatsApp number.`,
    (n: string) => `Salam kenal, ${n}! Rahmat bisa membalas ke mana? Tulis email, @username Telegram, atau nomor WhatsApp.`,
  ],
  kontakSalah: [
    "Hmm, that doesn't look like an email, @username or phone number. Try again?",
    'Hmm, itu belum seperti email, @username, atau nomor HP. Coba lagi?',
  ],
  pesan: ['Got it. Now your message for Rahmat:', 'Oke. Sekarang tulis pesanmu untuk Rahmat:'],
  pesanLowongan: [
    'Got it. Now your message for Rahmat (the job post you pasted comes along too):',
    'Oke. Sekarang tulis pesanmu untuk Rahmat (lowongan yang kamu tempel ikut kukirim):',
  ],
  pesanSalah: ['Write a few words for Rahmat first.', 'Tulis beberapa kata untuk Rahmat dulu.'],
  cek: [
    (t: Titip) => `Here's what I'll send:\nName: ${t.nama}\nContact: ${t.kontak}\nMessage: ${t.pesan}`,
    (t: Titip) => `Ini yang akan kukirim:\nNama: ${t.nama}\nKontak: ${t.kontak}\nPesan: ${t.pesan}`,
  ],
  terkirim: [
    (k: string) => `Sent! It's on Rahmat's Telegram now, and he'll reply to ${k}.`,
    (k: string) => `Terkirim! Pesanmu sudah masuk ke Telegram Rahmat, nanti dia membalas ke ${k}.`,
  ],
  gagal: ["I couldn't deliver it right now. You can reach him directly:", 'Pesannya belum bisa kukirim sekarang. Kamu bisa langsung menghubunginya:'],
  batas: [
    "That's a lot of messages for today. Please reach him directly:",
    'Sudah banyak pesan hari ini. Langsung hubungi dia saja ya:',
  ],
  batal: ['Cancelled, nothing was sent.', 'Oke, dibatalkan. Tidak ada yang terkirim.'],
  tombol: [
    ['SEND ✓', 'EDIT', 'CANCEL'],
    ['KIRIM ✓', 'UBAH', 'BATAL'],
  ],
  isi: [
    ['Your name…', 'Email, @telegram or WhatsApp…', 'Your message…'],
    ['Namamu…', 'Email, @telegram, atau WhatsApp…', 'Pesanmu…'],
  ],
} as const;
type Titip = {
  langkah: 'nama' | 'kontak' | 'pesan' | 'cek';
  rekrut: boolean;
  nama?: string;
  kontak?: string;
  pesan?: string;
  lowongan?: string;
  topik?: string;
};
/** Sama dengan pemeriksaan di server (tanya.mjs KONTAK). */
const KONTAK_SAH =
  /^(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)+|@\w{3,32}|\+?[\d\s().-]{8,20}|(?:https?:\/\/)?(?:www\.)?(?:t\.me|wa\.me|linkedin\.com|github\.com|x\.com|twitter\.com|instagram\.com)\/\S+)$/i;
const BATAL = /^(batal(?:kan|in)?|cancel|stop|gak jadi|ga jadi|nggak jadi|enggak jadi|nevermind|never mind|no thanks)\b/i;

/** Jawaban cadangan untuk recruiter saat server tidak bisa dihubungi. */
const REKRUT_CADANGAN = [
  "Rahmat is a Web3 & Full-Stack developer: Solidity smart contracts and the React/Next.js apps around them, 9th place at Monad Blitz Jakarta. Grab his CV below, or leave him a message and he'll get back to you.",
  'Rahmat adalah Web3 & Full-Stack developer: smart contract Solidity dan aplikasi React/Next.js di sekitarnya, juara 9 Monad Blitz Jakarta. Unduh CV-nya di bawah, atau titip pesan dan dia akan membalas.',
];

/** Jawaban yang menyebut terminal atau game-nya mendapat tombol "OPEN TERMINAL". */
const SOAL_TERMINAL = /\bterminal\b|\bsnake\b/i;

/** Tambahan dari halaman (Desa.astro) yang tidak berupa aksi di desa. */
export type Ekstra = {
  /** Tautan di halaman Contact: ditawarkan kalau pesan titipan tidak bisa dikirim. */
  kontak?: () => Kontak[];
  /** Kabari prestasi desa (jejak.ts) — Desa.astro mengumumkannya lewat MATS-BOT. */
  jejak?: (id: string) => void;
};

export function pasangObrolan(
  akar: HTMLElement,
  kabar: (m: ModeObrolan) => void,
  /** Tutup obrolan dan nyalakan monitor terminal di meja Rahmat. */
  bukaTerminal?: () => void,
  /** Tutup obrolan, nyalakan terminal, dan biarkan MATS-BOT mengetikkan perintah ini. */
  jalankan?: (perintah: string) => void,
  /** Tutup obrolan dan lakukan aksinya: buka tempat, ubah setelan desa, kejutan, atau mulai tur. */
  buka?: (a: Aksi) => void,
  /** Projek yang ada, untuk mengenali namanya di pertanyaan. */
  proyek: () => Proyek[] = () => [],
  ekstra: Ekstra = {}
) {
  const isi = akar.querySelector<HTMLElement>('#bot-isi')!;
  const saran = akar.querySelector<HTMLElement>('#bot-saran')!;
  const form = akar.querySelector<HTMLFormElement>('#bot-form')!;
  const masuk = akar.querySelector<HTMLInputElement>('#bot-input')!;
  const kirimBtn = form.querySelector<HTMLButtonElement>('.obrolan-kirim')!;
  const mic = akar.querySelector<HTMLButtonElement>('#bot-mic');
  const pengeras = akar.querySelector<HTMLButtonElement>('#bot-suara');
  const lupa = akar.querySelector<HTMLButtonElement>('#bot-lupa');
  const wajah = svgBot(7);
  const riwayat: Pesan[] = [];
  let sibuk = false;
  /** Bahasa pertanyaan terakhir pengunjung: dipakai semua kalimat buatan halaman. */
  let bhs: Bahasa = bahasaAwal();
  const ke = () => (bhs === 'id' ? 1 : 0);
  /** Titip pesan yang sedang berjalan: masukan pengunjung jadi isiannya, bukan pertanyaan. */
  let titip: Titip | null = null;
  // aksi yang sebentar lagi dijalankan sendiri; batal kalau pengunjung keburu mengetik lagi
  let tundaAksi: ReturnType<typeof setTimeout> | undefined;
  masuk.addEventListener('input', () => clearTimeout(tundaAksi));
  const isianAsli = masuk.placeholder;
  masuk.maxLength = PANJANG;

  function gelembung(peran: Peran, teks = '') {
    const el = document.createElement('div');
    el.className = `pesan ${peran}`;
    if (peran === 'bot') {
      const w = document.createElement('span');
      w.className = 'pesan-wajah';
      w.innerHTML = wajah;
      el.append(w);
    }
    const p = document.createElement('p');
    isiTeks(p, teks);
    el.append(p);
    isi.append(el);
    isi.scrollTop = isi.scrollHeight;
    return el;
  }
  function mengetik() {
    const el = gelembung('bot');
    el.classList.add('mengetik');
    el.querySelector('p')!.innerHTML = '<span></span><span></span><span></span>';
    el.setAttribute('aria-label', 'MATS-BOT is thinking');
    return el;
  }
  /** Tombol di dalam gelembung jawaban. */
  function tombol(p: HTMLElement, teks: string, aksi: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'obrolan-aksi';
    b.textContent = teks;
    b.addEventListener('click', aksi);
    p.append(b);
  }
  function tautan(p: HTMLElement, teks: string, url: string) {
    const a = document.createElement('a');
    a.className = 'obrolan-aksi';
    a.textContent = teks;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.append(a);
  }

  /* ---------------- suara ---------------- */
  let bacaNyala = false;
  try {
    bacaNyala = localStorage.getItem('mapporto:bot-baca') === '1';
  } catch {
    /* tetap mati */
  }
  const ucapkan = (teks: string) => baca(teks, bhs, () => kabar('bicara'));
  /** Kalimat MATS-BOT buatan halaman (titip pesan, prestasi): tampil, dan dibacakan kalau suaranya nyala. */
  function botBicara(teks: string) {
    const el = gelembung('bot', teks);
    kabar('bicara');
    if (bacaNyala) ucapkan(teks);
    return el;
  }

  /*
   * Baris chip di bawah jawaban terakhir — satu saja sekaligus. Dipakai
   * pertanyaan lanjutan (chipLanjut) dan pilihan titip pesan (KIRIM/BATAL).
   */
  let baris: HTMLElement | undefined;
  function barisChip(anak: HTMLElement[]) {
    baris?.remove();
    baris = undefined;
    if (!anak.length) return;
    const el = (baris = document.createElement('div'));
    el.className = 'obrolan-lanjut';
    el.append(...anak);
    isi.append(el);
    isi.scrollTop = isi.scrollHeight;
  }
  function chip(teks: string, klik: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'obrolan-chip';
    b.textContent = teks;
    b.addEventListener('click', klik);
    return b;
  }

  /*
   * Chip lanjutan: tautan DEMO / CODE projek yang sedang dibicarakan, lalu
   * sampai tiga pertanyaan berikutnya. Yang dari AI dipakai dulu; kalau
   * tidak ada, saran yang belum pernah ditanyakan.
   */
  const ditanya = new Set<string>();
  function chipLanjut(q: string, jawaban: string, aksi: Aksi | undefined, lanjut: string[]) {
    ditanya.add(q.toLowerCase());
    const anak: HTMLElement[] = [];
    const slug = aksi && 'tujuan' in aksi ? aksi.proyek : undefined;
    const t = ` ${rata(jawaban)} `;
    const pr = proyek().find((x) => x.slug === slug) ?? proyek().find((x) => t.includes(` ${rata(x.title)} `));
    if (pr) {
      for (const [teks, url] of [['Demo ↗', pr.demo], ['Code ↗', pr.repo]] as const) {
        if (!url) continue;
        const a = document.createElement('a');
        a.className = 'obrolan-chip tautan';
        a.textContent = `${pr.title}: ${teks}`;
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        anak.push(a);
      }
    }
    // yang baru bertanya sebagai recruiter tidak ditawari "I'm hiring…" lagi
    const usul = (lanjut.length ? lanjut : SARAN)
      .filter((x) => !ditanya.has(x.toLowerCase()) && !(REKRUT.test(q) && REKRUT.test(x)))
      .slice(0, 3);
    for (const x of usul) anak.push(chip(x, () => kirim(x)));
    barisChip(anak);
  }

  /* ---------------- ingatan ---------------- */
  /** Obrolan yang disimpan di browser pengunjung (tanpa isian titip pesan). */
  const tersimpan: Pesan[] = [];
  function ingat(q: string, jawaban: string) {
    tersimpan.push({ peran: 'tamu', teks: q }, { peran: 'bot', teks: jawaban });
    simpanObrolan(tersimpan);
    if (lupa) lupa.hidden = false;
  }

  /* ---------------- titip pesan ---------------- */
  function aturKolom() {
    const k = titip ? { nama: 0, kontak: 1, pesan: 2, cek: -1 }[titip.langkah] : -1;
    masuk.placeholder = k >= 0 ? TEKS_TITIP.isi[ke()][k] : isianAsli;
    masuk.maxLength = k >= 0 ? [60, 100, 1000][k] : PANJANG;
    masuk.autocomplete = titip?.langkah === 'nama' ? 'name' : titip?.langkah === 'kontak' ? 'email' : 'off';
  }
  const chipBatal = () => chip(TEKS_TITIP.tombol[ke()][2], batalTitip);
  /**
   * Mulai menanyakan nama, kontak, dan pesan. `sudahDisapa`: AI sudah bilang
   * akan meneruskan pesannya, jadi MATS-BOT langsung menanyakan nama.
   */
  function mulaiTitip(rekrut: boolean, lowongan?: string, topik?: string, sudahDisapa = false) {
    titip = { langkah: 'nama', rekrut, lowongan, topik };
    const i = ke();
    botBicara(sudahDisapa ? TEKS_TITIP.namaSalah[i] : rekrut ? TEKS_TITIP.mulaiRekrut[i] : TEKS_TITIP.mulai[i]);
    barisChip([chipBatal()]);
    aturKolom();
    if (!matchMedia('(pointer: coarse)').matches) masuk.focus();
  }
  function batalTitip() {
    if (!titip) return;
    titip = null;
    barisChip([]);
    aturKolom();
    botBicara(TEKS_TITIP.batal[ke()]);
  }
  function tampilCek() {
    const t = titip!;
    const [kirimT, ubahT, batalT] = TEKS_TITIP.tombol[ke()];
    botBicara(TEKS_TITIP.cek[ke()](t));
    barisChip([chip(kirimT, () => void kirimTitip()), chip(ubahT, () => mulaiTitip(t.rekrut, t.lowongan, t.topik)), chip(batalT, batalTitip)]);
    aturKolom();
  }
  function langkahTitip(q: string) {
    const t = titip!;
    const i = ke();
    gelembung('tamu', q);
    barisChip([]);
    if (BATAL.test(q)) return batalTitip();
    if (t.langkah === 'nama') {
      if (q.length < 2) botBicara(TEKS_TITIP.namaSalah[i]);
      else {
        t.nama = q.slice(0, 60);
        t.langkah = 'kontak';
        botBicara(TEKS_TITIP.kontak[i](t.nama));
      }
    } else if (t.langkah === 'kontak') {
      if (!KONTAK_SAH.test(q)) botBicara(TEKS_TITIP.kontakSalah[i]);
      else {
        t.kontak = q.slice(0, 100);
        t.langkah = 'pesan';
        botBicara((t.lowongan ? TEKS_TITIP.pesanLowongan : TEKS_TITIP.pesan)[i]);
      }
    } else if (t.langkah === 'pesan') {
      if (q.length < 3) botBicara(TEKS_TITIP.pesanSalah[i]);
      else {
        t.pesan = q.slice(0, 1000);
        t.langkah = 'cek';
        return tampilCek();
      }
    } else {
      // langkah cek: "ya" / "kirim" mengirim, "ubah" mengulang, selain itu ringkasannya ditampilkan lagi
      if (/^(ya|yes|y|ok|oke|okay|kirim|send|sip|gas|lanjut)\b/i.test(q)) return void kirimTitip();
      if (/^(ubah|edit|ganti|change|ulang)\b/i.test(q)) return mulaiTitip(t.rekrut, t.lowongan, t.topik);
      return tampilCek();
    }
    barisChip([chipBatal()]);
    aturKolom();
  }
  async function kirimTitip() {
    const t = titip;
    if (!t || sibuk) return;
    sibuk = true;
    kirimBtn.disabled = true;
    barisChip([]);
    const tunggu = mengetik();
    kabar('pikir');
    let hasil: 'ok' | 'batas' | 'gagal' = 'gagal';
    if (ALAMAT) {
      try {
        const r = await fetch(new URL('tanya/pesan', ALAMAT), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nama: t.nama,
            kontak: t.kontak,
            pesan: t.pesan,
            jenis: t.rekrut ? 'rekrut' : 'titip',
            lowongan: t.lowongan,
            topik: t.topik,
            bahasa: bhs,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        const d = (await r.json().catch(() => ({}))) as { ok?: boolean };
        hasil = r.ok && d.ok ? 'ok' : r.status === 429 ? 'batas' : 'gagal';
      } catch {
        /* jalur cadangan di bawah */
      }
    }
    tunggu.remove();
    titip = null;
    aturKolom();
    sibuk = false;
    kirimBtn.disabled = false;
    const i = ke();
    if (hasil === 'ok') {
      botBicara(TEKS_TITIP.terkirim[i](t.kontak ?? ''));
      chipLanjut('', '', undefined, []);
      return;
    }
    // tidak terkirim: tawarkan jalur langsung dari halaman Contact (email, Telegram)
    const el = botBicara((hasil === 'batas' ? TEKS_TITIP.batas : TEKS_TITIP.gagal)[i]);
    const p = el.querySelector('p')!;
    const langsung = (ekstra.kontak?.() ?? []).filter((k) => /mail|telegram|whatsapp/i.test(`${k.label} ${k.url}`));
    for (const k of langsung) tautan(p, `${k.label}: ${k.value}`, k.url);
    if (!langsung.length && buka) tombol(p, 'OPEN CONTACT ›', () => buka({ tujuan: 'contact' }));
  }

  /* ---------------- bertanya ---------------- */
  async function kirim(teks: string, opsi: { suara?: boolean } = {}) {
    const q = teks.trim().slice(0, PANJANG);
    if (!q || sibuk) return;
    clearTimeout(tundaAksi);
    diam();
    masuk.value = '';
    saran.hidden = true;
    if (titip) return langkahTitip(q);
    barisChip([]);
    bhs = indo(q) ? 'id' : 'en';
    ingatBahasa(bhs);
    const id = ke();
    const rekrutLokal = REKRUT.test(q);

    // prestasi dan titip pesan dijawab di sini, tanpa AI
    if (niatJejak(q)) {
      gelembung('tamu', q);
      const j = ringkasanJejak(bhs);
      botBicara(j);
      ingat(q, j);
      chipLanjut(q, j, undefined, []);
      return;
    }
    if (TITIP.test(q) && !rekrutLokal) {
      gelembung('tamu', q);
      mulaiTitip(false, undefined, q.slice(0, 200));
      return;
    }

    sibuk = true;
    kirimBtn.disabled = true;
    gelembung('tamu', q);
    const tunggu = mengetik();
    kabar('pikir');

    let jawaban = '';
    let perintah: string | undefined;
    let aksi: Aksi | undefined;
    let lanjutan: AksiObrolan | undefined;
    let lanjut: string[] = [];
    let rekrut = rekrutLokal;
    let dijawabAI = false;
    const lokal = buka ? niat(q, proyek()) : undefined;
    // hanya suruhan ("buka…", "bikin malam") yang dijalankan sendiri; aksi di jawaban atas pertanyaan biasa cuma jadi tombol
    let disuruh = !!lokal || SURUH.test(q);
    if (ALAMAT) {
      try {
        const r = await fetch(new URL('tanya', ALAMAT), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pertanyaan: q, riwayat: riwayat.slice(-RIWAYAT) }),
          signal: AbortSignal.timeout(WAKTU_TUNGGU),
        });
        const d = (await r.json()) as { jawaban?: string; perintah?: string; aksi?: unknown; lanjut?: unknown; rekrut?: boolean; sumber?: string };
        // jawaban "sedang istirahat / kena batas" tidak menghalangi aksinya
        if (r.ok && (d.jawaban || d.aksi) && d.sumber !== 'batas' && d.sumber !== 'cadangan') {
          // aksi tanpa kalimat: kalimatnya diisi di bawah
          jawaban = d.jawaban ?? '';
          perintah = d.perintah;
          const a = sah(d.aksi);
          if (a && ('titip' in a || 'jejak' in a)) lanjutan = a;
          else aksi = a;
          if (Array.isArray(d.lanjut)) lanjut = d.lanjut.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 3);
          rekrut ||= d.rekrut === true;
          dijawabAI = true;
        } else if (r.ok && d.jawaban && !lokal) {
          jawaban = d.jawaban;
        }
      } catch {
        /* jawaban cadangan di bawah */
      }
    }
    // server tidak memberi aksi: pakai niat yang dibaca dari pertanyaannya sendiri
    aksi = !buka || perintah ? undefined : (aksi ?? (rekrut ? undefined : lokal));
    // recruiter: tidak ada yang jalan sendiri — projeknya, CV, dan titip pesan jadi tombol
    if (rekrut) disuruh = false;
    if (aksi && ('tur' in aksi || 'kejutan' in aksi)) aksi.indo = !!id;
    if (!jawaban) {
      if (rekrut) jawaban = REKRUT_CADANGAN[id];
      else if (lanjutan) jawaban = '';
      else if (!aksi) jawaban = PUTUS[id];
      else if ('tur' in aksi) jawaban = ['Hop on! I will take you around the village, house by house.', 'Ayo! Kuajak keliling desa, rumah demi rumah.'][id];
      else if ('atur' in aksi) jawaban = SETELAN[kunciAtur(aksi)][1 + id];
      else if ('kejutan' in aksi) jawaban = KEJUTAN_TEKS[aksi.kejutan][1 + id];
      else {
        const slug = aksi.proyek;
        const nama = proyek().find((x) => x.slug === slug)?.title ?? NAMA[aksi.tujuan][id];
        jawaban = [`On it! Opening ${nama} for you.`, `Siap! Aku bukakan ${nama} untukmu.`][id];
      }
    }
    if (lanjutan && 'jejak' in lanjutan) jawaban = [jawaban, ringkasanJejak(bhs)].filter(Boolean).join('\n\n');
    tunggu.remove();
    if (jawaban) {
      const el = gelembung('bot', jawaban);
      const p = el.querySelector('p')!;
      if (perintah && jalankan) {
        // perintah yang akan diketik MATS-BOT, terlihat dulu sebelum dijalankan
        const kode = document.createElement('pre');
        kode.className = 'obrolan-kode';
        kode.textContent = perintah;
        p.append(kode);
        const cmd = perintah;
        tombol(p, '▶ RUN IN TERMINAL', () => jalankan(cmd));
      } else if (rekrut) {
        // projek yang paling cocok, CV, dan titip pesan: recruiter yang memilih
        if (aksi && buka) {
          const a = aksi;
          const judul = 'tujuan' in a ? (proyek().find((x) => x.slug === a.proyek)?.title ?? NAMA[a.tujuan][0].replace(/^the /, '')) : '';
          if (judul) tombol(p, `OPEN ${judul.toUpperCase()} ›`, () => buka(a));
        }
        tautan(p, ['DOWNLOAD CV (PDF) ↓', 'UNDUH CV (PDF) ↓'][id], CV_PDF);
        tombol(p, ['MESSAGE RAHMAT ✉', 'TITIP PESAN KE RAHMAT ✉'][id], () => {
          if (titip || sibuk) return;
          mulaiTitip(true, q.length > 120 ? q : undefined, q.slice(0, 200));
        });
      } else if (aksi && buka) {
        /*
         * Dijalankan sendiri setelah jawabannya sempat terbaca; tombolnya untuk
         * yang tidak mau menunggu, dan untuk mengulanginya nanti dari riwayat.
         */
        const a = aksi;
        const jalan = () => {
          clearTimeout(tundaAksi);
          buka(a);
        };
        const tulisan =
          'tur' in a
            ? 'START THE TOUR'
            : 'atur' in a
              ? SETELAN[kunciAtur(a)][0]
              : 'kejutan' in a
                ? KEJUTAN_TEKS[a.kejutan][0]
                : `OPEN ${NAMA[a.tujuan][0].replace(/^the /, '').toUpperCase()}`;
        tombol(p, `${tulisan} ›`, jalan);
        if (disuruh) tundaAksi = setTimeout(() => !akar.hidden && jalan(), Math.min(1100 + jawaban.length * 30, 4000));
      } else if (bukaTerminal && SOAL_TERMINAL.test(jawaban)) {
        tombol(p, 'OPEN TERMINAL ›', bukaTerminal);
      }
    }
    if (!perintah && !(lanjutan && 'titip' in lanjutan)) chipLanjut(q, jawaban, aksi, lanjut);
    isi.scrollTop = isi.scrollHeight;
    // perintahnya ikut diingat (dipotong), supaya "jalankan lagi" / "ubah jadi..." dimengerti
    riwayat.push({ peran: 'tamu', teks: q }, { peran: 'bot', teks: perintah ? `${jawaban}\n[terminal] ${perintah.slice(0, 300)}` : jawaban });
    if (jawaban) ingat(q.slice(0, 300), jawaban);
    if (dijawabAI) ekstra.jejak?.('mats-bot');
    kabar('bicara');
    if (jawaban && (bacaNyala || opsi.suara)) ucapkan(jawaban);
    sibuk = false;
    kirimBtn.disabled = false;
    // AI bilang pesannya akan diteruskan: langsung tanyakan namanya
    if (lanjutan && 'titip' in lanjutan) mulaiTitip(rekrut, rekrut && q.length > 120 ? q : undefined, q.slice(0, 200), !!jawaban);
    // di HP papan ketik tidak dibuka lagi dengan sendirinya
    else if (!matchMedia('(pointer: coarse)').matches) masuk.focus();
  }

  /* ---------------- mikrofon dan pengeras suara ---------------- */
  let berhentiDengar: (() => void) | null = null;
  if (mic && bisaDengar()) {
    mic.hidden = false;
    mic.addEventListener('click', () => {
      if (berhentiDengar) return berhentiDengar();
      if (sibuk) return;
      diam();
      mic.classList.add('dengar');
      mic.setAttribute('aria-pressed', 'true');
      masuk.value = '';
      masuk.placeholder = ['Listening… speak now', 'Mendengarkan… silakan bicara'][ke()];
      berhentiDengar = dengar(
        bhs,
        (t) => (masuk.value = t),
        (t, galat) => {
          berhentiDengar = null;
          mic.classList.remove('dengar');
          mic.setAttribute('aria-pressed', 'false');
          aturKolom();
          if (t) return void kirim(t, { suara: true });
          if (galat === 'not-allowed' || galat === 'service-not-allowed')
            botBicara(
              [
                "I can't hear you: the microphone is blocked for this site. Allow it in the browser's address bar, or just type.",
                'Aku tidak bisa mendengar: mikrofon diblokir untuk situs ini. Izinkan lewat ikon di kolom alamat browser, atau ketik saja.',
              ][ke()]
            );
          else if (galat === 'no-speech') masuk.placeholder = ["I didn't catch that. Tap the mic and try again.", 'Tidak terdengar. Ketuk mikrofon dan coba lagi.'][ke()];
        }
      );
    });
  }
  if (pengeras && bisaBaca()) {
    pengeras.hidden = false;
    const tampil = () => {
      pengeras.setAttribute('aria-pressed', String(bacaNyala));
      pengeras.classList.toggle('nyala', bacaNyala);
      pengeras.title = bacaNyala ? 'Stop reading answers aloud' : 'Read answers aloud';
    };
    pengeras.addEventListener('click', () => {
      bacaNyala = !bacaNyala;
      try {
        localStorage.setItem('mapporto:bot-baca', bacaNyala ? '1' : '0');
      } catch {
        /* cuma untuk kunjungan ini */
      }
      if (!bacaNyala) diam();
      tampil();
    });
    tampil();
  }

  /* ---------------- pembuka ---------------- */
  for (const s of SARAN) saran.append(chip(s, () => kirim(s)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    kirim(masuk.value);
  });

  // pengunjung yang kembali: obrolan terakhirnya tampil lagi, lalu disapa
  const lama = obrolanLama();
  const { kembali } = kunjungan();
  if (lama.length) {
    const garis = document.createElement('p');
    garis.className = 'obrolan-garis lama';
    garis.textContent = ['Earlier chat', 'Obrolan sebelumnya'][ke()];
    isi.append(garis);
    for (const m of lama) gelembung(m.peran, m.teks).classList.add('lama');
    tersimpan.push(...lama);
    riwayat.push(...lama.slice(-RIWAYAT));
    for (const m of lama) if (m.peran === 'tamu') ditanya.add(m.teks.toLowerCase());
  }
  gelembung('bot', lama.length ? SAPAAN_KEMBALI[bhs] : kembali ? `${['Welcome back!', 'Selamat datang lagi!'][ke()]} ${SAPAAN[bhs].replace(/^[^!]+! /, '')}` : SAPAAN[bhs]);
  if (lupa) {
    lupa.hidden = !lama.length;
    lupa.addEventListener('click', () => {
      lupakanObrolan();
      tersimpan.length = 0;
      riwayat.length = 0;
      isi.querySelectorAll('.lama').forEach((el) => el.remove());
      lupa.hidden = true;
      botBicara(["Done, I've forgotten our chat.", 'Beres, obrolan kita sudah kulupakan.'][ke()]);
    });
  }

  return {
    /** Fokus ke kolom tanya — hanya di perangkat berpapan ketik fisik. */
    fokus() {
      if (!matchMedia('(pointer: coarse)').matches) masuk.focus();
    },
    /** Jendela ditutup: berhenti mendengarkan dan berhenti membacakan. */
    tutup() {
      berhentiDengar?.();
      diam();
    },
  };
}
