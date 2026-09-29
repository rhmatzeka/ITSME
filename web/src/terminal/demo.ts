/**
 * Shell di browser: dipakai selama server terminal sungguhan belum menyala.
 *
 * Sungguh bisa dipakai ngoding, tapi tidak pernah menyentuh server:
 *
 * - sistem berkas di memori (fs.ts): mkdir, touch, rm, mv, cp, echo > berkas,
 *   dan seterusnya — terkunci di folder rumah, paling banyak 5 MB;
 * - editor: `nvim`/`vim`/`vi` dengan keybinding Vim, `nano` biasa (editor.ts);
 * - `python3` (Pyodide, WebAssembly) dan `node` (JavaScript) berjalan di Web
 *   Worker di browser pengunjung sendiri, dimatikan setelah 10 detik
 *   (jalankan.ts);
 * - pipa (`|`), pengalihan (`>`, `>>`), kutip, riwayat (↑/↓), Tab, Ctrl+C,
 *   Ctrl+L — seperti terminal biasa.
 *
 * Isi awalnya portfolio ini sendiri (hanya-baca) plus beberapa contoh kode
 * yang boleh diubah. Semuanya hilang saat monitornya dimatikan.
 */
import { Fs, GalatFs, KUOTA, RUMAH, type Folder, type Simpul } from './fs';
import { BATAS_WAKTU, jalankan } from './jalankan';

interface Isi {
  projects: { slug: string; title: string; summary: string; stack?: string[]; year?: number; repo?: string; demo?: string; html: string }[];
  pages: {
    slug: string;
    title: string;
    name?: string;
    role?: string;
    html: string;
    groups?: { title: string; items: string[] }[];
    intro?: string;
    outro?: string;
    links?: { label: string; value: string; url: string }[];
  }[];
}

