/**
 * Jendela obrolan MATS-BOT. Pertanyaan dikirim ke layanan kecil di server
 * terminal (terminal-server/tanya/: Groq, cadangan Gemini) — alamatnya sama
 * dengan PUBLIC_TERMINAL_URL, jalur /tanya. Kunci API-nya hanya di server.
 *
 * Irit: riwayat yang ikut dikirim cuma beberapa pesan terakhir, pertanyaan
 * dibatasi 300 huruf, dan batas pemakaian diurus server. Kalau server tidak
 * bisa dihubungi, MATS-BOT tetap menjawab dengan kalimat cadangan — bukan
 * pesan galat.
 */
import { svgBot } from './rupa';

type Peran = 'tamu' | 'bot';
type Pesan = { peran: Peran; teks: string };
export type ModeObrolan = 'diam' | 'pikir' | 'bicara';

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';
const RIWAYAT = 4;
const WAKTU_TUNGGU = 45_000;

/** Tombol pertanyaan cepat. Satu dalam bahasa Indonesia: tanda bahwa dia menjawab dalam bahasa penanya. */
const SARAN = [
  'Who is Rahmat?',
  'Show me his best project',
  "What's his tech stack?",
  'Any games here?',
  'How can I contact him?',
  'Ceritakan tentang Rahmat',
];
const SAPAAN =
  "Beep boop! I'm MATS-BOT, Rahmat's little AI helper. Ask me about his projects, skills, or how to reach him. I'll answer in your language!";

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

/** Jawaban yang menyebut terminal atau game-nya mendapat tombol "OPEN TERMINAL". */
const SOAL_TERMINAL = /\bterminal\b|\bsnake\b/i;

export function pasangObrolan(
  akar: HTMLElement,
  kabar: (m: ModeObrolan) => void,
  /** Tutup obrolan dan nyalakan monitor terminal di meja Rahmat. */
  bukaTerminal?: () => void,
  /** Tutup obrolan, nyalakan terminal, dan biarkan MATS-BOT mengetikkan perintah ini. */
  jalankan?: (perintah: string) => void
) {
  const isi = akar.querySelector<HTMLElement>('#bot-isi')!;
  const saran = akar.querySelector<HTMLElement>('#bot-saran')!;
  const form = akar.querySelector<HTMLFormElement>('#bot-form')!;
  const masuk = akar.querySelector<HTMLInputElement>('#bot-input')!;
  const kirimBtn = form.querySelector<HTMLButtonElement>('button')!;
  const wajah = svgBot(7);
  const riwayat: Pesan[] = [];
  let sibuk = false;

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

    let jawaban = PUTUS[indo(q) ? 1 : 0];
    let perintah: string | undefined;
    if (ALAMAT) {
      try {
        const r = await fetch(new URL('tanya', ALAMAT), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pertanyaan: q, riwayat: riwayat.slice(-RIWAYAT) }),
          signal: AbortSignal.timeout(WAKTU_TUNGGU),
        });
        const d = (await r.json()) as { jawaban?: string; perintah?: string };
        if (r.ok && d.jawaban) {
          jawaban = d.jawaban;
          perintah = d.perintah;
        }
      } catch {
        /* jawaban cadangan di atas */
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
