import Phaser from 'phaser';

/**
 * Penghemat kerja per frame — supaya desa tetap mulus di ponsel.
 *
 * Desa berisi ±1.250 objek, dan di layar ponsel (zoom 2) yang kelihatan cuma
 * ±250. Phaser tidak memangkas objek di luar kamera: semuanya tetap dihitung
 * matriksnya dan dikirim ke GPU tiap frame. Terukur di CPU yang diperlambat
 * 4× (setara ponsel menengah), satu frame makan ±14 ms dari jatah 16,7 ms.
 */

/**
 * Batas gambar Graphics yang digambar di sekitar satu titik dunia. Graphics
 * tidak tahu ukuran isinya sendiri, jadi tanpa ini ia tidak pernah dipangkas.
 */
export function lingkupGambar(g: Phaser.GameObjects.Graphics, x: number, y: number, jari: number) {
  (g as Lingkup).lingkup = { x, y, jari };
  return g;
}

type Lingkup = Phaser.GameObjects.GameObject & { lingkup?: { x: number; y: number; jari: number } };

/** Jenis objek yang ukurannya bisa dibaca dari lebar × skala. */
const BERUKURAN = new Set(['Image', 'Sprite', 'Rectangle', 'Ellipse', 'Arc', 'Text', 'Triangle', 'Polygon', 'Star']);

/** Cara memangkas satu objek, dihitung sekali per objek. */
const enum Pangkas {
  /** Selalu digambar: ukurannya tidak diketahui (tilemap, container, …) atau menempel ke layar. */
  Selalu = 1,
  /** Dipangkas memakai lebar × skalanya. */
  Ukuran,
  /** Dipangkas memakai lingkupGambar(). */
  Lingkup,
  /** Tidak pernah digambar: kotak tabrakan tanpa isi dan garis. */
  Tidak,
}

type Dipangkas = Phaser.GameObjects.Image &
  Lingkup & { isFilled?: boolean; isStroked?: boolean; _scaleX: number; _scaleY: number; __pangkas?: Pangkas };

function caraPangkas(o: Dipangkas): Pangkas {
  if (o.type === 'Rectangle' && !o.isFilled && !o.isStroked) return Pangkas.Tidak;
  if (o.scrollFactorX !== 1 || o.scrollFactorY !== 1) return Pangkas.Selalu;
  if (o.lingkup) return Pangkas.Lingkup;
  return BERUKURAN.has(o.type) ? Pangkas.Ukuran : Pangkas.Selalu;
}

/**
 * Hanya gambar yang menyentuh kamera. Jari-jarinya sengaja longgar — lebar +
 * tinggi objek, cukup untuk titik pangkal (origin) dan putaran apa pun — jadi
 * tidak ada yang hilang di tepi layar; yang dipangkas memang jauh di luar.
 *
 * Kotak tabrakan (Rectangle tanpa isi dan garis) tidak pernah digambar:
 * dulu ±230 kotak kosong seperti itu tetap lewat pipeline grafis tiap frame
 * dan memecah batch gambar di sekitarnya.
 *
 * Jalannya tiap frame untuk seribu lebih objek, jadi ditulis sehemat
 * mungkin: jenis pangkasnya disimpan di objeknya, skala dibaca dari medan
 * mentahnya (bukan getter), dan larik hasilnya dipakai ulang.
 */
export function pasangPemangkasan(scene: Phaser.Scene) {
  const hasil: Phaser.GameObjects.GameObject[] = [];
  scene.cameras.getVisibleChildren = (children, camera) => {
    const v = camera.worldView;
    const cx = v.x + v.width / 2;
    const cy = v.y + v.height / 2;
    const sw = v.width / 2;
    const sh = v.height / 2;
    hasil.length = 0;
    for (let i = 0; i < children.length; i++) {
      const o = children[i] as Dipangkas;
      if (!o.willRender(camera)) continue;
      const cara = o.__pangkas ?? (o.__pangkas = caraPangkas(o));
      if (cara === Pangkas.Ukuran) {
        const r = Math.abs(o.width * o._scaleX) + Math.abs(o.height * o._scaleY);
        if (Math.abs(o.x - cx) > sw + r || Math.abs(o.y - cy) > sh + r) continue;
      } else if (cara === Pangkas.Lingkup) {
        const l = o.lingkup!;
        if (Math.abs(l.x + o.x - cx) > sw + l.jari || Math.abs(l.y + o.y - cy) > sh + l.jari) continue;
      } else if (cara === Pangkas.Tidak) {
        // bisa saja kelak diberi isi: periksa lagi, jangan dikunci selamanya
        if (o.isFilled || o.isStroked) o.__pangkas = undefined;
        continue;
      }
      hasil.push(o);
    }
    return hasil;
  };
}

