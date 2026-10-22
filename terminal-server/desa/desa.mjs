// Desa Mapporto ramai: pengunjung lain yang sedang membuka portfolio terlihat
// sebagai warga samar di desa (WebSocket), dan buku tamu tempat pengunjung
// meninggalkan satu kalimat. Caddy: /desa* → 127.0.0.1:7683.
//
// - Kehadiran (GET /desa/ws, WebSocket): tiap browser mengirim posisinya
//   paling sering 8×/detik; server menggabungkan perubahan dan menyiarkannya
//   tiap 150 ms. Tidak ada nama, tidak ada IP yang dikirim ke pengunjung lain
//   — cuma nomor acak, warna baju, dan posisi. Tidak ada yang disimpan.
// - Buku tamu (GET/POST /desa/tamu): nama ≤ 24 huruf + pesan ≤ 140 huruf.
//   Langsung tampil, tapi disaring dulu: tautan dan kata kasar ditolak, batas
//   per pengunjung dan per hari. Tiap pesan baru dikabarkan ke Telegram
//   Rahmat beserta tautan hapus bertanda tangan; /admin juga bisa menghapus
//   (POST /desa/tamu/hapus dengan kunci admin, lewat API Vercel).
// - Disimpan di StateDirectory sebagai JSONL (tambah-saja; penghapusan
//   dicatat sebagai baris sendiri), dibaca ulang saat mulai.
//
// Tanpa paket npm: Node 22. Lihat mapporto-desa.service.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 7683;
const ASAL = new Set([
  'https://rahmateka.my.id',
  'https://www.rahmateka.my.id',
  ...(process.env.ASAL_TAMBAHAN || '').split(',').map((s) => s.trim()).filter(Boolean),
]);
/** Pratinjau Vercel projek ini (itsme-…vercel.app) boleh ikut, untuk menguji sebelum rilis. */
const ASAL_PRATINJAU = /^https:\/\/itsme-[a-z0-9-]+\.vercel\.app$/;
const bolehAsal = (o) => !!o && (ASAL.has(o) || ASAL_PRATINJAU.test(o));

/** Alamat publik layanan ini, untuk tautan hapus di Telegram. */
const PUBLIK = (process.env.PUBLIK || 'https://terminal.rahmateka.my.id').replace(/\/$/, '');
const RAHASIA = process.env.DESA_RAHASIA || '';
const KUNCI_ADMIN = process.env.DESA_ADMIN_KEY || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const TG_API = process.env.TELEGRAM_API || 'https://api.telegram.org';
const FOLDER = process.env.STATE_DIRECTORY || process.env.FOLDER_DATA || '';
const BERKAS = FOLDER ? path.join(FOLDER, 'tamu.jsonl') : '';

/** Ukuran peta desa, px dunia — posisi di luar ini ditolak. */
const PETA = { w: 624, h: 528 };
const MAKS_WARGA = 60;
const MAKS_PER_IP = 4;
const SIAR_MS = 150;

const ipDari = (req) =>
  String(req.headers['cf-connecting-ip'] ?? '').trim() ||
  String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',').pop().trim();

/* ================= kehadiran (WebSocket) ================= */

/**
 * WebSocket seperlunya (RFC 6455): jabat tangan, bingkai teks bertopeng dari
 * browser, ping/pong, tutup. Pesan terpotong-potong (fragmen) dan pesan
 * biner tidak dipakai situs ini, jadi koneksinya langsung diputus.
 */
function bingkai(teks, kode = 1) {
  const isi = Buffer.from(teks);
  const n = isi.length;
  const kepala = n < 126 ? Buffer.from([0x80 | kode, n]) : Buffer.from([0x80 | kode, 126, n >> 8, n & 255]);
  return Buffer.concat([kepala, isi]);
}

/** @type {Map<number, Warga>} */
const warga = new Map();
/**
 * @typedef {{ id: number, ip: string, sock: import('node:net').Socket, sisa: Buffer, rupa: number, x: number, y: number,
 *   a: number, j: number, berubah: boolean, siap: boolean, jatah: number, terakhir: number }} Warga
 */
let nomor = 1;

