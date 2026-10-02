import type Phaser from 'phaser';

/** Satu lembar animasi untuk kepala panel: frame berjajar mendatar. */
export interface Potret {
  url: string;
  /** Ukuran satu frame, px gambar. */
  w: number;
  h: number;
  /** Jumlah frame dan lama satu putaran, detik. */
  n: number;
  lama: number;
}

type Lapis = { key: string; frame: number };

/**
 * Siapa yang tampil di kepala tiap panel, disusun dari tekstur game yang
 * sama dengan yang ada di desa: Rahmat di rumahnya, piala berkilap di rumah
 * CV, Rahmat mengetik di bengkel Projects, pedagang melambai di kios, dan
 * kurir yang berjalan di kantor pos.
 */
function resep(tx: Phaser.Textures.TextureManager): Record<string, { frame: Lapis[][]; fps: number }> {
  const deret = (key: string, urut: number[]) => urut.map((frame) => [{ key, frame }]);
  // piala diam cukup lama, lalu seberkas kilap menyapunya
  const kilap = tx.exists('piala_kilap') ? tx.get('piala_kilap').frameTotal - 1 : 0;
  const piala: Lapis[][] = [
    ...Array.from({ length: 22 }, () => [{ key: 'piala', frame: 0 }]),
    ...Array.from({ length: kilap }, (_, f) => [
      { key: 'piala', frame: 0 },
      { key: 'piala_kilap', frame: f },
    ]),
  ];
  return {
    about: { frame: deret('rahmat', [0, 1, 2, 3]), fps: 4 },
    cv: { frame: piala, fps: 22 },
    projects: { frame: deret('rahmat_kerja', [0, 1, 0, 1, 0, 1, 2, 2, 2, 0, 1, 0, 1, 2, 2]), fps: 7 },
    stack: { frame: [...deret('pedagang', [0, 1, 2, 3]), ...deret('pedagang_lambai', [0, 1, 0, 1])], fps: 4 },
    contact: { frame: deret('kurir', [16, 17, 18, 19]), fps: 8 },
  };
}

const simpanan = new Map<string, Potret | null>();

/**
 * Lembar animasi kecil untuk kepala panel `slug`, sebagai gambar yang bisa
 * dipakai CSS.
 *
 * Harus berupa gambar DOM, bukan sprite Phaser: selama panel terbuka loop
 * game ditidurkan (lihat tidurSaatModal), jadi apa pun yang digerakkan game
 * ikut berhenti. Animasi CSS berjalan sendiri. Tiap frame dipotong ke kotak
 * terkecil yang memuat gambarnya di semua frame, supaya ruang kosong di
 * sekeliling sprite 32×32 tidak ikut memakan tempat.
 */
export function potretPanel(game: Phaser.Game, slug: string): Potret | null {
  if (simpanan.has(slug)) return simpanan.get(slug)!;
  const tx = game.textures;
  const r = resep(tx)[slug];
  const lengkap = r?.frame.length && r.frame.every((f) => f.every((l) => tx.exists(l.key) && tx.get(l.key).has(String(l.frame))));
  if (!r || !lengkap) {
    simpanan.set(slug, null);
    return null;
  }
  const ukuran = r.frame.flat().map((l) => tx.getFrame(l.key, l.frame));
  const W = Math.max(...ukuran.map((f) => f.cutWidth));
  const H = Math.max(...ukuran.map((f) => f.cutHeight));
  const n = r.frame.length;

  const lembar = document.createElement('canvas');
  lembar.width = W * n;
  lembar.height = H;
  const ctx = lembar.getContext('2d', { willReadFrequently: true })!;
  r.frame.forEach((lapis, i) => {
    for (const l of lapis) {
      const f = tx.getFrame(l.key, l.frame);
      // berpijak di dasar tengah, sama seperti benda aslinya di desa
      ctx.drawImage(
        f.source.image as CanvasImageSource,
        f.cutX, f.cutY, f.cutWidth, f.cutHeight,
        i * W + Math.floor((W - f.cutWidth) / 2), H - f.cutHeight, f.cutWidth, f.cutHeight
      );
    }
  });

  // kotak terkecil yang memuat isi semua frame
  const data = ctx.getImageData(0, 0, W * n, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W * n; x++) {
      if (data[(y * W * n + x) * 4 + 3] === 0) continue;
      const lx = x % W;
      if (lx < x0) x0 = lx;
      if (lx > x1) x1 = lx;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) {
    simpanan.set(slug, null);
    return null;
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const hasil = document.createElement('canvas');
  hasil.width = w * n;
  hasil.height = h;
  const c2 = hasil.getContext('2d')!;
  for (let i = 0; i < n; i++) c2.drawImage(lembar, i * W + x0, y0, w, h, i * w, 0, w, h);

  const potret = { url: hasil.toDataURL(), w, h, n, lama: n / r.fps };
  simpanan.set(slug, potret);
  return potret;
}