/**
 * Mengatur kedalaman ke nilai yang SAMA tetap memesan pengurutan ulang
 * seluruh daftar tampilan di Phaser. Banyak benda desa menyetel
 * kedalamannya tiap frame (ikut posisi y-nya), jadi ±1.250 objek diurut
 * ulang tiap frame walau tidak ada yang berubah. Di sini setter-nya
 * dilewati kalau nilainya tidak berubah.
 */
export function pasangKedalamanHemat() {
  const G = Phaser.GameObjects;
  for (const kelas of [G.Image, G.Sprite, G.Rectangle, G.Ellipse, G.Arc, G.Graphics, G.Container, G.Text, G.RenderTexture, G.Zone]) {
    let proto: object | null = kelas.prototype;
    let d: PropertyDescriptor | undefined;
    while (proto && !(d = Object.getOwnPropertyDescriptor(proto, 'depth'))) proto = Object.getPrototypeOf(proto);
    if (!d?.set || !d.get || (d.set as { hemat?: true }).hemat) continue;
    const { get, set } = d;
    const hemat = function (this: { _depth: number }, nilai: number) {
      if (nilai === this._depth) return;
      set.call(this, nilai);
    };
    (hemat as { hemat?: true }).hemat = true;
    Object.defineProperty(kelas.prototype, 'depth', { get, set: hemat, configurable: true, enumerable: d.enumerable });
  }
}

/**
 * Urutan gambar desa: insertion sort, bukan StableSort bawaan Phaser.
 *
 * Kupu-kupu, hewan, dan warga yang bergerak memang berganti kedalaman hampir
 * tiap frame (kedalaman = garis kaki), jadi daftarnya harus diurut ulang
 * tiap frame. Tapi di antara dua frame yang bergeser cuma segelintir objek
 * sejauh satu dua tempat: daftarnya nyaris terurut. Insertion sort
 * menyelesaikan daftar seperti itu dalam satu lintasan (±1.250 perbandingan),
 * sementara StableSort tetap membelah dan menggabung seluruh daftar.
 * Sama stabilnya: objek berkedalaman sama tetap dalam urutan tambahnya.
 */
export function pasangUrutHemat(scene: Phaser.Scene) {
  const dl = scene.children;
  dl.depthSort = function (this: Phaser.GameObjects.DisplayList) {
    if (!this.sortChildrenFlag) return;
    const a = this.list as unknown as { _depth: number }[];
    for (let i = 1; i < a.length; i++) {
      const o = a[i];
      const d = o._depth;
      let j = i - 1;
      if (a[j]._depth <= d) continue;
      while (j >= 0 && a[j]._depth > d) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = o;
    }
    this.sortChildrenFlag = false;
  };
}

/**
 * Selama panel, peta, Setelan, terminal, atau obrolan terbuka, desanya
 * tertutup lapisan gelap 82% — tidak ada yang perlu digerakkan. Loop game
 * ditidurkan supaya tombol-tombol di panel mendapat seluruh waktu prosesor;
 * di ponsel inilah yang membuat Setelan terasa berat. Begitu semua lapisan
 * tertutup, loop-nya bangun lagi tanpa lompatan waktu.
 */
export function tidurSaatModal(game: Phaser.Game) {
  const modal = [...document.querySelectorAll<HTMLElement>('.modal')];
  if (!modal.length) return;
  const cek = () => {
    const ada = modal.some((m) => !m.hidden);
    const loop = game.loop;
    if (ada && loop.running) loop.sleep();
    else if (!ada && !loop.running) {
      loop.resetDelta();
      loop.wake();
    }
  };
  const amati = new MutationObserver(cek);
  for (const m of modal) amati.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  cek();
}
