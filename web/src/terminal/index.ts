/**
 * Terminal di komputer Rahmat (meja kerja di halaman rumah About).
 *
 * Dua mode:
 *
 * - LIVE: shell Linux sungguhan. Tiap pengunjung dapat kontainer Docker
 *   sekali pakai di server (tanpa internet, memori & CPU dibatasi, hilang
 *   begitu ditutup) — lihat terminal-server/ di akar repo. Halamannya
 *   dilayani ttyd dan ditampilkan di sini lewat iframe.
 * - DEMO: kalau alamat servernya belum diisi atau servernya sedang mati,
 *   pengunjung tetap dapat terminal — shell kecil di browser yang isinya
 *   portfolio ini sendiri (lihat demo.ts), dengan label jujur bahwa itu demo.
 *
 * Alamat server diisi lewat variabel lingkungan PUBLIC_TERMINAL_URL saat
 * build (di Vercel: Settings → Environment Variables), misalnya
 * `https://terminal.rahmateka.my.id/`. Kosong = selalu demo.
 */
import { mulaiDemo } from './demo';

export type Mode = 'hubung' | 'live' | 'penuh' | 'demo';

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';

/**
 * Font terminal live, dikirim lewat URL. Di server daftarnya tertulis sebagai
 * `-t fontFamily="JetBrains Mono","Cascadia Mono",…` — ttyd membacanya
 * sebagai JSON, jadi yang tersisa cuma "JetBrains Mono" TANPA cadangan
 * `monospace`. Di HP font itu tidak ada: browser jatuh ke font biasa
 * (Roboto), lebar tiap kotak diukur dari huruf terlebar, dan terminalnya jadi
 * ±28 kolom dengan huruf renggang tak sejajar. `monospace` di akhir menjamin
 * font berlebar-sama di perangkat apa pun (Android: Droid Sans Mono).
 * "Mapporto Mono" di depan adalah JetBrainsMono Nerd Font Mono yang dimuat
 * halaman ttyd sendiri (terminal-server/gaya-ttyd.html), supaya ikon NvChad
 * dan kawan-kawan tampil di semua perangkat.
 */
const HURUF_TERMINAL =
  '"Mapporto Mono", "JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, Consolas, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "DejaVu Sans Mono", "Liberation Mono", monospace';

/** Seberapa sering status dicek ulang selama pengunjung menunggu slot. */
const JEDA_ANTRE = 5000;

type Status = { aktif: number; maks: number; t: number };

/** fetch dengan batas waktu; ikut batal kalau monitor dimatikan. */
async function ambil(url: URL, init: RequestInit, batal?: AbortSignal, ms = 4000) {
  const henti = new AbortController();
  const waktu = setTimeout(() => henti.abort(), ms);
  const ikut = () => henti.abort();
  batal?.addEventListener('abort', ikut);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: henti.signal });
  } finally {
    clearTimeout(waktu);
    batal?.removeEventListener('abort', ikut);
  }
}

/**
 * Apakah server terminal hidup, dan berapa slot yang terpakai.
 *
 * `status.json` ditulis server tiap 2 detik (terminal-server/hitung-sesi.sh).
 * Kalau berkas itu tidak ada atau basi (server versi lama, penghitungnya
 * mati), cukup dicek apakah ttyd menjawab — permintaannya `no-cors`, karena
 * ttyd tidak mengirim header CORS: isinya tidak terbaca, tapi berhasil atau
 * tidaknya sudah cukup untuk tahu servernya hidup.
 */
async function cekServer(alamat: string, batal?: AbortSignal): Promise<'mati' | 'lambat' | 'hidup' | Status> {
  // habis waktu (bukan ditolak) = jaringan pengunjung yang lambat, bukan
  // servernya yang mati: pesannya harus membedakan keduanya
  const habisWaktu = (e: unknown) => (e as Error)?.name === 'AbortError' && !batal?.aborted;
  try {
    // lebih longgar: saat monitor dinyalakan, aset desa masih ikut berebut jaringan
    const r = await ambil(new URL('status.json', alamat), {}, batal, 8000);
    if (r.ok) {
      const s = (await r.json()) as Status;
      if (Number.isFinite(s.aktif) && s.maks > 0 && Math.abs(Date.now() / 1000 - s.t) < 30) return s;
    }
  } catch (e) {
    if (batal?.aborted) return 'mati';
    if (habisWaktu(e)) return 'lambat';
  }
  try {
    await ambil(new URL('token', alamat), { mode: 'no-cors' }, batal, 8000);
    return 'hidup';
  } catch (e) {
    return habisWaktu(e) ? 'lambat' : 'mati';
  }
}

/** Tunggu `ms`, atau berhenti lebih cepat kalau monitor dimatikan. */
const tidur = (ms: number, batal?: AbortSignal) =>
  new Promise<void>((beres) => {
    const t = setTimeout(beres, ms);
    batal?.addEventListener('abort', () => (clearTimeout(t), beres()), { once: true });
  });

/**
 * Layar "terminal penuh": pengunjung ke-(maks+1) diberi tahu, lalu otomatis
 * disambungkan begitu ada yang keluar. Selama menunggu boleh pindah ke
 * terminal browser. Hasilnya: 'masuk' (ada slot), 'demo' (pilih terminal
 * browser), atau 'batal' (monitor dimatikan / server hilang).
 */