function kirimKe(w, obj) {
  if (!w.sock.destroyed) w.sock.write(bingkai(JSON.stringify(obj)));
}
function siarkan(obj, kecuali) {
  const b = bingkai(JSON.stringify(obj));
  for (const w of warga.values()) if (w.siap && w !== kecuali && !w.sock.destroyed) w.sock.write(b);
}
const ringkas = (w) => ({ id: w.id, x: w.x, y: w.y, a: w.a, j: w.j, r: w.rupa });

function pergi(w) {
  if (!warga.has(w.id)) return;
  warga.delete(w.id);
  if (!w.sock.destroyed) w.sock.destroy();
  if (w.siap) siarkan({ t: 'keluar', id: w.id });
  siarkan({ t: 'jumlah', n: jumlahSiap() });
}
const jumlahSiap = () => [...warga.values()].filter((w) => w.siap).length;

function terima(w, teks) {
  let m;
  try {
    m = JSON.parse(teks);
  } catch {
    return pergi(w);
  }
  if (!m || typeof m !== 'object') return;
  w.terakhir = Date.now();
  if (m.t === 'halo' && !w.siap) {
    w.rupa = Number.isInteger(m.r) && m.r >= 0 && m.r < 16 ? m.r : w.id % 8;
    w.siap = true;
    kirimKe(w, { t: 'kamu', id: w.id, warga: [...warga.values()].filter((o) => o.siap && o !== w).map(ringkas) });
    siarkan({ t: 'masuk', ...ringkas(w) }, w);
    siarkan({ t: 'jumlah', n: jumlahSiap() });
    return;
  }
  if (!w.siap) return;
  if (m.t === 'pos') {
    const x = Number(m.x);
    const y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > PETA.w || y > PETA.h) return;
    w.x = Math.round(x * 10) / 10;
    w.y = Math.round(y * 10) / 10;
    w.a = [0, 1, 2, 3].includes(m.a) ? m.a : 0;
    w.j = m.j ? 1 : 0;
    w.berubah = true;
  } else if (m.t === 'lambai') {
    const ke = Number(m.ke);
    const tuju = warga.get(ke);
    // melambai cuma ke yang memang dekat — tidak bisa dipakai menyapa dari seberang desa
    if (tuju && Math.hypot(tuju.x - w.x, tuju.y - w.y) < 120) siarkan({ t: 'lambai', dari: w.id, ke });
  }
}

/** Potong bingkai-bingkai utuh dari aliran byte. */
function urai(w) {
  for (;;) {
    const b = w.sisa;
    if (b.length < 2) return;
    const fin = b[0] & 0x80;
    const kode = b[0] & 0x0f;
    const bertopeng = b[1] & 0x80;
    let n = b[1] & 0x7f;
    let i = 2;
    if (n === 126) {
      if (b.length < 4) return;
      n = b.readUInt16BE(2);
      i = 4;
    } else if (n === 127) return pergi(w);
    if (!fin || !bertopeng || n > 1024) return pergi(w);
    if (b.length < i + 4 + n) return;
    const topeng = b.subarray(i, i + 4);
    const isi = Buffer.from(b.subarray(i + 4, i + 4 + n));
    for (let k = 0; k < n; k++) isi[k] ^= topeng[k & 3];
    w.sisa = b.subarray(i + 4 + n);
    // jatah pesan: 20 per detik, lebih dari itu diputus
    if (--w.jatah < 0) return pergi(w);
    if (kode === 1) terima(w, isi.toString('utf8'));
    else if (kode === 8) return pergi(w);
    else if (kode === 9) w.sock.write(Buffer.concat([Buffer.from([0x8a, isi.length]), isi]));
    else if (kode === 10) w.terakhir = Date.now();
    else return pergi(w);
    if (w.sock.destroyed) return;
  }
}

