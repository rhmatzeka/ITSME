/**
 * Sistem berkas shell di browser: pohon folder di memori, akarnya folder
 * rumah pengunjung (~ = /home/tamu). Tidak ada apa pun di luar akar itu —
 * jalur yang mencoba keluar ditolak, sama seperti di terminal server.
 *
 * Kuota: semua berkas yang ditulis pengunjung paling banyak 5 MB. Berkas
 * portfolio bawaan hanya-baca. Semuanya hilang saat terminal ditutup.
 */

export const KUOTA = 5 * 1024 * 1024;
export const RUMAH = '/home/tamu';

export interface Berkas {
  jenis: 'berkas';
  isi: string;
  hanyaBaca?: boolean;
  ubah: number;
}
export interface Folder {
  jenis: 'folder';
  anak: Map<string, Simpul>;
  hanyaBaca?: boolean;
  ubah: number;
}
export type Simpul = Berkas | Folder;

export class GalatFs extends Error {}

const byte = (s: string) => new TextEncoder().encode(s).length;

export class Fs {
  akar: Folder = { jenis: 'folder', anak: new Map(), ubah: Date.now() };
  /** Posisi sekarang, potongan jalur dari ~. */
  cwd: string[] = [];

  /** Jalur → potongan dari ~, atau null kalau keluar dari folder rumah. */
  urai(jalur: string, dari = this.cwd): string[] | null {
    let j = jalur || '.';
    if (j === RUMAH || j.startsWith(RUMAH + '/')) j = '~' + j.slice(RUMAH.length);
    else if (j.startsWith('/')) return null;
    const hasil = j === '~' || j.startsWith('~/') ? [] : [...dari];
    for (const p of j.replace(/^~\/?/, '').split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') {
        if (!hasil.length) return null;
        hasil.pop();
      } else hasil.push(p);
    }
    return hasil;
  }

  tampil(p: string[]) {
    return p.length ? `~/${p.join('/')}` : '~';
  }

  ambil(p: string[]): Simpul | null {
    let n: Simpul = this.akar;
    for (const bag of p) {
      if (n.jenis !== 'folder') return null;
      const s = n.anak.get(bag);
      if (!s) return null;
      n = s;
    }
    return n;
  }

  /** Simpul di `jalur`, atau galat yang terbaca seperti pesan shell. */
  cari(jalur: string, perintah: string): { p: string[]; n: Simpul } {
    const p = this.urai(jalur);
    if (!p) throw new GalatFs(`${perintah}: ${jalur}: Permission denied: you can only use your home folder (~)`);
    const n = this.ambil(p);
    if (!n) throw new GalatFs(`${perintah}: ${jalur}: No such file or directory`);
    return { p, n };
  }

  /** Folder induk tempat `jalur` akan dibuat. */
  induk(jalur: string, perintah: string): { f: Folder; nama: string; p: string[] } {
    const p = this.urai(jalur);
    if (!p || !p.length) throw new GalatFs(`${perintah}: ${jalur}: Permission denied: you can only use your home folder (~)`);
    const f = this.ambil(p.slice(0, -1));
    if (!f) throw new GalatFs(`${perintah}: ${jalur}: No such file or directory`);
    if (f.jenis !== 'folder') throw new GalatFs(`${perintah}: ${jalur}: Not a directory`);
    const nama = p[p.length - 1];
    if (!/^[\w.\-+@ ]{1,64}$/.test(nama)) throw new GalatFs(`${perintah}: ${nama}: Invalid file name`);
    return { f, nama, p };
  }

  /** Byte yang dipakai berkas-berkas milik pengunjung (bawaan tidak dihitung). */
  terpakai(n: Simpul = this.akar): number {
    if (n.jenis === 'berkas') return n.hanyaBaca ? 0 : byte(n.isi);
    let t = n.hanyaBaca ? 0 : 64;
    for (const a of n.anak.values()) t += this.terpakai(a);
    return t;
  }

  private cekKuota(tambah: number, perintah: string) {
    if (this.terpakai() + tambah > KUOTA) throw new GalatFs(`${perintah}: No space left on device (your home folder is limited to 5 MB)`);
  }

  private cekTulis(n: Simpul, jalur: string, perintah: string) {
    if (n.hanyaBaca) throw new GalatFs(`${perintah}: ${jalur}: Permission denied (read-only file)`);
  }

  tulis(jalur: string, isi: string, perintah: string, tambahkan = false) {
    const { f, nama } = this.induk(jalur, perintah);
    if (f.hanyaBaca) throw new GalatFs(`${perintah}: ${jalur}: Permission denied (read-only folder)`);
    const lama = f.anak.get(nama);
    if (lama?.jenis === 'folder') throw new GalatFs(`${perintah}: ${jalur}: Is a directory`);
    if (lama) this.cekTulis(lama, jalur, perintah);
    const baru = tambahkan && lama ? lama.isi + isi : isi;
    this.cekKuota(byte(baru) - (lama ? byte(lama.isi) : 0), perintah);
    f.anak.set(nama, { jenis: 'berkas', isi: baru, ubah: Date.now() });
  }

  mkdir(jalur: string, induk = false) {
    const p = this.urai(jalur);
    if (!p || !p.length) throw new GalatFs(`mkdir: ${jalur}: Permission denied: you can only use your home folder (~)`);
    let f: Folder = this.akar;
    for (let i = 0; i < p.length; i++) {
      const ada = f.anak.get(p[i]);
      const terakhir = i === p.length - 1;
      if (ada) {
        if (ada.jenis !== 'folder') throw new GalatFs(`mkdir: ${jalur}: Not a directory`);
        if (terakhir && !induk) throw new GalatFs(`mkdir: ${jalur}: File exists`);
        f = ada;
        continue;
      }
      if (!terakhir && !induk) throw new GalatFs(`mkdir: ${jalur}: No such file or directory`);
      if (f.hanyaBaca) throw new GalatFs(`mkdir: ${jalur}: Permission denied (read-only folder)`);
      if (!/^[\w.\-+@ ]{1,64}$/.test(p[i])) throw new GalatFs(`mkdir: ${p[i]}: Invalid file name`);
      this.cekKuota(64, 'mkdir');
      const baru: Folder = { jenis: 'folder', anak: new Map(), ubah: Date.now() };
      f.anak.set(p[i], baru);
      f = baru;
    }
  }

  private adaBawaan(n: Simpul): boolean {
    if (n.hanyaBaca) return true;
    return n.jenis === 'folder' && [...n.anak.values()].some((a) => this.adaBawaan(a));
  }

  rm(jalur: string, rekursif: boolean, perintah = 'rm') {
    const { p, n } = this.cari(jalur, perintah);
    if (!p.length) throw new GalatFs(`${perintah}: refusing to remove your home folder`);
    if (n.jenis === 'folder' && !rekursif) throw new GalatFs(`${perintah}: ${jalur}: Is a directory (use rm -r)`);
    if (this.adaBawaan(n)) throw new GalatFs(`${perintah}: ${jalur}: Permission denied (read-only)`);
    const f = this.ambil(p.slice(0, -1)) as Folder;
    f.anak.delete(p[p.length - 1]);
  }

  private salinan(n: Simpul): Simpul {
    if (n.jenis === 'berkas') return { jenis: 'berkas', isi: n.isi, ubah: Date.now() };
    return { jenis: 'folder', anak: new Map([...n.anak].map(([k, v]) => [k, this.salinan(v)])), ubah: Date.now() };
  }

  /** Salin atau pindahkan; tujuan boleh folder yang sudah ada (masuk ke dalamnya). */
  pindah(dari: string, ke: string, salin: boolean, rekursif: boolean) {
    const perintah = salin ? 'cp' : 'mv';
    const { p, n } = this.cari(dari, perintah);
    if (!p.length) throw new GalatFs(`${perintah}: cannot move your home folder`);
    if (n.jenis === 'folder' && salin && !rekursif) throw new GalatFs(`cp: -r not specified; omitting directory '${dari}'`);
    if (!salin && this.adaBawaan(n)) throw new GalatFs(`mv: ${dari}: Permission denied (read-only)`);
    const tujuan = this.urai(ke);
    if (!tujuan) throw new GalatFs(`${perintah}: ${ke}: Permission denied: you can only use your home folder (~)`);
    const t = this.ambil(tujuan);
    const jalurAkhir = t?.jenis === 'folder' ? [...tujuan, p[p.length - 1]] : tujuan;
    if (jalurAkhir.join('/').startsWith(p.join('/') + '/')) throw new GalatFs(`${perintah}: cannot move a folder into itself`);
    const baru = this.salinan(n);
    const tambah = this.terpakai(baru);
    this.cekKuota(salin ? tambah : 0, perintah);
    const { f, nama } = this.induk(this.tampil(jalurAkhir), perintah);
    if (f.hanyaBaca) throw new GalatFs(`${perintah}: ${ke}: Permission denied (read-only folder)`);
    const lama = f.anak.get(nama);
    if (lama?.hanyaBaca) throw new GalatFs(`${perintah}: ${ke}: Permission denied (read-only file)`);
    f.anak.set(nama, baru);
    if (!salin) (this.ambil(p.slice(0, -1)) as Folder).anak.delete(p[p.length - 1]);
  }

  /** Semua berkas di bawah folder p (untuk Python), jalur relatif dari ~. */
  semuaBerkas(p: string[] = [], n: Simpul = this.akar): [string, string][] {
    if (n.jenis === 'berkas') return [[p.join('/'), n.isi]];
    return [...n.anak].flatMap(([k, v]) => this.semuaBerkas([...p, k], v));
  }
}