/** HTML hasil Markdown → teks polos yang enak dibaca di terminal. */
function teks(html: string) {
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<\/(p|h\d|li)>/g, '\n').replace(/<li>/g, '  • ').replace(/<br\s*\/?>/g, '\n');
  return (d.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function bungkus(s: string, lebar: number) {
  return s
    .split('\n')
    .map((baris) => {
      const out: string[] = [];
      let kini = '';
      for (const kata of baris.split(' ')) {
        if ((kini + ' ' + kata).trim().length > lebar && kini) {
          out.push(kini);
          kini = kata;
        } else kini = kini ? kini + ' ' + kata : kata;
      }
      out.push(kini);
      return out.join('\n');
    })
    .join('\n');
}

const CONTOH: Record<string, string> = {
  'hello.py': `# Run me:  python3 hello.py\n# Edit me: nvim hello.py   (i = insert, Esc, :wq = save & quit)\nimport random\n\nnames = ["tamu", "friend", "visitor", "fellow dev"]\nprint(f"Hello, {random.choice(names)}! Welcome to Mapporto village.")\n\nfor i in range(1, 6):\n    print("*" * i)\n`,
  'hello.js': `// Run me:  node hello.js\nconst greet = (name) => \`Hello, \${name}! This ran in your browser.\`;\nconsole.log(greet('tamu'));\nconsole.log([1, 2, 3, 4, 5].map((n) => n * n).join(' '));\n`,
  'fizzbuzz.py': `for i in range(1, 21):\n    print("FizzBuzz" if i % 15 == 0 else "Fizz" if i % 3 == 0 else "Buzz" if i % 5 == 0 else i)\n`,
};

/** Isi awal folder rumah: README dan contoh kode — selalu ada, tanpa menunggu apa pun. */
function isiDasar(fs: Fs, lebar: number) {
  const bawaan = (nama: string, s: string, f: Folder = fs.akar) =>
    f.anak.set(nama, { jenis: 'berkas', isi: s.endsWith('\n') ? s : s + '\n', hanyaBaca: true, ubah: Date.now() });
  bawaan(
    'README.txt',
    bungkus(
      [
        "Welcome to Rahmat's computer!",
        '',
        'This terminal runs entirely in your browser: your own user, your own',
        '5 MB home folder, nothing outside it, and it resets when you turn the',
        'monitor off. Nothing you type reaches any server.',
        '',
        'Code:      nvim hello.py   python3 hello.py   node hello.js',
        'Files:     ls  mkdir  touch  cp  mv  rm  cat  echo "hi" > note.txt',
        'Portfolio: cat about.txt   projects   neofetch',
        '',
        'Type help for everything.',
      ].join('\n'),
      lebar
    )
  );
  for (const [n, s] of Object.entries(CONTOH)) fs.akar.anak.set(n, { jenis: 'berkas', isi: s, ubah: Date.now() });
}

/** Berkas portfolio (hanya-baca): about, stack, contact, cv, projects/. */
function isiPortfolio(fs: Fs, isi: Isi, lebar: number) {
  const bawaan = (nama: string, s: string, f: Folder = fs.akar) =>
    f.anak.set(nama, { jenis: 'berkas', isi: s.endsWith('\n') ? s : s + '\n', hanyaBaca: true, ubah: Date.now() });
  const halaman = (slug: string) => isi.pages.find((p) => p.slug === slug);
  const about = halaman('about');
  const stack = halaman('stack');
  const contact = halaman('contact');
  const cv = halaman('cv');
  if (about) bawaan('about.txt', bungkus(`${about.name ?? ''}\n${about.role ?? ''}\n\n${teks(about.html)}`, lebar));
  if (stack) bawaan('stack.txt', bungkus((stack.groups ?? []).map((g) => `${g.title}:\n  ${g.items.join(', ')}`).join('\n\n'), lebar));
  if (contact)
    bawaan(
      'contact.txt',
      bungkus([contact.intro ?? '', '', ...(contact.links ?? []).map((l) => `${l.label.padEnd(9)} ${l.value}`), '', contact.outro ?? ''].join('\n'), lebar)
    );
  if (cv) bawaan('cv.txt', bungkus(teks(cv.html), lebar));
  const proj: Folder = { jenis: 'folder', anak: new Map(), hanyaBaca: true, ubah: Date.now() };
  for (const p of isi.projects) {
    bawaan(
      `${p.slug}.md`,
      bungkus(
        [`# ${p.title}${p.year ? ` (${p.year})` : ''}`, '', p.summary, '', p.stack?.length ? `Stack: ${p.stack.join(', ')}` : '', p.repo ? `Repo:  ${p.repo}` : '', p.demo ? `Demo:  ${p.demo}` : '', '', teks(p.html)]
          .filter((b, i, a) => b !== '' || a[i - 1] !== '')
          .join('\n'),
        lebar
      ),
      proj
    );
  }
  fs.akar.anak.set('projects', proj);
}

/**
 * Logo neofetch Mats OS: lambang "M" dari dua puncak gunung, lalu tulisan
 * MATS OS berhuruf piksel — digambar sebagai pixel art di kanvas, bukan dari
 * karakter teks. Huruf blok (█) tidak ada di font terminalnya, dan font
 * cadangan membuat lebar tiap baris berbeda sehingga logonya pecah.
 */
const LAMBANG = [
  '#................#',
  '##..............##',
  '###............###',
  '####..........####',
  '#####........#####',
  '######......######',
  '###.###....###.###',
  '###..###..###..###',
  '###...######...###',
  '###....####....###',
  '###.....##.....###',
  '###............###',
  '###............###',
];
const HURUF: Record<string, string[]> = {
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  ' ': ['...', '...', '...', '...', '...'],
};

function logoMatsOs() {
  const besar = 10;
  const kecil = 5;
  const tulisan = [...'MATS OS'].map((c) => HURUF[c]);
  const lebarTulisan = tulisan.reduce((n, h) => n + h[0].length + 1, -1);
  const w = Math.max(LAMBANG[0].length * besar, lebarTulisan * kecil);
  const h = LAMBANG.length * besar + 14 + 5 * kecil;
  const c = document.createElement('canvas');
  c.width = w + 4;
  c.height = h + 4;
  c.className = 'term-logo';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'Mats OS');
  const g = c.getContext('2d')!;
  // gradasi baris: hijau fosfor → toska → kuning
  const warna = (t: number) => {
    const a = t < 0.5 ? [159, 245, 176] : [127, 232, 224];
    const b = t < 0.5 ? [127, 232, 224] : [242, 208, 107];
    const f = t < 0.5 ? t * 2 : t * 2 - 1;
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`;
  };
  const kotak = (x: number, y: number, uk: number, isi: string) => {
    // bayangan gelap sedikit ke kanan-bawah, lalu pikselnya
    g.fillStyle = '#05100a';
    g.fillRect(x + 3, y + 3, uk, uk);
    g.fillStyle = isi;
    g.fillRect(x, y, uk, uk);
  };
  const kiriLambang = (w - LAMBANG[0].length * besar) / 2;
  LAMBANG.forEach((baris, y) =>
    [...baris].forEach((ch, x) => ch === '#' && kotak(kiriLambang + x * besar, y * besar, besar, warna(y / (LAMBANG.length - 1))))
  );
  let x = (w - lebarTulisan * kecil) / 2;
  const atas = LAMBANG.length * besar + 14;
  for (const hurufnya of tulisan) {
    hurufnya.forEach((baris, y) => [...baris].forEach((ch, i) => ch === '#' && kotak(x + i * kecil, atas + y * kecil, kecil, '#f2d06b')));
    x += (hurufnya[0].length + 1) * kecil;
  }
  return c;
}

/**
 * Kode warna ANSI (`ESC[...m`) → gaya. Dipakai neofetch, dan keluaran
 * Python/JavaScript pengunjung yang berwarna ikut tampil berwarna.
 */
const ANSI: Record<number, string> = {
  30: '#3a4a3e', 31: '#ff7a6b', 32: '#5cf08a', 33: '#f2d06b', 34: '#7fb4ff', 35: '#ff9ad5', 36: '#7fe8e0', 37: '#d6f5dc',
  90: '#6f8a76', 91: '#ffa396', 92: '#9ff5b0', 93: '#ffe79a', 94: '#b0d0ff', 95: '#ffc2e6', 96: '#b8fff6', 97: '#ffffff',
};
const ESC = '\x1b';
const w = (kode: number | string, teks: string) => `${ESC}[${kode}m${teks}${ESC}[0m`;

function tempelAnsi(el: HTMLElement, s: string) {
  let fg = '';
  let bg = '';
  let tebal = false;
  const re = /\x1b\[([0-9;]*)m/g;
  let dari = 0;
  const potong = (teks: string) => {
    if (!teks) return;
    if (!fg && !bg && !tebal) return void el.append(teks);
    const sp = document.createElement('span');
    sp.textContent = teks;
    if (fg) sp.style.color = fg;
    if (bg) sp.style.backgroundColor = bg;
    if (tebal) sp.style.fontWeight = 'bold';
    el.append(sp);
  };
  for (let m = re.exec(s); m; m = re.exec(s)) {
    potong(s.slice(dari, m.index));
    dari = re.lastIndex;
    const kode = (m[1] || '0').split(';').map(Number);
    for (let i = 0; i < kode.length; i++) {
      const c = kode[i];
      if (c === 0) [fg, bg, tebal] = ['', '', false];
      else if (c === 1) tebal = true;
      else if (c === 22) tebal = false;
      else if (c === 39) fg = '';
      else if (c === 49) bg = '';
      else if (ANSI[c]) fg = ANSI[c];
      else if (ANSI[c - 10]) bg = ANSI[c - 10];
      else if ((c === 38 || c === 48) && kode[i + 1] === 2) {
        const warna = `rgb(${kode[i + 2] ?? 0},${kode[i + 3] ?? 0},${kode[i + 4] ?? 0})`;
        if (c === 38) fg = warna;
        else bg = warna;
        i += 4;
      }
    }
  }
  potong(s.slice(dari));
}

/** Pecah satu baris perintah jadi token, menghormati kutip dan garis miring terbalik. */
function token(s: string): string[] {
  const out: string[] = [];
  let kini = '';
  let ada = false;
  let kutip: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (kutip) {
      if (c === kutip) kutip = null;
      // seperti bash: di dalam "..." garis miring terbalik hanya meng-escape $ ` " \
      // — "\033[31m" tetap sampai utuh ke Python
      else if (c === '\\' && kutip === '"' && '$`"\\'.includes(s[i + 1] ?? '')) kini += s[++i];
      else kini += c;
    } else if (c === '"' || c === "'") {
      kutip = c;
      ada = true;
    } else if (c === '\\' && i + 1 < s.length) {
      kini += s[++i];
      ada = true;
    } else if (/\s/.test(c)) {
      if (ada || kini) out.push(kini);
      kini = '';
      ada = false;
    } else if (c === '|' || c === '>') {
      if (ada || kini) out.push(kini);
      kini = '';
      ada = false;
      if (c === '>' && s[i + 1] === '>') {
        out.push('>>');
        i++;
      } else out.push(c);
    } else {
      kini += c;
      ada = true;
    }
  }
  if (ada || kini) out.push(kini);
  return out;
}

const ukuran = (n: number) => (n < 1024 ? `${n}` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)}K` : `${(n / 1024 / 1024).toFixed(1)}M`);

type Keluar = { out: string[]; err: string[]; dialihkan?: boolean };
type Perintah = { bantu: string; jalan: (a: string[], masuk: string, k: Keluar) => void | Promise<void> };

/** Pasang shell di `wadah` (layar monitor). Mengembalikan fungsi pembersih. */
export function mulaiDemo(wadah: HTMLElement, konten?: Isi | null) {
  const layar = document.createElement('div');
  layar.className = 'term-demo';
  const keluaran = document.createElement('div');
  keluaran.className = 'term-keluaran';
  const baris = document.createElement('label');
  baris.className = 'term-baris';
  const prompt = document.createElement('span');
  prompt.className = 'term-prompt';
  const masuk = document.createElement('input');
  masuk.className = 'term-input';
  masuk.type = 'text';
  masuk.autocomplete = 'off';
  masuk.spellcheck = false;
  masuk.setAttribute('autocapitalize', 'off');
  masuk.setAttribute('autocorrect', 'off');
  masuk.setAttribute('aria-label', 'Terminal input');
  baris.append(prompt, masuk);
  layar.append(keluaran, baris);
  wadah.append(layar);

  const lebar = () => Math.max(28, Math.min(88, Math.floor(keluaran.clientWidth / 9.2)));
  const fs = new Fs();
  const riwayat: string[] = [];
  let ke = 0;
  let berjalan: { batal: () => void } | null = null;
  let sibuk = false;
  const dibuka = Date.now();

  const setPrompt = () => (prompt.textContent = `tamu@desa-mapporto:${fs.tampil(fs.cwd)}$ `);

  function tulis(s: string, kelas = '') {
    if (!s) return;
    const el = document.createElement('pre');
    el.className = `term-teks ${kelas}`;
    const isi = s.replace(/\n$/, '');
    if (isi.includes(ESC + '[')) tempelAnsi(el, isi);
    else el.textContent = isi;
    keluaran.append(el);
    // layar yang sangat panjang dipangkas: pengunjung tidak bisa membuat halaman berat
    while (keluaran.childElementCount > 1500) keluaran.firstElementChild?.remove();
    layar.scrollTop = layar.scrollHeight;
  }

  const bacaBerkas = (j: string, perintah: string) => {
    const { n } = fs.cari(j, perintah);
    if (n.jenis === 'folder') throw new GalatFs(`${perintah}: ${j}: Is a directory`);
    return n.isi;
  };

  const opsi = (a: string[]) => {
    const f = new Set<string>();
    const sisa: string[] = [];
    for (const x of a) {
      if (/^-[a-zA-Z]+$/.test(x)) for (const c of x.slice(1)) f.add(c);
      else sisa.push(x);
    }
    return { f, sisa };
  };

  async function jalankanKode(bahasa: 'python' | 'js', kode: string, k: Keluar) {
    const arus = !k.dialihkan;
    sibuk = true;
    baris.hidden = true;
    let info: HTMLElement | null = null;
    const r = jalankan(
      bahasa,
      kode,
      {
        tulis: (t, galat) => (arus ? tulis(t, galat ? 'galat' : '') : (galat ? k.err : k.out).push(t)),
        info: (t) => {
          if (t && !info) {
            info = document.createElement('pre');
            info.className = 'term-teks redup';
            info.textContent = t;
            keluaran.append(info);
            layar.scrollTop = layar.scrollHeight;
          } else if (!t) {
            info?.remove();
            info = null;
          }
        },
      },
      bahasa === 'python' ? fs.semuaBerkas() : [],
      fs.cwd.join('/')
    );
    berjalan = r;
    const alasan = await r.janji;
    berjalan = null;
    sibuk = false;
    baris.hidden = false;
    (info as HTMLElement | null)?.remove();
    if (alasan === 'waktu') k.err.push(`Killed: programs can run for at most ${BATAS_WAKTU / 1000} seconds here.`);
    if (alasan === 'keluaran') k.err.push('Killed: too much output.');
    if (alasan === 'batal') k.err.push('^C');
    setTimeout(() => masuk.focus(), 0);
  }

  const PERINTAH: Record<string, Perintah> = {
    help: {
      bantu: 'list the commands',
      jalan: (_a, _m, k) =>
        void k.out.push(
          Object.entries(PERINTAH)
            .filter(([n]) => !TERSEMBUNYI.has(n))
            .map(([n, p]) => `  ${n.padEnd(9)} ${p.bantu}`)
            .join('\n') + '\n\n  Pipes (|), redirects (> >>), Tab completes, ↑/↓ history, Ctrl+C stops, Ctrl+L clears.'
        ),
    },
    ls: {
      bantu: 'list files (-l details, -a hidden)',
      jalan: (a, _m, k) => {
        const { f, sisa } = opsi(a);
        for (const j of sisa.length ? sisa : ['.']) {
          const { n } = fs.cari(j, 'ls');
          const isi: [string, Simpul][] = n.jenis === 'folder' ? [...n.anak].filter(([nm]) => f.has('a') || !nm.startsWith('.')) : [[j, n]];
          if (sisa.length > 1) k.out.push(`${j}:`);
          if (f.has('l'))
            k.out.push(
              isi
                .map(([nm, s]) => {
                  const mode = s.jenis === 'folder' ? 'd' : '-';
                  const hak = s.hanyaBaca ? 'r--r--r--' : 'rw-r--r--';
                  const b = s.jenis === 'berkas' ? new TextEncoder().encode(s.isi).length : 4096;
                  const t = new Date(s.ubah).toTimeString().slice(0, 5);
                  return `${mode}${hak} tamu tamu ${ukuran(b).padStart(6)} ${t} ${nm}${s.jenis === 'folder' ? '/' : ''}`;
                })
                .join('\n')
            );
          else k.out.push(isi.map(([nm, s]) => (s.jenis === 'folder' ? `${nm}/` : nm)).join('   '));
        }
      },
    },
    cd: {
      bantu: 'change folder',
      jalan: (a) => {
        const j = a[0] ?? '~';
        const { p, n } = fs.cari(j, 'cd');
        if (n.jenis !== 'folder') throw new GalatFs(`cd: ${j}: Not a directory`);
        fs.cwd = p;
      },
    },
    pwd: { bantu: 'where you are', jalan: (_a, _m, k) => void k.out.push(RUMAH + (fs.cwd.length ? '/' + fs.cwd.join('/') : '')) },
    cat: {
      bantu: 'show a file',
      jalan: (a, m, k) => {
        if (!a.length) return void k.out.push(m);
        for (const j of a) k.out.push(bacaBerkas(j, 'cat'));
      },
    },
    echo: { bantu: 'print text (echo hi > file.txt)', jalan: (a, _m, k) => void k.out.push(a.join(' ') + '\n') },
    mkdir: {
      bantu: 'make a folder (-p parents)',
      jalan: (a) => {
        const { f, sisa } = opsi(a);
        if (!sisa.length) throw new GalatFs('mkdir: missing folder name');
        for (const j of sisa) fs.mkdir(j, f.has('p'));
      },
    },
    touch: {
      bantu: 'make an empty file',
      jalan: (a) => {
        if (!a.length) throw new GalatFs('touch: missing file name');
        for (const j of a) {
          const p = fs.urai(j);
          const ada = p && fs.ambil(p);
          if (ada) ada.ubah = Date.now();
          else fs.tulis(j, '', 'touch');
        }
      },
    },
    rm: {
      bantu: 'remove (-r folders, -f quiet)',
      jalan: (a) => {
        const { f, sisa } = opsi(a);
        if (!sisa.length) throw new GalatFs('rm: missing operand');
        for (const j of sisa) {
          try {
            fs.rm(j, f.has('r') || f.has('R'));
          } catch (e) {
            if (!(f.has('f') && /No such/.test(String((e as Error).message)))) throw e;
          }
        }
      },
    },
    rmdir: {
      bantu: 'remove an empty folder',
      jalan: (a) => {
        for (const j of a) {
          const { n } = fs.cari(j, 'rmdir');
          if (n.jenis !== 'folder') throw new GalatFs(`rmdir: ${j}: Not a directory`);
          if (n.anak.size) throw new GalatFs(`rmdir: ${j}: Directory not empty`);
          fs.rm(j, true, 'rmdir');
        }
      },
    },
    mv: {
      bantu: 'move / rename',
      jalan: (a) => {
        const { sisa } = opsi(a);
        if (sisa.length < 2) throw new GalatFs('mv: missing destination');
        const ke = sisa.pop()!;
        for (const j of sisa) fs.pindah(j, ke, false, true);
      },
    },
    cp: {
      bantu: 'copy (-r folders)',
      jalan: (a) => {
        const { f, sisa } = opsi(a);
        if (sisa.length < 2) throw new GalatFs('cp: missing destination');
        const ke = sisa.pop()!;
        for (const j of sisa) fs.pindah(j, ke, true, f.has('r') || f.has('R'));
      },
    },
    tree: {
      bantu: 'show folders as a tree',
      jalan: (a, _m, k) => {
        const { n } = fs.cari(a[0] ?? '.', 'tree');
        const garis: string[] = [a[0] ?? '.'];
        const turun = (f: Simpul, awal: string) => {
          if (f.jenis !== 'folder') return;
          const d = [...f.anak];
          d.forEach(([nm, s], i) => {
            const akhir = i === d.length - 1;
            garis.push(`${awal}${akhir ? '└── ' : '├── '}${nm}${s.jenis === 'folder' ? '/' : ''}`);
            turun(s, awal + (akhir ? '    ' : '│   '));
          });
        };
        turun(n, '');
        k.out.push(garis.join('\n'));
      },
    },
    head: {
      bantu: 'first lines (-n N)',
      jalan: (a, m, k) => {
        const i = a.indexOf('-n');
        const n = i >= 0 ? Number(a.splice(i, 2)[1]) || 10 : 10;
        const s = a.length ? bacaBerkas(a[0], 'head') : m;
        k.out.push(s.replace(/\n$/, '').split('\n').slice(0, n).join('\n'));
      },
    },
    tail: {
      bantu: 'last lines (-n N)',
      jalan: (a, m, k) => {
        const i = a.indexOf('-n');
        const n = i >= 0 ? Number(a.splice(i, 2)[1]) || 10 : 10;
        const s = (a.length ? bacaBerkas(a[0], 'tail') : m).replace(/\n$/, '');
        k.out.push(s.split('\n').slice(-n).join('\n'));
      },
    },
    wc: {
      bantu: 'count lines, words, bytes',
      jalan: (a, m, k) => {
        const s = a.length ? bacaBerkas(a[0], 'wc') : m;
        const baris = s ? s.split('\n').length - (s.endsWith('\n') ? 1 : 0) : 0;
        k.out.push(`${baris} ${s.split(/\s+/).filter(Boolean).length} ${new TextEncoder().encode(s).length}${a[0] ? ' ' + a[0] : ''}`);
      },
    },
    grep: {
      bantu: 'search text (-i -n)',
      jalan: (a, m, k) => {
        const { f, sisa } = opsi(a);
        const [pola, ...berkas] = sisa;
        if (!pola) throw new GalatFs('grep: missing pattern');
        let re: RegExp;
        try {
          re = new RegExp(pola, f.has('i') ? 'i' : '');
        } catch {
          re = new RegExp(pola.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.has('i') ? 'i' : '');
        }
        const sumber = berkas.length ? berkas.map((b) => [b, bacaBerkas(b, 'grep')] as const) : [['', m] as const];
        for (const [nama, s] of sumber)
          s.replace(/\n$/, '')
            .split('\n')
            .forEach((b, i) => {
              if (re.test(b)) k.out.push(`${berkas.length > 1 ? nama + ':' : ''}${f.has('n') ? i + 1 + ':' : ''}${b}`);
            });
      },
    },
    find: {
      bantu: 'find files (find . -name "*.py")',
      jalan: (a, _m, k) => {
        const ni = a.indexOf('-name');
        const nama = ni >= 0 ? a[ni + 1] ?? '' : '';
        const awal = a[0] && a[0] !== '-name' ? a[0] : '.';
        const re = new RegExp('^' + nama.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        const telusur = (n: Simpul, p: string) => {
          if (!nama || re.test(p.split('/').pop() ?? '')) k.out.push(p);
          if (n.jenis === 'folder') for (const [nm, s] of n.anak) telusur(s, `${p}/${nm}`);
        };
        telusur(fs.cari(awal, 'find').n, awal);
      },
    },
    df: {
      bantu: 'your storage space',
      jalan: (_a, _m, k) => {
        const t = fs.terpakai();
        k.out.push(
          `Filesystem   Size   Used  Avail  Use%  Mounted on\nhome         5.0M  ${ukuran(t).padStart(5)}  ${ukuran(KUOTA - t).padStart(5)}  ${String(Math.ceil((t / KUOTA) * 100)).padStart(3)}%  ${RUMAH}`
        );
      },
    },
    du: { bantu: 'space used', jalan: (_a, _m, k) => void k.out.push(`${ukuran(fs.terpakai())}\t~`) },
    nvim: { bantu: 'edit with Vim keys (also vim, vi)', jalan: (a) => sunting(a[0], 'vim') },
    nano: { bantu: 'simple editor (^S save, ^X exit)', jalan: (a) => sunting(a[0], 'nano') },
    python3: {
      bantu: 'run Python (file, or -c "code")',
      jalan: async (a, m, k) => {
        const kode = a[0] === '-c' ? a.slice(1).join(' ') : a[0] ? bacaBerkas(a[0], 'python3') : m;
        if (!kode.trim()) throw new GalatFs('python3: give a script, e.g. python3 hello.py (interactive mode is not available here)');
        await jalankanKode('python', kode, k);
      },
    },
    node: {
      bantu: 'run JavaScript (file, or -e "code")',
      jalan: async (a, m, k) => {
        const kode = a[0] === '-e' ? a.slice(1).join(' ') : a[0] ? bacaBerkas(a[0], 'node') : m;
        if (!kode.trim()) throw new GalatFs('node: give a script, e.g. node hello.js');
        await jalankanKode('js', kode, k);
      },
    },
    projects: {
      bantu: "Rahmat's projects",
      jalan: (_a, _m, k) => {
        const f = fs.akar.anak.get('projects');
        if (f?.jenis !== 'folder') return;
        k.out.push(
          [...f.anak].map(([n, s]) => `  ${n.padEnd(26)} ${s.jenis === 'berkas' ? s.isi.split('\n')[0].replace(/^# /, '') : ''}`).join('\n') +
            '\n\n  cat projects/<name> to read one.'
        );
      },
    },
    neofetch: {
      bantu: 'system info',
      jalan: (_a, _m, k) => {
        const menit = Math.max(1, Math.round((Date.now() - dibuka) / 60000));
        const nav = navigator as Navigator & { deviceMemory?: number };
        const judul = `${w('1;92', 'tamu')}${w(97, '@')}${w('1;92', 'mats-os')}`;
        const baris: [string, string][] = [
          ['OS', 'Mats OS 1.0 x86_pixel'],
          ['Host', "Rahmat's desk, About house"],
          ['Kernel', 'wasm-6.9-desa'],
          ['Uptime', `${menit} min${menit > 1 ? 's' : ''}`],
          ['Packages', '4 (python3, node, nvim, nano)'],
          ['Shell', 'mats-sh 2.0'],
          ['Resolution', `${innerWidth}x${innerHeight}`],
          ['Terminal', 'RAHMAT-PC CRT'],
          ['CPU', `${nav.hardwareConcurrency || '?'} cores (your browser)`],
          ['Memory', nav.deviceMemory ? `${nav.deviceMemory} GB (your browser)` : 'private'],
          ['Disk (~)', `${ukuran(fs.terpakai())}B / 5.0MB`],
          ['Owner', 'Rahmat Eka Satria'],
          ['Role', 'Full-Stack — Web, Mobile & Web3'],
        ];
        const info = [
          judul,
          w(32, '-'.repeat(12)),
          ...baris.map(([l, v]) => `${w('1;92', l)}${w(97, ':')} ${v}`),
          '',
          // deretan warna khas neofetch: normal lalu terang
          [40, 41, 42, 43, 44, 45, 46, 47].map((c) => w(c, '   ')).join(''),
          [100, 101, 102, 103, 104, 105, 106, 107].map((c) => w(c, '   ')).join(''),
        ];
        if (k.dialihkan) {
          // ke berkas atau pipa: teks saja
          k.out.push(['Mats OS', ...info].join('\n'));
          return;
        }
        // ke layar: logo pixel art di kiri (di ponsel pindah ke atas), keterangan di kanan
        const blok = document.createElement('div');
        blok.className = 'term-neofetch';
        const teksnya = document.createElement('pre');
        teksnya.className = 'term-teks hasil';
        tempelAnsi(teksnya, info.join('\n'));
        blok.append(logoMatsOs(), teksnya);
        keluaran.append(blok);
        layar.scrollTop = layar.scrollHeight;
      },
    },
    whoami: { bantu: 'who you are', jalan: (_a, _m, k) => void k.out.push('tamu  (Indonesian for "guest")') },
    date: { bantu: 'current date', jalan: (_a, _m, k) => void k.out.push(new Date().toString()) },
    uname: { bantu: 'system name', jalan: (_a, _m, k) => void k.out.push('Mats OS 1.0 wasm-6.9-desa x86_pixel') },
    history: { bantu: 'past commands', jalan: (_a, _m, k) => void k.out.push(riwayat.map((r, i) => `  ${String(i + 1).padStart(3)}  ${r}`).join('\n')) },
    clear: { bantu: 'clear the screen', jalan: () => keluaran.replaceChildren() },
    sudo: {
      bantu: 'try it',
      jalan: () => {
        throw new GalatFs('tamu is not in the sudoers file. This incident will be reported to the village chief.');
      },
    },
    exit: { bantu: 'turn the monitor off', jalan: () => document.querySelector<HTMLButtonElement>('.monitor-daya')?.click() },
  };
  // nama lain
  PERINTAH.vim = PERINTAH.vi = PERINTAH.neovim = PERINTAH.nvim;
  PERINTAH.python = PERINTAH.python3;
  PERINTAH.man = PERINTAH.help;
  const TERSEMBUNYI = new Set(['vim', 'vi', 'neovim', 'python', 'man']);

  /**
   * Buka editor. Tanpa nama berkas pun boleh, seperti nvim/nano sungguhan:
   * bufernya kosong tanpa nama, dan namanya diberikan saat menyimpan
   * (`:w catatan.txt` di nvim, pertanyaan "File Name to Write" di nano).
   */
  async function sunting(j: string | undefined, mode: 'vim' | 'nano') {
    let n: Simpul | null = null;
    if (j) {
      const p = fs.urai(j);
      if (!p) throw new GalatFs(`${j}: Permission denied: you can only use your home folder (~)`);
      n = fs.ambil(p);
      if (n?.jenis === 'folder') throw new GalatFs(`${j}: Is a directory`);
    }
    sibuk = true;
    baris.hidden = true;
    try {
      const { bukaEditor } = await import('./editor');
      await bukaEditor(wadah, {
        nama: j ?? '',
        isi: n?.jenis === 'berkas' ? n.isi : '',
        mode,
        hanyaBaca: n?.hanyaBaca,
        simpan: (isi, nama) => {
          try {
            fs.tulis(nama, isi, mode === 'vim' ? 'E514: write error' : 'nano');
            return null;
          } catch (e) {
            return (e as Error).message;
          }
        },
      });
    } finally {
      sibuk = false;
      baris.hidden = false;
      setTimeout(() => masuk.focus(), 30);
    }
  }

  async function jalankanBaris(cmd: string) {
    tulis(`${prompt.textContent}${cmd}`, 'gema');
    const t = token(cmd.trim());
    if (!t.length) return;
    riwayat.push(cmd.trim());
    if (riwayat.length > 200) riwayat.shift();
    ke = riwayat.length;
    // pengalihan di ujung: > berkas atau >> berkas
    let tujuan: { berkas: string; tambah: boolean } | null = null;
    const r = t.findIndex((x) => x === '>' || x === '>>');
    if (r >= 0) {
      if (!t[r + 1]) return tulis('syntax error: missing file after ' + t[r], 'galat');
      tujuan = { berkas: t[r + 1], tambah: t[r] === '>>' };
      t.splice(r);
    }
    // pipa: keluaran satu perintah jadi masukan perintah berikutnya
    const tahap: string[][] = [[]];
    for (const x of t) {
      if (x === '|') tahap.push([]);
      else tahap[tahap.length - 1].push(x);
    }
    let aliran = '';
    for (let i = 0; i < tahap.length; i++) {
      const [nama, ...arg] = tahap[i];
      if (!nama) return tulis('syntax error near |', 'galat');
      const p = PERINTAH[nama];
      if (!p) return tulis(`${nama}: command not found. Type help.`, 'galat');
      const terakhir = i === tahap.length - 1;
      const k: Keluar = { out: [], err: [], dialihkan: !terakhir || !!tujuan };
      try {
        await p.jalan(arg, aliran, k);
      } catch (e) {
        k.err.push(e instanceof GalatFs ? e.message : `${nama}: ${(e as Error).message}`);
      }
      for (const g of k.err) tulis(g, 'galat');
      aliran = k.out.map((s) => (s.endsWith('\n') ? s : s + '\n')).join('');
    }
    if (tujuan) {
      try {
        fs.tulis(tujuan.berkas, aliran, 'bash', tujuan.tambah);
      } catch (e) {
        tulis((e as Error).message, 'galat');
      }
    } else tulis(aliran, 'hasil');
  }

  function lengkapi() {
    const nilai = masuk.value;
    const bagian = nilai.split(' ');
    const akhir = bagian[bagian.length - 1];
    let calon: string[];
    if (bagian.length === 1) calon = Object.keys(PERINTAH).filter((n) => n.startsWith(akhir) && !TERSEMBUNYI.has(n));
    else {
      const potong = akhir.lastIndexOf('/');
      const dir = potong >= 0 ? akhir.slice(0, potong + 1) : '';
      const awal = akhir.slice(potong + 1);
      const p = fs.urai(dir || '.');
      const f = p && fs.ambil(p);
      calon = f?.jenis === 'folder' ? [...f.anak].filter(([n]) => n.startsWith(awal)).map(([n, v]) => dir + n + (v.jenis === 'folder' ? '/' : '')) : [];
    }
    if (calon.length === 1) {
      bagian[bagian.length - 1] = calon[0];
      masuk.value = bagian.join(' ') + (calon[0].endsWith('/') ? '' : ' ');
    } else if (calon.length > 1) {
      const sama = calon.reduce((a, b) => {
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        return a.slice(0, i);
      });
      if (sama.length > akhir.length) {
        bagian[bagian.length - 1] = sama;
        masuk.value = bagian.join(' ');
      } else {
        tulis(`${prompt.textContent}${nilai}`, 'gema');
        tulis(calon.join('   '), 'daftar');
      }
    }
  }

  masuk.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sibuk) return;
      const v = masuk.value;
      masuk.value = '';
      void jalankanBaris(v).then(setPrompt);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (ke > 0) masuk.value = riwayat[--ke];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      ke = Math.min(riwayat.length, ke + 1);
      masuk.value = riwayat[ke] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      lengkapi();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      keluaran.replaceChildren();
    } else if (e.key === 'c' && e.ctrlKey && masuk.selectionStart === masuk.selectionEnd) {
      // Ctrl+C tanpa teks terpilih = batalkan baris, seperti di terminal
      tulis(`${prompt.textContent}${masuk.value}^C`, 'gema');
      masuk.value = '';
    }
  });
  // Ctrl+C selagi program berjalan: hentikan programnya
  const henti = (e: KeyboardEvent) => {
    if (berjalan && e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      berjalan.batal();
    }
  };
  document.addEventListener('keydown', henti);
  layar.addEventListener('click', () => {
    if (!sibuk && !getSelection()?.toString()) masuk.focus();
  });

  setPrompt();
  tulis("Rahmat's computer. Type help to begin, or try: nvim hello.py", 'sambut');
  /*
   * Folder rumah langsung terisi. Isi portfolio diambil dari yang sudah
   * dimuat game di layar muat (`konten`); dulu diunduh ulang di sini, dan di
   * jaringan lambat terminalnya kosong belasan detik menunggu content.json.
   * Cadangannya: unduh, paling lama 6 detik.
   */
  isiDasar(fs, lebar());
  tulis('Tip: cat README.txt', 'redup');
  if (konten) isiPortfolio(fs, konten, lebar());
  else {
    const batal = new AbortController();
    const waktu = setTimeout(() => batal.abort(), 6000);
    fetch('/content.json', { signal: batal.signal })
      .then((r) => r.json() as Promise<Isi>)
      .then((isi) => isiPortfolio(fs, isi, lebar()))
      .catch(() => {})
      .finally(() => clearTimeout(waktu));
  }
  setTimeout(() => masuk.focus(), 50);

  return () => {
    berjalan?.batal();
    document.removeEventListener('keydown', henti);
    wadah.replaceChildren();
  };
}
