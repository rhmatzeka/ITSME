/**
 * Warna piksel yang dibaca kembali dari kanvas, dirapikan dari derau.
 *
 * Brave (dan peramban lain yang melawan fingerprinting) sengaja mengacak
 * sedikit hasil getImageData: segelintir piksel bergeser satu-dua angka di
 * salah satu kanal warnanya, dengan pola yang berganti tiap sesi. Mata tidak
 * bisa membedakannya, tapi semua rupa warga di desa ini dibuat dengan
 * MENUKAR warna yang cocok persis (rambut pirang #f79617 → hitam, dan
 * seterusnya). Piksel yang teracak tidak cocok, jadi ia lolos dengan warna
 * aslinya: bintik oranye di rambut hitam Rahmat yang muncul "kadang-kadang".
 *
 * Perbaikannya di satu tempat: getImageData dibungkus, dan tiap warna langka
 * yang hampir sama (selisih ≤ 3 per kanal) dengan warna yang lebih sering
 * muncul dikembalikan ke warna itu. Hanya untuk gambar berpalet kecil — sprite
 * piksel. Gambar yang diperhalus (peta mini, foto) punya ribuan warna yang
 * memang berdekatan dan dibiarkan apa adanya.
 */

/** Gambar dengan lebih banyak warna dari ini bukan sprite piksel. */
const MAKS_WARNA = 512;
/** Selisih terbesar per kanal yang dianggap derau, bukan warna lain. */
const SELISIH = 3;

export function rapikanWarna(d: Uint8ClampedArray) {
  const hitung = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    hitung.set(k, (hitung.get(k) ?? 0) + 1);
    if (hitung.size > MAKS_WARNA) return;
  }
  if (hitung.size < 2) return;

  // dari yang paling sering: tiap warna menarik warna langka di dekatnya
  const urut = [...hitung.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const ganti = new Map<number, number>();
  for (let j = urut.length - 1; j > 0; j--) {
    const k = urut[j];
    for (let i = 0; i < j; i++) {
      const p = urut[i];
      if (
        Math.abs(((k >> 16) & 255) - ((p >> 16) & 255)) <= SELISIH &&
        Math.abs(((k >> 8) & 255) - ((p >> 8) & 255)) <= SELISIH &&
        Math.abs((k & 255) - (p & 255)) <= SELISIH
      ) {
        ganti.set(k, ganti.get(p) ?? p);
        break;
      }
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    // alpha ikut teracak: hampir pejal = pejal, hampir kosong = kosong
    if (a >= 255 - SELISIH) d[i + 3] = 255;
    else if (a <= SELISIH) {
      d[i + 3] = 0;
      continue;
    }
    if (!ganti.size) continue;
    const p = ganti.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (p === undefined) continue;
    d[i] = (p >> 16) & 255;
    d[i + 1] = (p >> 8) & 255;
    d[i + 2] = p & 255;
  }
}

/** Pasang sekali, sebelum tekstur apa pun dibuat. */
export function pasangPembersihWarna() {
  const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __bersih?: boolean };
  if (proto.__bersih) return;
  proto.__bersih = true;
  const asli = proto.getImageData;
  proto.getImageData = function (this: CanvasRenderingContext2D, ...a: Parameters<typeof asli>) {
    const data = asli.apply(this, a);
    rapikanWarna(data.data);
    return data;
  };
}
