import Phaser from 'phaser';

/**
 * Menggambar spritesheet kecil dari "gambar teks": tiap frame berupa daftar
 * baris, tiap huruf satu piksel, dan `palet` memetakan huruf ke warna. Titik
 * (`.`) berarti kosong.
 *
 * Dipakai untuk penghuni kecil yang tidak punya aset — bebek, ikan, burung,
 * kucing. Sebagai teks, warnanya bisa diganti satu huruf dan bentuknya bisa
 * dibaca langsung di kode, tanpa harus membuka editor gambar.
 */
export function spritesheetTeks(
  scene: Phaser.Scene,
  key: string,
  frame: string[][],
  palet: Record<string, string>
) {
  if (scene.textures.exists(key)) return;
  const h = frame[0].length;
  const w = Math.max(...frame.flat().map((b) => b.length));
  const kanvas = scene.textures.createCanvas(key, w * frame.length, h)!;
  const ctx = kanvas.getContext();
  frame.forEach((baris, f) =>
    baris.forEach((isi, y) =>
      [...isi].forEach((c, x) => {
        if (c === '.' || c === ' ') return;
        ctx.fillStyle = palet[c] ?? '#ff00ff';
        ctx.fillRect(f * w + x, y, 1, 1);
      })
    )
  );
  for (let f = 0; f < frame.length; f++) kanvas.add(f, 0, f * w, 0, w, h);
  kanvas.refresh();
}

/**
 * Bayangan tanah di bawah kaki: elips piksel 12×4, pinggirnya lebih tipis.
 *
 * Dulu tiap orang memakai lembar `_shadow` bawaan asetnya — siluet badan
 * utuh yang mengikuti frame. Siluet itu bentuk karakter ASLINYA; begitu
 * rupanya diganti (Rahmat, warga baru) siluet lama menyembul di sekitar
 * badan barunya seperti bayangan orang lain. Elips di tanah tidak punya
 * bentuk badan, jadi cocok untuk rupa apa pun.
 *
 * Titik tengahnya diletakkan satu piksel di atas garis pijak, supaya
 * telapak kaki berdiri DI ATAS bayangannya, bukan di tepinya.
 */
export function bayanganKaki(scene: Phaser.Scene) {
  spritesheetTeks(
    scene,
    'bayangan_kaki',
    [['..oookkooo..', '.okkkkkkkko.', '.okkkkkkkko.', '..oookkooo..']],
    { k: '#1b2416', o: 'rgba(27,36,22,0.55)' }
  );
  return 'bayangan_kaki';
}

/** Kepekatan bayangan kaki di atas tanah. */
export const BAYANGAN_KAKI = 0.32;

/**
 * Salinan spritesheet dengan warna ditukar — cara yang sama dengan petani dan
 * pemuda di tools/aset-buatan.mjs: siluetnya identik dengan karakter utama,
 * jadi warga baru pasti satu keluarga gaya dengan penghuni desa lain.
 */
export function tukarWarna(
  scene: Phaser.Scene,
  sumber: string,
  key: string,
  tukar: Record<string, string>,
  frameW: number,
  frameH: number
) {
  if (scene.textures.exists(key) || !scene.textures.exists(sumber)) return;
  const img = scene.textures.get(sumber).getSourceImage() as HTMLImageElement;
  const kanvas = scene.textures.createCanvas(key, img.width, img.height)!;
  const ctx = kanvas.getContext();
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const peta = new Map<number, [number, number, number]>();
  for (const [dari, jadi] of Object.entries(tukar)) {
    const a = Phaser.Display.Color.HexStringToColor(dari);
    const b = Phaser.Display.Color.HexStringToColor(jadi);
    peta.set((a.red << 16) | (a.green << 8) | a.blue, [b.red, b.green, b.blue]);
  }
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const ganti = peta.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (ganti) [d[i], d[i + 1], d[i + 2]] = ganti;
  }
  ctx.putImageData(data, 0, 0);
  const kolom = Math.floor(img.width / frameW);
  const baris = Math.floor(img.height / frameH);
  for (let f = 0; f < kolom * baris; f++) {
    kanvas.add(f, 0, (f % kolom) * frameW, Math.floor(f / kolom) * frameH, frameW, frameH);
  }
  kanvas.refresh();
}

/**
 * Tekstur baru dari sepotong lembar aset (x, y, lebar, tinggi), dengan
 * warna yang boleh ditukar — pot bunga dari paket Pixel 16, keset dari
 * karpet Sprout Lands yang diwarnai cokelat sabut. `frame` > 1 membuat
 * beberapa salinan berdampingan yang bisa diubah `ubah(ctx, n)` — dipakai
 * untuk frame bunga yang condong ditiup angin.
 */
