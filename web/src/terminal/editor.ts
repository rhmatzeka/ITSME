/**
 * Editor teks di layar monitor: `vim`/`vi`/`nvim` membuka CodeMirror dengan
 * keybinding Vim sungguhan (@replit/codemirror-vim: mode normal/insert/visual,
 * :w :q :wq :q!, dd, yy, p, /cari, dan seterusnya); `nano` membuka editor
 * biasa dengan Ctrl+S / Ctrl+X dan tombol yang bisa disentuh di ponsel.
 *
 * Dimuat hanya saat editornya dibuka (import dinamis), jadi pengunjung yang
 * tidak pernah membuka editor tidak mengunduh satu byte pun dari sini.
 */
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { tags as t } from '@lezer/highlight';
import { vim, Vim } from '@replit/codemirror-vim';

export interface OpsiEditor {
  /** Nama berkas; kosong = bufer tanpa nama (`nvim` atau `nano` saja). */
  nama: string;
  isi: string;
  mode: 'vim' | 'nano';
  /** Simpan ke berkas `nama`; kembalikan pesan galat (mis. kuota penuh) atau null kalau berhasil. */
  simpan: (isi: string, nama: string) => string | null;
  hanyaBaca?: boolean;
}

const tema = EditorView.theme(
  {
    '&': { height: '100%', color: '#d6f5dc', backgroundColor: '#0c1510', fontSize: '15px' },
    '.cm-content': { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", caretColor: '#9ff5b0' },
    '.cm-scroller': { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", lineHeight: '1.45' },
    '.cm-gutters': { backgroundColor: '#0a120d', color: '#3f6b4b', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(159,245,176,0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(159,245,176,0.08)', color: '#9ff5b0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#9ff5b0' },
    '.cm-fat-cursor': { background: 'rgba(159,245,176,0.7) !important', color: '#0c1510 !important' },
    '&:not(.cm-focused) .cm-fat-cursor': { background: 'none !important', outline: '1px solid #9ff5b0' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#1f4d2e !important' },
    '.cm-panels': { backgroundColor: '#0a120d', color: '#9ff5b0', borderTop: '1px solid #1f4d2e' },
    '.cm-vim-panel': { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", padding: '2px 8px' },
    '.cm-vim-panel input': { color: '#e8f7ea', fontFamily: 'inherit' },
    '.cm-matchingBracket': { backgroundColor: '#1f4d2e', outline: 'none' },
  },
  { dark: true }
);

const warna = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: '#ff9ad5' },
  { tag: [t.string, t.special(t.string)], color: '#f2d06b' },
  { tag: [t.number, t.bool, t.null], color: '#ffb46b' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#5f8a6a', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#7fd4ff' },
  { tag: [t.definition(t.variableName), t.className], color: '#9ff5b0' },
  { tag: [t.propertyName], color: '#b8e0ff' },
  { tag: [t.operator, t.punctuation], color: '#a6c9ae' },
]);

function bahasa(nama: string) {
  if (/\.py$/.test(nama)) return [python()];
  if (/\.(m?js|cjs|ts|json)$/.test(nama)) return [javascript({ typescript: /\.ts$/.test(nama) })];
  return [];
}

/**
 * Buka editor menutupi `wadah` (layar monitor). Selesai saat pengunjung
 * keluar (:q / Ctrl+X). Selama terbuka, shell di bawahnya menunggu.
 */
export function bukaEditor(wadah: HTMLElement, o: OpsiEditor): Promise<void> {
  return new Promise((selesai) => {
    const lapis = document.createElement('div');
    lapis.className = 'term-editor';
    const atas = document.createElement('div');
    atas.className = 'term-editor-atas';
    const judul = document.createElement('span');
    const kabar = document.createElement('span');
    kabar.className = 'term-editor-kabar';
    atas.append(judul, kabar);
    const badan = document.createElement('div');
    badan.className = 'term-editor-badan';
    const bawah = document.createElement('div');
    bawah.className = 'term-editor-bawah';
    lapis.append(atas, badan, bawah);
    wadah.append(lapis);

    let tersimpan = o.isi;
    let nama = o.nama;
    let hanyaBaca = !!o.hanyaBaca;
    const judulnya = () => {
      const ubah = view.state.doc.toString() !== tersimpan;
      judul.textContent = `${o.mode === 'vim' ? 'NVIM' : 'GNU nano'}  ${nama || '[No Name]'}${ubah ? ' [+]' : ''}${hanyaBaca ? ' [RO]' : ''}`;
    };
    const kabari = (s: string, galat = false) => {
      kabar.textContent = s;
      kabar.classList.toggle('galat', galat);
    };
    const bahasaKini = new Compartment();

    /**
     * Simpan ke `ke` (atau ke nama bufer sekarang). Bufer tanpa nama:
     * nvim menjawab E32 seperti aslinya, nano menanyakan namanya dulu.
     * Menyimpan ke nama lain dari berkas hanya-baca membuat salinan milik
     * pengunjung — cara wajar mengubah contoh bawaan.
     */
    const tulis = (ke = ''): boolean => {
      const tujuan = ke.trim() || nama;
      if (!tujuan) {
        if (o.mode === 'vim') kabari('E32: No file name (save with :w myfile.txt)', true);
        else tanyaNama();
        return false;
      }
      if (hanyaBaca && tujuan === nama) {
        kabari(o.mode === 'vim' ? 'E45: read-only file (save a copy: :w myfile.py)' : 'Read-only file: save it under a new name with ^S', true);
        if (o.mode === 'nano') tanyaNama();
        return false;
      }
      const isi = view.state.doc.toString();
      const g = o.simpan(isi, tujuan);
      if (g) {
        kabari(g, true);
        return false;
      }
      if (tujuan !== nama) {
        nama = tujuan;
        hanyaBaca = false;
        view.dispatch({ effects: bahasaKini.reconfigure(bahasa(nama)) });
      }
      tersimpan = isi;
      kabari(`"${nama}" ${isi.split('\n').length}L, ${new TextEncoder().encode(isi).length}B written`);
      judulnya();
      return true;
    };
    const keluar = (paksa = false) => {
      if (!paksa && view.state.doc.toString() !== tersimpan) {
        kabari(o.mode === 'vim' ? 'E37: No write since last change (add ! to override)' : 'Unsaved changes: ^S to save, or ^X again to discard', true);
        if (o.mode === 'nano') paksaNano = true;
        return;
      }
      // ditunda sebentar: perintah Vim (:q, :wq) masih memegang editornya
      // sampai selesai dijalankan, dan menghancurkannya di tengah jalan
      // membuat mode Vim membaca state yang sudah tidak ada
      setTimeout(() => {
        view.destroy();
        lapis.remove();
        selesai();
      }, 0);
    };
    let paksaNano = false;

    /** nano: "File Name to Write:" di bilah bawah, seperti nano sungguhan. */
    const tanyaNama = () => {
      const simpanBawah = [...bawah.childNodes];
      const label = document.createElement('label');
      label.className = 'term-editor-tanya';
      label.textContent = 'File Name to Write: ';
      const isian = document.createElement('input');
      isian.type = 'text';
      isian.value = hanyaBaca ? '' : nama;
      isian.spellcheck = false;
      isian.setAttribute('autocapitalize', 'off');
      label.append(isian);
      bawah.replaceChildren(label);
      const kembali = () => {
        bawah.replaceChildren(...simpanBawah);
        view.focus();
      };
      isian.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          const n = isian.value.trim();
          kembali();
          if (n) tulis(n);
        } else if (e.key === 'Escape' || (e.key === 'c' && e.ctrlKey)) {
          e.preventDefault();
          kembali();
          kabari('Cancelled');
        }
      });
      setTimeout(() => isian.focus(), 0);
    };

    // layar sambutan Neovim: tampil selama bufer baru masih kosong
    const sambutan = document.createElement('pre');
    sambutan.className = 'term-editor-sambutan';
    sambutan.textContent = [
      'NVIM v0.10 · Mats OS edition',
      '',
      'Neovim, in your browser',
      '',
      ...[
        ['press', 'i', 'to start typing'],
        ['press', 'Esc', 'to stop typing'],
        ['type', ':w file.py', 'to save'],
        ['type', ':wq', 'to save and quit'],
        ['type', ':q!', 'to quit without saving'],
      ].map(([a, b, c]) => `${a.padEnd(7)}${b.padEnd(13)}${c}`),
    ].join('\n');
    if (o.mode === 'vim' && !o.isi) badan.append(sambutan);

    const ext = [
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(warna),
      tema,
      bahasaKini.of(bahasa(nama)),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          paksaNano = false;
          sambutan.remove();
          judulnya();
        }
      }),
    ];
    if (o.mode === 'vim') {
      // vim() harus paling depan supaya tombolnya didahulukan
      ext.unshift(vim({ status: true }));
      ext.push(keymap.of([...defaultKeymap, ...historyKeymap]));
    } else {
      ext.push(
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => (tulis(), true) },
          { key: 'Ctrl-o', preventDefault: true, run: () => (tanyaNama(), true) },
          { key: 'Ctrl-x', preventDefault: true, run: () => (keluar(paksaNano), true) },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ])
      );
    }
    const view = new EditorView({ state: EditorState.create({ doc: o.isi, extensions: ext }), parent: badan });

    if (o.mode === 'vim') {
      // :w [nama], :q, :q!, :wq [nama], :x, :saveas nama — milik editor ini
      type Ex = { argString?: string; input?: string };
      Vim.defineEx('write', 'w', (_cm: unknown, p: Ex) => void tulis(p?.argString ?? ''));
      Vim.defineEx('quit', 'q', (_cm: unknown, p: Ex) => keluar(/!/.test(p?.input ?? '')));
      Vim.defineEx('wq', 'wq', (_cm: unknown, p: Ex) => tulis(p?.argString ?? '') && keluar(true));
      Vim.defineEx('xit', 'x', (_cm: unknown, p: Ex) => tulis(p?.argString ?? '') && keluar(true));
      Vim.defineEx('saveas', 'sav', (_cm: unknown, p: Ex) => void tulis(p?.argString ?? ''));
      bawah.innerHTML =
        '<span>i</span> insert <span>Esc</span> normal <span>:w name</span> save <span>:q</span> quit <span>:wq</span> save &amp; quit';
    } else {
      const tombol = (label: string, kunci: string, aksi: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span>${kunci}</span> ${label}`;
        b.addEventListener('click', () => {
          aksi();
          view.focus();
        });
        bawah.append(b);
      };
      tombol('Save', '^S', () => void tulis());
      tombol('Save as', '^O', tanyaNama);
      tombol('Exit', '^X', () => keluar(paksaNano));
    }
    judulnya();
    kabari(hanyaBaca ? 'read-only' : o.isi ? '' : nama ? 'new file' : '');
    setTimeout(() => view.focus(), 30);
  });
}