async function tungguSlot(
  wadah: HTMLElement,
  awal: Status,
  alamat: string,
  batal?: AbortSignal
): Promise<'masuk' | 'demo' | 'batal'> {
  const layar = document.createElement('div');
  layar.className = 'term-penuh';
  layar.setAttribute('role', 'status');
  layar.innerHTML = `
    <p class="term-penuh-judul">TERMINAL FULL</p>
    <p class="term-penuh-slot" aria-hidden="true"></p>
    <p class="term-penuh-teks"></p>
    <p class="term-penuh-antre"><span class="term-penuh-titik" aria-hidden="true"></span> Waiting for a free seat — you'll be connected automatically.</p>
    <button type="button" class="term-penuh-demo">Use the browser terminal instead</button>`;
  const slot = layar.querySelector<HTMLElement>('.term-penuh-slot')!;
  const teks = layar.querySelector<HTMLElement>('.term-penuh-teks')!;
  const tampil = (s: Status) => {
    slot.replaceChildren(
      ...Array.from({ length: s.maks }, (_, i) => {
        const k = document.createElement('span');
        if (i < s.aktif) k.className = 'isi';
        return k;
      })
    );
    teks.textContent = `${Math.min(s.aktif, s.maks)} of ${s.maks} visitors are using the live terminal right now. It only fits ${s.maks} at a time, so each of them gets their own Linux box.`;
  };
  tampil(awal);
  wadah.replaceChildren(layar);

  // berhenti menunggu: tombol terminal browser diklik, atau monitor dimatikan
  // (tanpa AbortSignal.any, yang belum ada di Safari lama)
  let pilihDemo = false;
  const henti = new AbortController();
  const berhenti = henti.signal;
  batal?.addEventListener('abort', () => henti.abort(), { once: true });
  layar.querySelector('button')!.addEventListener('click', () => {
    pilihDemo = true;
    henti.abort();
  });

  while (!berhenti.aborted) {
    await tidur(JEDA_ANTRE, berhenti);
    if (berhenti.aborted) break;
    const s = await cekServer(alamat, berhenti);
    if (s === 'mati' || s === 'lambat') break;
    if (s === 'hidup' || s.aktif < s.maks) return 'masuk';
    tampil(s);
  }
  return pilihDemo ? 'demo' : 'batal';
}

/**
 * Buka terminal di `wadah`. `kabar` dipanggil tiap kali modenya jelas.
 * Mengembalikan fungsi penutup: iframe dilepas (koneksinya putus, kontainer
 * di server langsung dihapus) atau shell demonya dibereskan. `batal`
 * dihentikan saat monitor dimatikan, supaya pengecekan dan antrean berhenti.
 */
export async function bukaTerminal(
  wadah: HTMLElement,
  kabar: (m: Mode, catatan?: string) => void,
  /** Isi portfolio yang sudah dimuat game (content.json), supaya tidak diunduh ulang. */
  konten?: Parameters<typeof mulaiDemo>[1],
  batal?: AbortSignal
) {
  wadah.replaceChildren();
  const kosongkan = () => wadah.replaceChildren();
  if (ALAMAT) {
    kabar('hubung');
    const muat = document.createElement('p');
    muat.className = 'term-muat';
    muat.textContent = 'Connecting to the server…';
    wadah.append(muat);
    let s = await cekServer(ALAMAT, batal);
    if (batal?.aborted) return kosongkan;
    if (typeof s === 'object' && s.aktif >= s.maks) {
      kabar('penuh');
      const hasil = await tungguSlot(wadah, s, ALAMAT, batal);
      if (batal?.aborted) return kosongkan;
      s = hasil === 'masuk' ? 'hidup' : 'mati';
      if (hasil === 'demo') {
        kabar('demo', 'You chose the browser terminal while the live one is full.');
        return mulaiDemo(wadah, konten);
      }
    }
    if (s === 'hidup' || typeof s === 'object') {
      const bingkai = document.createElement('iframe');
      // ttyd menerima pengaturan terminal lewat query URL (menimpa pengaturan
      // server). Di layar sempit huruf 16 px cuma muat ±34 kolom, jadi
      // hurufnya dikecilkan di HP.
      const lebar = wadah.clientWidth;
      const huruf = lebar < 420 ? 13 : lebar < 640 ? 14 : 0;
      const q = new URLSearchParams({ fontFamily: HURUF_TERMINAL });
      if (huruf) q.set('fontSize', String(huruf));
      bingkai.src = `${ALAMAT}?${q}`;
      bingkai.title = 'Live terminal';
      bingkai.className = 'term-live';
      bingkai.allow = 'clipboard-read; clipboard-write';
      bingkai.referrerPolicy = 'no-referrer';
      wadah.replaceChildren(bingkai);
      bingkai.addEventListener('load', () => bingkai.focus());
      kabar('live');
      return kosongkan;
    }
    wadah.replaceChildren();
    kabar(
      'demo',
      s === 'lambat'
        ? 'Your connection to the live server is too slow right now, so this is the browser terminal. Turn the monitor off and on to try the live one again.'
        : 'The live server is offline right now, so this is the demo shell.'
    );
  } else {
    kabar('demo');
  }
  return mulaiDemo(wadah, konten);
}