export function potongan(
  scene: Phaser.Scene,
  sumber: string,
  key: string,
  [sx, sy, w, h]: [number, number, number, number],
  tukar: Record<string, string> = {},
  frame = 1,
  ubah?: (ctx: CanvasRenderingContext2D, n: number) => void
) {
  const tx = scene.textures;
  if (tx.exists(key) || !tx.exists(sumber)) return;
  const img = tx.get(sumber).getSourceImage() as HTMLImageElement;
  const kanvas = tx.createCanvas(key, w * frame, h)!;
  const ctx = kanvas.getContext();
  const peta = new Map<number, [number, number, number]>();
  for (const [dari, jadi] of Object.entries(tukar)) {
    const a = Phaser.Display.Color.HexStringToColor(dari);
    const b = Phaser.Display.Color.HexStringToColor(jadi);
    peta.set((a.red << 16) | (a.green << 8) | a.blue, [b.red, b.green, b.blue]);
  }
  for (let n = 0; n < frame; n++) {
    const kerja = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    kerja.canvas.width = w;
    kerja.canvas.height = h;
    kerja.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    if (peta.size) {
      const data = kerja.getImageData(0, 0, w, h);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const ganti = d[i + 3] ? peta.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : undefined;
        if (ganti) [d[i], d[i + 1], d[i + 2]] = ganti;
      }
      kerja.putImageData(data, 0, 0);
    }
    ubah?.(kerja, n);
    ctx.drawImage(kerja.canvas, n * w, 0);
    kanvas.add(n, 0, n * w, 0, w, h);
  }
  kanvas.refresh();
}

/**
 * Grid tabrakan dari map.json (1 = terhalang), plus cari jalur BFS di atasnya.
 * Dipakai kurir (rute antar pintu) dan burung (mencari petak rumput kosong).
 */
export class Kisi {
  private sel: number[];

  /** Grid-nya disalin: halangi() tidak boleh mengubah data peta di cache. */
  constructor(
    readonly w: number,
    readonly h: number,
    sel: number[]
  ) {
    this.sel = sel.slice();
  }

  bebas(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && !this.sel[y * this.w + x];
  }

  /**
   * Tandai petak terhalang oleh benda yang dibuat kode, bukan tile peta —
   * supaya kurir memutarinya dan burung tidak hinggap di atasnya.
   */
  halangi(petak: [number, number][]) {
    for (const [x, y] of petak) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.sel[y * this.w + x] = 1;
  }

  /** Jalur petak demi petak dari a ke b (termasuk keduanya), atau null. */
  jalur(a: [number, number], b: [number, number]): [number, number][] | null {
    const W = this.w;
    const asal = new Int32Array(W * this.h).fill(-1);
    const mulai = a[1] * W + a[0];
    const tujuan = b[1] * W + b[0];
    asal[mulai] = mulai;
    const antre = [mulai];
    for (let k = 0; k < antre.length; k++) {
      const i = antre[k];
      if (i === tujuan) break;
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        const n = ny * W + nx;
        if (!this.bebas(nx, ny) || asal[n] !== -1) continue;
        asal[n] = i;
        antre.push(n);
      }
    }
    if (asal[tujuan] === -1) return null;
    const hasil: [number, number][] = [];
    for (let i = tujuan; ; i = asal[i]) {
      hasil.push([i % W, (i / W) | 0]);
      if (i === mulai) break;
    }
    return hasil.reverse();
  }
}

/**
 * Pose tidur dari satu frame berdiri: kakinya dilipat ke bawah badan dan
 * matanya terpejam — dibuat dari gambar aslinya, jadi ayam merah tidur
 * sebagai ayam merah yang sama, bukan gambar lain yang mirip.
 *
 * `kaki` = baris pertama bagian kaki, `buang` = berapa baris dilipat. Baris
 * di atas kaki diturunkan sebanyak itu, jadi perutnya duduk di tanah dan
 * ujung kaki yang tersisa terselip di bawahnya.
 *
 * Mata = piksel hitam pekat. Mata setinggi dua piksel tinggal garis
 * bawahnya (kelopak yang terpejam); mata sepiksel diredupkan ke warna di
 * sebelahnya. Frame kedua sama, badannya turun sepiksel: napas.
 */