function upgrade(req, sock) {
  const tolak = (kode) => {
    sock.end(`HTTP/1.1 ${kode}\r\nConnection: close\r\n\r\n`);
  };
  if ((req.url ?? '').split('?')[0] !== '/desa/ws') return tolak('404 Not Found');
  if (!bolehAsal(req.headers.origin)) return tolak('403 Forbidden');
  const kunci = req.headers['sec-websocket-key'];
  if (!kunci || req.headers.upgrade?.toLowerCase() !== 'websocket') return tolak('400 Bad Request');
  const ip = ipDari(req);
  if (warga.size >= MAKS_WARGA) return tolak('503 Service Unavailable');
  if ([...warga.values()].filter((w) => w.ip === ip).length >= MAKS_PER_IP) return tolak('429 Too Many Requests');
  const terima_ = crypto.createHash('sha1').update(kunci + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${terima_}\r\n\r\n`);
  sock.setNoDelay(true);
  /** @type {Warga} */
  const w = { id: nomor++, ip, sock, sisa: Buffer.alloc(0), rupa: 0, x: 0, y: 0, a: 0, j: 0, berubah: false, siap: false, jatah: 20, terakhir: Date.now() };
  warga.set(w.id, w);
  sock.on('data', (d) => {
    w.sisa = w.sisa.length ? Buffer.concat([w.sisa, d]) : d;
    if (w.sisa.length > 8192) return pergi(w);
    urai(w);
  });
  sock.on('close', () => pergi(w));
  sock.on('error', () => pergi(w));
}

// siaran posisi yang berubah, jatah pesan diisi ulang, yang diam 70 dtk diputus
setInterval(() => {
  const d = [];
  for (const w of warga.values()) {
    if (w.siap && w.berubah) {
      d.push([w.id, w.x, w.y, w.a, w.j]);
      w.berubah = false;
    }
  }
  if (d.length) siarkan({ t: 'p', d });
}, SIAR_MS).unref();
setInterval(() => {
  const kini = Date.now();
  for (const w of warga.values()) {
    w.jatah = 20;
    if (kini - w.terakhir > 70_000) pergi(w);
  }
}, 1000).unref();
setInterval(() => {
  const ping = Buffer.from([0x89, 0]);
  for (const w of warga.values()) if (!w.sock.destroyed) w.sock.write(ping);
}, 25_000).unref();

/* ================= buku tamu ================= */

const PANJANG_NAMA = 24;
const PANJANG_PESAN = 140;
const TAMPIL = 40;
/** @type {{ id: string, nama: string, isi: string, t: number, lencana?: boolean }[]} */
let pesan = [];

function muat() {
  if (!BERKAS || !fs.existsSync(BERKAS)) return;
  const hapus = new Set();
  const semua = [];
  for (const baris of fs.readFileSync(BERKAS, 'utf8').split('\n')) {
    if (!baris.trim()) continue;
    try {
      const x = JSON.parse(baris);
      if (x.hapus) hapus.add(x.hapus);
      else if (x.id) semua.push(x);
    } catch {
      /* baris rusak dilewati */
    }
  }
  pesan = semua.filter((x) => !hapus.has(x.id)).slice(-500);
  console.log(`buku tamu: ${pesan.length} pesan dimuat`);
}
function tulis(obj) {
  if (!BERKAS) return;
  try {
    fs.appendFileSync(BERKAS, JSON.stringify(obj) + '\n');
  } catch (e) {
    console.error(`buku tamu gagal disimpan: ${e.message}`);
  }
}

const rapikan = (s, maks) =>
  String(s ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maks);

const TAUTAN = /(https?:|www\.|\b[\w-]+\.(?:com|net|org|id|io|xyz|ru|cn|top|me|co|info|biz|link|site|online|app|dev|ly|gg)\b|t\.me\/|wa\.me\/|@\w{3,}\.\w)/i;

/**
 * Kata kasar Indonesia dan Inggris, plus kata kunci spam judi. Dicocokkan
 * pada teks yang sudah dinormalkan (huruf kecil, angka-mirip-huruf diganti,
 * huruf berulang dipadatkan), jadi "4nj1ng" dan "anjiiing" ikut tertangkap.
 * `DI_MANA_SAJA` ditolak walau menempel di kata lain ("fucking");
 * `SATU_KATA` hanya kalau berdiri sendiri, supaya "asu" tidak menolak
 * "asuransi" dan "tai" tidak menolak "pantai".
 */
const DI_MANA_SAJA = [
  'anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'jembut', 'pepek', 'goblok', 'goblog', 'kampret', 'bajingan', 'keparat',
  'pelacur', 'lonte', 'jancok', 'jancuk', 'pukimak', 'bokep', 'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'nigger',
  'nigga', 'faggot', 'whore', 'gacor', 'maxwin', 'togel', 'casino',
];
const SATU_KATA = [
  'anjir', 'anjg', 'ajg', 'bngst', 'babi', 'kntl', 'mmk', 'entot', 'tolol', 'bego', 'idiot', 'asu', 'tai', 'taik', 'perek', 'cok',
  'pantek', 'puki', 'monyet', 'dick', 'cock', 'pussy', 'slut', 'retard', 'rape', 'porn', 'sex', 'nazi', 'judi', 'slot',
];
const padat = (s) => s.replace(/(.)\1+/g, '$1');
const normal = (s) =>
  padat(
    s
      .toLowerCase()
      .replace(/[0]/g, 'o')
      .replace(/[1!|]/g, 'i')
      .replace(/[3]/g, 'e')
      .replace(/[4@]/g, 'a')
      .replace(/[5$]/g, 's')
      .replace(/[7]/g, 't')
  );
function kasar(teks) {
  const n = normal(teks);
  const kata = n.split(/[^a-z]+/).filter(Boolean);
  const rapat = n.replace(/[^a-z]/g, '');
  return DI_MANA_SAJA.some((k) => rapat.includes(padat(k))) || SATU_KATA.some((k) => kata.includes(padat(k)));
}

const kirimanTamu = new Map(); // ip -> daftar waktu (ms)
let hariTamu = { hari: '', n: 0 };
const BATAS = { jedaMs: 120_000, perHari: 5, total: 300 };

function bolehTulis(ip) {
  const kini = Date.now();
  const hari = new Date().toISOString().slice(0, 10);
  if (hariTamu.hari !== hari) hariTamu = { hari, n: 0 };
  const d = (kirimanTamu.get(ip) ?? []).filter((t) => kini - t < 86_400_000);
  kirimanTamu.set(ip, d);
  if (hariTamu.n >= BATAS.total) return 'The guestbook is full for today. Please come back tomorrow!';
  if (d.length >= BATAS.perHari) return 'You have signed the guestbook a few times today already. Thank you!';
  if (d.length && kini - d[d.length - 1] < BATAS.jedaMs) return 'Please wait a couple of minutes before writing again.';
  return '';
}
setInterval(() => {
  const kini = Date.now();
  for (const [ip, d] of kirimanTamu) if (!d.some((t) => kini - t < 86_400_000)) kirimanTamu.delete(ip);
}, 3_600_000).unref();

const tandaHapus = (id) => crypto.createHmac('sha256', RAHASIA).update(`hapus:${id}`).digest('base64url').slice(0, 22);

async function keTelegram(teks) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    const r = await fetch(`${TG_API}/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: teks.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error(`telegram ${r.status}`);
  } catch (e) {
    console.error(`telegram gagal: ${e.message}`);
  }
}

