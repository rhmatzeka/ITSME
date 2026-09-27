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
 * Grid tabrakan dari map.json (1 = terhalang), plus cari jalur BFS di atasnya.
 * Dipakai kurir (rute antar pintu) dan burung (mencari petak rumput kosong).
 */
export class Kisi {
  constructor(
    readonly w: number,
    readonly h: number,
    private sel: number[]
  ) {}

  bebas(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && !this.sel[y * this.w + x];
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
