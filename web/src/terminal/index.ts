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

export type Mode = 'hubung' | 'live' | 'demo';

const ALAMAT = (import.meta.env.PUBLIC_TERMINAL_URL as string | undefined)?.trim() || '';

/**
 * Apakah server terminal bisa dijangkau. Permintaannya `no-cors`: ttyd tidak
 * mengirim header CORS, jadi isinya tidak bisa dibaca — tapi berhasil atau
 * tidaknya permintaan itu sudah cukup untuk tahu servernya hidup.
 */
async function hidup(alamat: string) {
  const batal = new AbortController();
  const waktu = setTimeout(() => batal.abort(), 4000);
  try {
    await fetch(new URL('token', alamat), { mode: 'no-cors', cache: 'no-store', signal: batal.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(waktu);
  }
}

/**
 * Buka terminal di `wadah`. `kabar` dipanggil tiap kali modenya jelas.
 * Mengembalikan fungsi penutup: iframe dilepas (koneksinya putus, kontainer
 * di server langsung dihapus) atau shell demonya dibereskan.
 */
export async function bukaTerminal(wadah: HTMLElement, kabar: (m: Mode, catatan?: string) => void) {
  wadah.replaceChildren();
  let tutup = () => wadah.replaceChildren();
  if (ALAMAT) {
    kabar('hubung');
    const muat = document.createElement('p');
    muat.className = 'term-muat';
    muat.textContent = 'Connecting to the server…';
    wadah.append(muat);
    if (await hidup(ALAMAT)) {
      if (!wadah.isConnected) return tutup;
      const bingkai = document.createElement('iframe');
      bingkai.src = ALAMAT;
      bingkai.title = 'Live terminal';
      bingkai.className = 'term-live';
      bingkai.allow = 'clipboard-read; clipboard-write';
      bingkai.referrerPolicy = 'no-referrer';
      wadah.replaceChildren(bingkai);
      bingkai.addEventListener('load', () => bingkai.focus());
      kabar('live');
      return tutup;
    }
    wadah.replaceChildren();
    kabar('demo', 'The live server is offline right now, so this is the demo shell.');
  } else {
    kabar('demo');
  }
  tutup = mulaiDemo(wadah);
  return tutup;
}