function tambah(data, ip) {
  // jebakan bot: kolom tersembunyi yang tidak pernah diisi orang
  if (data.situs) return [200, { ok: true }];
  const nama = rapikan(data.nama, PANJANG_NAMA);
  const isi = rapikan(data.isi, PANJANG_PESAN);
  if (nama.length < 1) return [400, { galat: 'Please write your name.' }];
  if (isi.length < 2) return [400, { galat: 'Please write a short message.' }];
  if (TAUTAN.test(nama) || TAUTAN.test(isi)) return [400, { galat: 'Links are not allowed in the guestbook.' }];
  if (kasar(nama) || kasar(isi)) return [400, { galat: 'Please keep it friendly.' }];
  const kembar = pesan.slice(-30).some((p) => p.isi.toLowerCase() === isi.toLowerCase());
  if (kembar) return [400, { galat: 'Someone already wrote exactly that.' }];
  const tolak = bolehTulis(ip);
  if (tolak) return [429, { galat: tolak }];
  kirimanTamu.get(ip).push(Date.now());
  hariTamu.n++;
  const p = { id: crypto.randomBytes(6).toString('base64url'), nama, isi, t: Date.now(), ...(data.lencana === true ? { lencana: true } : {}) };
  pesan.push(p);
  if (pesan.length > 500) pesan.shift();
  tulis(p);
  siarkan({ t: 'tamu', p });
  const hapus = RAHASIA ? `\n\nHapus: ${PUBLIK}/desa/tamu/hapus?id=${p.id}&k=${tandaHapus(p.id)}` : '';
  void keTelegram(`📖 Buku tamu Desa Mapporto\n${nama}: ${isi}${hapus}`);
  console.log(`buku tamu: pesan baru (${hariTamu.n} hari ini)`);
  return [200, { ok: true, pesan: p }];
}

