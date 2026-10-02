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
 */
import { svgBot } from './rupa';

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
  | { tur: true; indo?: boolean };
type Proyek = { slug: string; title: string; demo?: string; repo?: string };

/** Aksi dari server hanya dipakai kalau bentuknya dikenal. */
function sah(a: unknown): Aksi | undefined {
  const x = a as { tujuan?: string; proyek?: string; atur?: string; nilai?: string; tur?: boolean } | null;
  if (!x || typeof x !== 'object') return;
  if (x.tur === true) return { tur: true };
  if (x.atur && x.atur in ATUR && (ATUR[x.atur as keyof typeof ATUR] as readonly string[]).includes(x.nilai ?? ''))
    return { atur: x.atur as keyof typeof ATUR, nilai: x.nilai! };
  if ((TUJUAN as readonly string[]).includes(x.tujuan ?? ''))
    return { tujuan: x.tujuan as Tujuan, ...(typeof x.proyek === 'string' ? { proyek: x.proyek } : {}) };
}

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';
const RIWAYAT = 4;
const WAKTU_TUNGGU = 45_000;

/** Tombol pertanyaan cepat. Satu dalam bahasa Indonesia: tanda bahwa dia menjawab dalam bahasa penanya. */
const SARAN = [
  'Who is Rahmat?',
  'Show me his best project',
  'Open his CV',
  'Take me on a tour',
  "What's his tech stack?",
  'Any games here?',
  'How can I contact him?',
  'Ceritakan tentang Rahmat',
];
const SAPAAN =
  "Beep boop! I'm MATS-BOT, Rahmat's little AI helper. Ask me about his projects, skills, or how to reach him, or tell me what to do: \"open the CV\", \"take me on a tour\", \"bikin malam\", \"nyalain hujan\". I answer in your language!";