export function buatTidur(
  scene: Phaser.Scene,
  sumber: string,
  key: string,
  fw: number,
  fh: number,
  frame: number,
  kaki: number,
  buang: number
) {
  const tx = scene.textures;
  if (tx.exists(key) || !tx.exists(sumber)) return;
  const img = tx.get(sumber).getSourceImage() as HTMLImageElement;
  const kolom = Math.floor(img.width / fw);
  const sx = (frame % kolom) * fw;
  const sy = Math.floor(frame / kolom) * fh;
  const kerja = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  kerja.canvas.width = fw;
  kerja.canvas.height = fh;
  kerja.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
  const asal = kerja.getImageData(0, 0, fw, fh).data;
  const kanvas = tx.createCanvas(key, fw * 2, fh)!;
  const ctx = kanvas.getContext();
  for (let f = 0; f < 2; f++) {
    const hasil = ctx.createImageData(fw, fh);
    const d = hasil.data;
    const salin = (dariY: number, keY: number) => {
      if (keY < 0 || keY >= fh) return;
      for (let x = 0; x < fw; x++) {
        const a = (dariY * fw + x) * 4;
        if (!asal[a + 3]) continue;
        const b = (keY * fw + x) * 4;
        d[b] = asal[a];
        d[b + 1] = asal[a + 1];
        d[b + 2] = asal[a + 2];
        d[b + 3] = asal[a + 3];
      }
    };
    // ujung kaki yang tersisa dulu, lalu badan di atasnya (badan menutupi kaki)
    for (let y = kaki + buang; y < fh; y++) salin(y, y);
    for (let y = kaki - 1; y >= 0; y--) salin(y, y + buang + (f && y < kaki - 3 ? 1 : 0));
    // pejamkan mata
    // (dicatat dulu semuanya: mengubah piksel sambil memeriksa tetangganya
    // membuat bagian bawah mata dua-piksel ikut terhapus)
    const mata = new Set<number>();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && Math.max(d[i], d[i + 1], d[i + 2]) < 20) mata.add(i);
    for (const i of mata) {
      const x = (i / 4) % fw;
      const kanan = x + 1 < fw && d[i + 7] && !mata.has(i + 4) ? i + 4 : i - 4;
      if (mata.has(i + fw * 4)) {
        d[i] = d[kanan];
        d[i + 1] = d[kanan + 1];
        d[i + 2] = d[kanan + 2];
      } else if (!mata.has(i - fw * 4)) {
        d[i] = (d[i] + d[kanan]) >> 1;
        d[i + 1] = (d[i + 1] + d[kanan + 1]) >> 1;
        d[i + 2] = (d[i + 2] + d[kanan + 2]) >> 1;
      }
    }
    ctx.putImageData(hasil, f * fw, 0);
    kanvas.add(f, 0, f * fw, 0, fw, fh);
  }
  kanvas.refresh();
}

/**
 * Panah kuning 11×11 penunjuk tempat masuk: dipakai pintu rumah (WorldScene)
 * dan kursi terminal (Teras). Garis tepi gelap tebal, kilau putih di kiri,
 * bayangan oranye tua di kanan, supaya terbaca di atas latar apa pun.
 */
export function pastikanPanahPintu(scene: Phaser.Scene) {
  if (scene.textures.exists('panah_pintu')) return;
  const gambar = [
    '...#####...',
    '...#wyo#...',
    '...#wyo#...',
    '...#wyo#...',
    '####wyo####',
    '#wwwwyyyyo#',
    '.#wwyyyyo#.',
    '..#wyyyo#..',
    '...#wyo#...',
    '....#o#....',
    '.....#.....',
  ];
  const warna: Record<string, string> = { '#': '#1b2416', w: '#fff7c2', y: '#ffd23f', o: '#d08a12' };
  const kanvas = scene.textures.createCanvas('panah_pintu', 11, 11)!;
  const ctx = kanvas.getContext();
  gambar.forEach((baris, y) =>
    [...baris].forEach((c, x) => {
      if (c === '.') return;
      ctx.fillStyle = warna[c];
      ctx.fillRect(x, y, 1, 1);
    })
  );
  kanvas.refresh();
}

const BARIS_ATAS = new Map<string, number>();
let kanvasBaca: CanvasRenderingContext2D | undefined;

/**
 * Baris piksel terisi paling atas pada frame yang sedang tampil — puncak
 * kepala sebuah karakter. Dibaca dengan satu getImageData per frame lalu
 * disimpan, jadi aman dipanggil tiap frame.
 */
export function barisAtas(s: Phaser.GameObjects.Sprite) {
  const kunci = `${s.texture.key}#${s.frame.name}`;
  const ada = BARIS_ATAS.get(kunci);
  if (ada !== undefined) return ada;
  const f = s.frame;
  const w = f.cutWidth;
  const h = f.cutHeight;
  let baris = 0;
  try {
    kanvasBaca ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const c = kanvasBaca;
    c.canvas.width = w;
    c.canvas.height = h;
    c.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
    const data = c.getImageData(0, 0, w, h).data;
    cari: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 0) {
          baris = y;
          break cari;
        }
      }
    }
  } catch {
    baris = Math.round(h * 0.4);
  }
  BARIS_ATAS.set(kunci, baris);
  return baris;
}
