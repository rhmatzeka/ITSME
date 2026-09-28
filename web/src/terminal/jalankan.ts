/**
 * Menjalankan kode pengunjung — Python (Pyodide, WebAssembly) dan
 * JavaScript — di Web Worker, di browser pengunjung sendiri.
 *
 * Kenapa aman: kodenya tidak pernah sampai ke server mana pun. Worker tidak
 * bisa menyentuh halaman (DOM), kukis, atau penyimpanan situs; ia cuma bisa
 * mengirim teks balik. Tiap program dimatikan paksa setelah BATAS_WAKTU
 * atau kalau keluarannya melewati BATAS_KELUARAN — `while True: pass` atau
 * `print` tanpa henti tidak bisa membekukan halamannya.
 */

export const BATAS_WAKTU = 10_000;
const BATAS_KELUARAN = 200_000;
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

const KODE_PY = `
importScripts('${PYODIDE}pyodide.js');
let py;
onmessage = async (e) => {
  const { kode, berkas, cwd } = e.data;
  try {
    if (!py) {
      postMessage({ info: 'Loading Python (first run only, ~10 MB)…' });
      py = await loadPyodide({ indexURL: '${PYODIDE}' });
      postMessage({ info: '' });
    }
    py.setStdout({ batched: (s) => postMessage({ o: s + '\\n' }) });
    py.setStderr({ batched: (s) => postMessage({ e: s + '\\n' }) });
    py.setStdin({ stdin: () => { throw new Error('input() is not supported in this terminal'); } });
    const FS = py.FS;
    const rumah = '/home/tamu';
    try { FS.mkdirTree(rumah); } catch {}
    for (const [p, isi] of berkas) {
      const bag = p.split('/'); bag.pop();
      if (bag.length) try { FS.mkdirTree(rumah + '/' + bag.join('/')); } catch {}
      FS.writeFile(rumah + '/' + p, isi);
    }
    FS.chdir(rumah + (cwd ? '/' + cwd : ''));
    await py.runPythonAsync(kode);
  } catch (err) {
    postMessage({ e: String(err && err.message || err) + '\\n' });
  }
  postMessage({ selesai: true });
};`;

const KODE_JS = `
onmessage = async (e) => {
  const tampil = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); } })();
  const ke = (k) => (...a) => postMessage({ [k]: a.map(tampil).join(' ') + '\\n' });
  self.console = { log: ke('o'), info: ke('o'), debug: ke('o'), warn: ke('e'), error: ke('e'), table: ke('o') };
  const process = { version: 'browser', argv: ['node', 'script'], env: {}, exit: () => { throw new Error('process.exit'); } };
  const require = (m) => { throw new Error("require('" + m + "') is not available in the browser sandbox"); };
  try {
    const hasil = await (0, eval)('(async (process, require) => {\\n' + e.data.kode + '\\n})')(process, require);
    await new Promise((r) => setTimeout(r, 30));
  } catch (err) {
    if (!(err && err.message === 'process.exit')) postMessage({ e: (err && err.stack || String(err)) + '\\n' });
  }
  postMessage({ selesai: true });
};`;

export interface Keluaran {
  /** Teks keluaran biasa / galat, dikirim sepotong-sepotong. */
  tulis: (teks: string, galat: boolean) => void;
  info: (teks: string) => void;
}

let workerPy: Worker | null = null;
/** Pyodide di worker yang sekarang sudah termuat — batas waktunya langsung 10 detik. */
let pyTermuat = false;

function buatWorker(kode: string) {
  const url = URL.createObjectURL(new Blob([kode], { type: 'text/javascript' }));
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  return w;
}

/**
 * Jalankan kode. Mengembalikan janji yang selesai saat programnya selesai,
 * dimatikan (waktu/keluaran habis), atau dibatalkan lewat `batal()`.
 */
export function jalankan(
  bahasa: 'python' | 'js',
  kode: string,
  keluaran: Keluaran,
  berkas: [string, string][] = [],
  cwd = ''
) {
  // Worker Python dipakai ulang (memuat Pyodide itu mahal), worker JS selalu baru
  const w = bahasa === 'python' ? (workerPy ??= buatWorker(KODE_PY)) : buatWorker(KODE_JS);
  let panjang = 0;
  let selesai!: (alasan: string) => void;
  const janji = new Promise<string>((r) => (selesai = r));
  const matikan = (alasan: string) => {
    w.terminate();
    if (w === workerPy) {
      workerPy = null;
      pyTermuat = false;
    }
    selesai(alasan);
  };
  // batas waktu mulai dihitung setelah Pyodide termuat, bukan selama mengunduhnya
  // (sekali saja, ~10 MB); kalau sudah termuat, langsung 10 detik
  let waktu = setTimeout(() => matikan('waktu'), bahasa === 'python' && !pyTermuat ? 60_000 : BATAS_WAKTU);
  w.onmessage = (e) => {
    const d = e.data as { o?: string; e?: string; info?: string; selesai?: boolean };
    if (d.info !== undefined) {
      keluaran.info(d.info);
      if (!d.info) {
        pyTermuat = true;
        clearTimeout(waktu);
        waktu = setTimeout(() => matikan('waktu'), BATAS_WAKTU);
      }
      return;
    }
    const t = d.o ?? d.e;
    if (t) {
      panjang += t.length;
      if (panjang > BATAS_KELUARAN) {
        clearTimeout(waktu);
        matikan('keluaran');
        return;
      }
      keluaran.tulis(t, !!d.e);
    }
    if (d.selesai) {
      clearTimeout(waktu);
      if (w !== workerPy) w.terminate();
      selesai('ok');
    }
  };
  w.onerror = (e) => {
    clearTimeout(waktu);
    keluaran.tulis(`${e.message || 'worker error'}\n`, true);
    matikan('galat');
  };
  w.postMessage({ kode, berkas, cwd });
  return {
    janji,
    batal: () => {
      clearTimeout(waktu);
      matikan('batal');
    },
  };
}
