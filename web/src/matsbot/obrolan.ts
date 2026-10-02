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
 * MATS-BOT juga BERTINDAK: disuruh membuka CV, Projects, satu projek
 * tertentu, peta atau terminal, dia menutup obrolan dan membukanya sendiri
 * (lihat Aksi). Aksinya datang dari server (tanda [[open:…]] di jawaban AI);
 * kalau server tidak mengirimnya — AI-nya lupa, atau server mati — niatnya
 * dibaca di sini dari pertanyaannya (niatBuka), jadi "buka cv" selalu jalan.
 * Dulu dia cuma bisa menjawab "klik menu CV".
 */
import { svgBot } from './rupa';

type Peran = 'tamu' | 'bot';
type Pesan = { peran: Peran; teks: string };
export type ModeObrolan = 'diam' | 'pikir' | 'bicara';

/** Tempat yang bisa dibuka MATS-BOT: ruas alamat rumahnya (src/rute.ts), peta, atau terminal. */
const TUJUAN = ['about', 'cv', 'projects', 'tech-stack', 'contact', 'map', 'terminal'] as const;
export type Tujuan = (typeof TUJUAN)[number];
/** `proyek`: slug projek yang disorot di panel Projects. */
export type Aksi = { tujuan: Tujuan; proyek?: string };
type Proyek = { slug: string; title: string };

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';
const RIWAYAT = 4;
const WAKTU_TUNGGU = 45_000;

/** Tombol pertanyaan cepat. Satu dalam bahasa Indonesia: tanda bahwa dia menjawab dalam bahasa penanya. */
const SARAN = [
  'Who is Rahmat?',
  'Show me his best project',
  'Open his CV',
  "What's his tech stack?",
  'Any games here?',
  'How can I contact him?',
  'Ceritakan tentang Rahmat',
];
const SAPAAN =
  "Beep boop! I'm MATS-BOT, Rahmat's little AI helper. Ask me about his projects, skills, or how to reach him, or tell me to open something (\"open the CV\", \"buka project\") and I'll take you there. I answer in your language!";

const indo = (s: string) => /\b(apa|siapa|kamu|bisa|gimana|bagaimana|yang|dan|itu|ini|nya|dong|kak|mas|halo|hai|ceritakan)\b/i.test(s);
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

/* ---------------- niat "buka …" dibaca dari pertanyaannya ---------------- */

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

/** Pertanyaan yang menyuruh membuka sesuatu → aksinya; selain itu undefined. */
export function niatBuka(q: string, proyek: Proyek[] = []): Aksi | undefined {
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

/** Jawaban yang menyebut terminal atau game-nya mendapat tombol "OPEN TERMINAL". */
const SOAL_TERMINAL = /\bterminal\b|\bsnake\b/i;

export function pasangObrolan(
  akar: HTMLElement,
  kabar: (m: ModeObrolan) => void,
  /** Tutup obrolan dan nyalakan monitor terminal di meja Rahmat. */
  bukaTerminal?: () => void,
  /** Tutup obrolan, nyalakan terminal, dan biarkan MATS-BOT mengetikkan perintah ini. */
  jalankan?: (perintah: string) => void,
  /** Tutup obrolan dan buka tempat itu: rumah (lewat petir), peta, atau terminal. */
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

  async function kirim(teks: string) {
    const q = teks.trim().slice(0, 300);
    if (!q || sibuk) return;
    clearTimeout(tundaAksi);
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
    if (ALAMAT) {
      try {
        const r = await fetch(new URL('tanya', ALAMAT), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pertanyaan: q, riwayat: riwayat.slice(-RIWAYAT) }),
          signal: AbortSignal.timeout(WAKTU_TUNGGU),
        });
        const d = (await r.json()) as { jawaban?: string; perintah?: string; aksi?: Aksi; sumber?: string };
        if (r.ok && d.jawaban) {
          jawaban = d.jawaban;
          perintah = d.perintah;
          if (d.aksi && TUJUAN.includes(d.aksi.tujuan)) aksi = d.aksi;
          // jawaban "sedang istirahat / kena batas" tidak menghalangi aksinya
          if (d.sumber === 'batas' || d.sumber === 'cadangan') jawaban = '';
        } else {
          jawaban = '';
        }
      } catch {
        jawaban = '';
      }
    }
    // server tidak memberi aksi: baca niatnya dari pertanyaannya sendiri
    if (buka && !perintah) aksi ??= niatBuka(q, proyek());
    if (!buka || perintah) aksi = undefined;
    if (!jawaban) {
      const id = indo(q) ? 1 : 0;
      const nama = proyek().find((x) => x.slug === aksi?.proyek)?.title ?? (aksi && NAMA[aksi.tujuan][id]);
      jawaban = aksi ? [`On it! Opening ${nama} for you.`, `Siap! Aku bukakan ${nama} untukmu.`][id] : PUTUS[id];
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
       * yang tidak mau menunggu, dan untuk membukanya lagi nanti dari riwayat.
       */
      const a = aksi;
      const jalan = () => {
        clearTimeout(tundaAksi);
        buka(a);
      };
      tombol(`OPEN ${NAMA[a.tujuan][0].replace(/^the /, '').toUpperCase()} ›`, jalan);
      tundaAksi = setTimeout(() => !akar.hidden && jalan(), Math.min(1100 + jawaban.length * 30, 4000));
    } else if (bukaTerminal && SOAL_TERMINAL.test(jawaban)) {
      tombol('OPEN TERMINAL ›', bukaTerminal);
    }
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