function hapusPesan(id) {
  const ada = pesan.some((p) => p.id === id);
  if (!ada) return false;
  pesan = pesan.filter((p) => p.id !== id);
  tulis({ hapus: id, t: Date.now() });
  siarkan({ t: 'tamu-hapus', id });
  return true;
}

/* ================= server ================= */

function kirim(res, kode, isi, asal) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
  if (asal) {
    h['access-control-allow-origin'] = asal;
    h['access-control-allow-methods'] = 'POST, GET, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['access-control-max-age'] = '86400';
  }
  res.writeHead(kode, h);
  res.end(isi === null ? '' : JSON.stringify(isi));
}

const sama = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const server = http.createServer(async (req, res) => {
  const asal = bolehAsal(req.headers.origin) ? req.headers.origin : null;
  const url = new URL(req.url ?? '/', 'http://desa');
  const jalur = url.pathname;
  if (req.method === 'OPTIONS') return kirim(res, 204, null, asal);

  if (req.method === 'GET' && jalur === '/desa/status') return kirim(res, 200, { warga: jumlahSiap(), tamu: pesan.length }, asal);
  if (req.method === 'GET' && jalur === '/desa/tamu') return kirim(res, 200, { pesan: pesan.slice(-TAMPIL).reverse() }, asal);

  // tautan hapus dari Telegram: bertanda tangan, jadi tidak perlu masuk
  if (req.method === 'GET' && jalur === '/desa/tamu/hapus') {
    const id = url.searchParams.get('id') ?? '';
    const k = url.searchParams.get('k') ?? '';
    const ok = RAHASIA && id && sama(k, tandaHapus(id)) && hapusPesan(id);
    res.writeHead(ok ? 200 : 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:24px">${ok ? 'Pesan buku tamu dihapus.' : 'Pesan tidak ditemukan (mungkin sudah dihapus).'}</body>`);
  }

  if (req.method !== 'POST' || (jalur !== '/desa/tamu' && jalur !== '/desa/tamu/hapus')) return kirim(res, 404, { galat: 'tidak ada' }, asal);

  let badan = '';
  for await (const potong of req) {
    badan += potong;
    if (badan.length > 2048) return kirim(res, 413, { galat: 'terlalu panjang' }, asal);
  }
  let data;
  try {
    data = JSON.parse(badan) ?? {};
  } catch {
    return kirim(res, 400, { galat: 'bukan JSON' }, asal);
  }

  // hapus dari /admin (server Vercel → sini), dengan kunci admin
  if (jalur === '/desa/tamu/hapus') {
    const auth = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!KUNCI_ADMIN || !sama(auth, KUNCI_ADMIN)) return kirim(res, 401, { galat: 'tidak berhak' }, null);
    return kirim(res, hapusPesan(String(data.id ?? '')) ? 200 : 404, { ok: true }, null);
  }

  if (!asal) return kirim(res, 403, { galat: 'asal tidak diizinkan' }, null);
  const [kode, isi] = tambah(data, ipDari(req));
  kirim(res, kode, isi, asal);
});
server.on('upgrade', upgrade);

muat();
server.listen(PORT, '127.0.0.1', () => console.log(`desa siap di 127.0.0.1:${PORT}; telegram ${TG_TOKEN && TG_CHAT ? 'nyala' : 'mati'}`));