const indo = (s: string) =>
  /\b(apa|siapa|kamu|aku|bisa|gimana|bagaimana|yang|dan|itu|ini|nya|dong|kak|mas|halo|hai|ceritakan|tolong|coba|mau|ajak|bikin|buat|buka(?:in|kan)?|lihat|liat|nyalain|matiin|hujan|malam|siang|suara)\b|\wnya\b/i.test(
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

/** Pertanyaan yang sebenarnya suruhan → aksinya; selain itu undefined. */
export function niat(q: string, proyek: Proyek[] = []): Aksi | undefined {
  if (TUR.test(q)) return { tur: true };
  return niatAtur(q) ?? niatBuka(q, proyek);
}

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

/** Jawaban yang menyebut terminal atau game-nya mendapat tombol "OPEN TERMINAL". */
const SOAL_TERMINAL = /\bterminal\b|\bsnake\b/i;

export function pasangObrolan(
  akar: HTMLElement,
  kabar: (m: ModeObrolan) => void,
  /** Tutup obrolan dan nyalakan monitor terminal di meja Rahmat. */
  bukaTerminal?: () => void,
  /** Tutup obrolan, nyalakan terminal, dan biarkan MATS-BOT mengetikkan perintah ini. */
  jalankan?: (perintah: string) => void,
  /** Tutup obrolan dan lakukan aksinya: buka tempat, ubah setelan desa, atau mulai tur. */
  buka?: (a: Aksi) => void,
  /** Projek yang ada, untuk mengenali namanya di pertanyaan. */
  proyek: () => Proyek[] = () => []
) {
  const isi = akar.querySelector<HTMLElement>('#bot-isi')!;
  const saran = akar.querySelector<HTMLElement>('#bot-saran')!;
  const form = akar.querySelector<HTMLFormElement>('#bot-form')!;
  const masuk = akar.querySelector<HTMLInputElement>('#bot-input')!;
  const kirimBtn = form.querySelector<HTMLButtonElement>('button')!;
  const wajah = svgBot(7);
  const riwayat: Pesan[] = [];
  let sibuk = false;
  // aksi yang sebentar lagi dijalankan sendiri; batal kalau pengunjung keburu mengetik lagi
  let tundaAksi: ReturnType<typeof setTimeout> | undefined;
  masuk.addEventListener('input', () => clearTimeout(tundaAksi));

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

  /*
   * Chip di bawah jawaban terakhir: tautan DEMO / CODE projek yang sedang
   * dibicarakan, lalu sampai tiga pertanyaan berikutnya. Yang dari AI
   * dipakai dulu; kalau tidak ada, saran yang belum pernah ditanyakan.
   */
  const ditanya = new Set<string>();
  let baris: HTMLElement | undefined;
  function chipLanjut(q: string, jawaban: string, aksi: Aksi | undefined, lanjut: string[]) {
    ditanya.add(q.toLowerCase());
    const el = (baris = document.createElement('div'));
    el.className = 'obrolan-lanjut';
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
        el.append(a);
      }
    }
    const usul = (lanjut.length ? lanjut : SARAN).filter((x) => !ditanya.has(x.toLowerCase())).slice(0, 3);
    for (const x of usul) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'obrolan-chip';
      b.textContent = x;
      b.addEventListener('click', () => kirim(x));
      el.append(b);
    }
    if (el.childElementCount) isi.append(el);
  }

  async function kirim(teks: string) {
    const q = teks.trim().slice(0, 300);
    if (!q || sibuk) return;
    clearTimeout(tundaAksi);
    baris?.remove();
    sibuk = true;
    masuk.value = '';
    kirimBtn.disabled = true;
    saran.hidden = true;
    gelembung('tamu', q);
    const tunggu = gelembung('bot');
    tunggu.classList.add('mengetik');
    tunggu.querySelector('p')!.innerHTML = '<span></span><span></span><span></span>';
    tunggu.setAttribute('aria-label', 'MATS-BOT is thinking');
    kabar('pikir');

    let jawaban = '';
    let perintah: string | undefined;
    let aksi: Aksi | undefined;
    let lanjut: string[] = [];
    const id = indo(q) ? 1 : 0;
    const lokal = buka ? niat(q, proyek()) : undefined;
    // hanya suruhan ("buka…", "bikin malam") yang dijalankan sendiri; aksi di jawaban atas pertanyaan biasa cuma jadi tombol
    const disuruh = !!lokal || SURUH.test(q);
    if (ALAMAT) {
      try {
        const r = await fetch(new URL('tanya', ALAMAT), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pertanyaan: q, riwayat: riwayat.slice(-RIWAYAT) }),
          signal: AbortSignal.timeout(WAKTU_TUNGGU),
        });
        const d = (await r.json()) as { jawaban?: string; perintah?: string; aksi?: unknown; lanjut?: unknown; sumber?: string };
        // jawaban "sedang istirahat / kena batas" tidak menghalangi aksinya
        if (r.ok && (d.jawaban || d.aksi) && d.sumber !== 'batas' && d.sumber !== 'cadangan') {
          // aksi tanpa kalimat: kalimatnya diisi di bawah
          jawaban = d.jawaban ?? '';
          perintah = d.perintah;
          aksi = sah(d.aksi);
          if (Array.isArray(d.lanjut)) lanjut = d.lanjut.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 3);
        } else if (r.ok && d.jawaban && !lokal) {
          jawaban = d.jawaban;
        }
      } catch {
        /* jawaban cadangan di bawah */
      }
    }
    // server tidak memberi aksi: pakai niat yang dibaca dari pertanyaannya sendiri
    aksi = !buka || perintah ? undefined : (aksi ?? lokal);
    if (aksi && 'tur' in aksi) aksi.indo = !!id;
    if (!jawaban) {
      if (!aksi) jawaban = PUTUS[id];
      else if ('tur' in aksi) jawaban = ['Hop on! I will take you around the village, house by house.', 'Ayo! Kuajak keliling desa, rumah demi rumah.'][id];
      else if ('atur' in aksi) jawaban = SETELAN[kunciAtur(aksi)][1 + id];
      else {
        const slug = aksi.proyek;
        const nama = proyek().find((x) => x.slug === slug)?.title ?? NAMA[aksi.tujuan][id];
        jawaban = [`On it! Opening ${nama} for you.`, `Siap! Aku bukakan ${nama} untukmu.`][id];
      }
    }
    tunggu.remove();
    const el = gelembung('bot', jawaban);
    const p = el.querySelector('p')!;
    const tombol = (teks: string, aksi: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'obrolan-aksi';
      b.textContent = teks;
      b.addEventListener('click', aksi);
      p.append(b);
    };
    if (perintah && jalankan) {
      // perintah yang akan diketik MATS-BOT, terlihat dulu sebelum dijalankan
      const kode = document.createElement('pre');
      kode.className = 'obrolan-kode';
      kode.textContent = perintah;
      p.append(kode);
      const cmd = perintah;
      tombol('▶ RUN IN TERMINAL', () => jalankan(cmd));
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
        'tur' in a ? 'START THE TOUR' : 'atur' in a ? SETELAN[kunciAtur(a)][0] : `OPEN ${NAMA[a.tujuan][0].replace(/^the /, '').toUpperCase()}`;
      tombol(`${tulisan} ›`, jalan);
      if (disuruh) tundaAksi = setTimeout(() => !akar.hidden && jalan(), Math.min(1100 + jawaban.length * 30, 4000));
    } else if (bukaTerminal && SOAL_TERMINAL.test(jawaban)) {
      tombol('OPEN TERMINAL ›', bukaTerminal);
    }
    if (!perintah) chipLanjut(q, jawaban, aksi, lanjut);
    isi.scrollTop = isi.scrollHeight;
    // perintahnya ikut diingat (dipotong), supaya "jalankan lagi" / "ubah jadi..." dimengerti
    riwayat.push({ peran: 'tamu', teks: q }, { peran: 'bot', teks: perintah ? `${jawaban}\n[terminal] ${perintah.slice(0, 300)}` : jawaban });
    kabar('bicara');
    sibuk = false;
    kirimBtn.disabled = false;
    // di HP papan ketik tidak dibuka lagi dengan sendirinya
    if (!matchMedia('(pointer: coarse)').matches) masuk.focus();
  }

  for (const s of SARAN) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'obrolan-chip';
    b.textContent = s;
    b.addEventListener('click', () => kirim(s));
    saran.append(b);
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    kirim(masuk.value);
  });
  gelembung('bot', SAPAAN);

  return {
    /** Fokus ke kolom tanya — hanya di perangkat berpapan ketik fisik. */
    fokus() {
      if (!matchMedia('(pointer: coarse)').matches) masuk.focus();
    },
  };
}
