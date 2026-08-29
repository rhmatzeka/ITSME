/**
 * build-map.mjs — Tiled → web pipeline
 *
 * Menelusuri rantai yang sama dengan yang Tiled pakai:
 *
 *   map.tmx  ──►  daftar .tsx  ──►  <image source>  ──►  PNG sumber
 *
 * lalu:
 *   1. kumpulkan GID yang benar-benar terpakai di semua layer
 *   2. potong tile-nya dari PNG sumber
 *   3. susun jadi SATU atlas, tiap tile di-extrude 1px (anti garis jahitan)
 *   4. konversi map infinite (chunk) → finite
 *   5. tulis Tiled JSON dengan GID yang sudah dipetakan ulang
 *
 * Kamu tidak perlu menyentuh PNG-nya manual. Edit map di Tiled seperti biasa,
 * lalu jalankan `npm run build:map`.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(ROOT, '..', 'mapporto');
const MAP_TMX = path.join(SRC_DIR, 'map.tmx');
const OUT_DIR = path.join(ROOT, 'public', 'assets');

const EXTRUDE = 1; // px digandakan di tiap sisi tile

// Tiled menyimpan flag flip/rotate di 4 bit teratas GID.
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const HEX120 = 0x10000000;
const GID_MASK = 0x0fffffff;
const FLAG_MASK = FLIP_H | FLIP_V | FLIP_D | HEX120;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['tileset', 'layer', 'objectgroup', 'chunk', 'object', 'property'].includes(name),
});

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v) => (v == null ? undefined : Number(v));
const log = (...a) => console.log(...a);

/* ------------------------------------------------------------------ */
/* 1. baca map.tmx + resolve tiap .tsx ke PNG-nya                       */
/* ------------------------------------------------------------------ */

async function loadTilesets(mapXml, mapDir) {
  const out = [];

  for (const ts of asArray(mapXml.tileset)) {
    const firstgid = num(ts['@_firstgid']);
    let def = ts;
    let baseDir = mapDir;

    // <tileset source="Foo.tsx"/> → tileset eksternal, harus dibuka
    if (ts['@_source']) {
      const tsxPath = path.resolve(mapDir, ts['@_source']);
      if (!existsSync(tsxPath)) throw new Error(`Tileset tidak ditemukan: ${tsxPath}`);
      const parsed = parser.parse(await readFile(tsxPath, 'utf8'));
      // isArray membuat <tileset> selalu jadi array, termasuk root sebuah .tsx
      def = asArray(parsed.tileset)[0];
      baseDir = path.dirname(tsxPath); // path gambar relatif ke .tsx, bukan ke .tmx
    }

    const image = asArray(def.image)[0];
    if (!image) {
      log(`  ! ${ts['@_source'] ?? def['@_name']} — tileset tanpa <image>, dilewati`);
      continue;
    }

    const imagePath = path.resolve(baseDir, image['@_source']);
    if (!existsSync(imagePath)) throw new Error(`PNG tidak ditemukan: ${imagePath}`);

    out.push({
      firstgid,
      name: def['@_name'],
      tileWidth: num(def['@_tilewidth']),
      tileHeight: num(def['@_tileheight']),
      columns: num(def['@_columns']),
      tileCount: num(def['@_tilecount']),
      margin: num(def['@_margin']) ?? 0,
      spacing: num(def['@_spacing']) ?? 0,
      imagePath,
      imageWidth: num(image['@_width']),
      imageHeight: num(image['@_height']),
    });
  }

  out.sort((a, b) => a.firstgid - b.firstgid);
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. baca layer — infinite (chunk) maupun finite                       */
/* ------------------------------------------------------------------ */

function parseCsv(text) {
  const out = [];
  for (const part of String(text).split(',')) {
    const t = part.trim();
    if (t) out.push(Number(t) >>> 0);
  }
  return out;
}

/**
 * Kembalikan { cells: Map<"x,y", gid>, minX, minY, maxX, maxY } per layer.
 * Map infinite disimpan sebagai chunk bertitik nol arbitrer (bisa negatif);
 * kita kumpulkan sel non-kosong saja lalu hitung batasnya.
 */
function readLayer(layer) {
  const data = asArray(layer.data)[0];
  if (!data) return null;

  const encoding = data['@_encoding'];
  if (encoding && encoding !== 'csv') {
    throw new Error(
      `Layer "${layer['@_name']}" pakai encoding "${encoding}". ` +
        `Di Tiled: Map → Map Properties → Tile Layer Format → CSV, lalu simpan ulang.`
    );
  }

  const cells = new Map();
  const chunks = asArray(data.chunk);

  if (chunks.length) {
    for (const ch of chunks) {
      const cx = num(ch['@_x']);
      const cy = num(ch['@_y']);
      const cw = num(ch['@_width']);
      const vals = parseCsv(ch['#text']);
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] === 0) continue;
        cells.set(`${cx + (i % cw)},${cy + Math.floor(i / cw)}`, vals[i]);
      }
    }
  } else {
    const w = num(layer['@_width']);
    const vals = parseCsv(data['#text']);
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === 0) continue;
      cells.set(`${i % w},${Math.floor(i / w)}`, vals[i]);
    }
  }

  return {
    id: num(layer['@_id']),
    name: layer['@_name'],
    opacity: layer['@_opacity'] != null ? Number(layer['@_opacity']) : 1,
    visible: layer['@_visible'] !== '0',
    cells,
  };
}

/* ------------------------------------------------------------------ */
/* 3. atlas: potong tile terpakai, extrude, susun                       */
/* ------------------------------------------------------------------ */

async function buildAtlas(tilesets, usedByTileset, tileW, tileH) {
  // urutan stabil: per tileset (firstgid naik), lalu localId naik
  const entries = [];
  for (let i = 0; i < tilesets.length; i++) {
    const ids = usedByTileset.get(i);
    if (!ids) continue;
    for (const localId of [...ids].sort((a, b) => a - b)) entries.push({ tsIndex: i, localId });
  }

  const count = entries.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = tileW + EXTRUDE * 2;
  const cellH = tileH + EXTRUDE * 2;
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;

  const atlas = Buffer.alloc(atlasW * atlasH * 4, 0);

  // muat tiap PNG sumber sekali saja sebagai raw RGBA
  const sources = new Map();
  for (const { tsIndex } of entries) {
    if (sources.has(tsIndex)) continue;
    const ts = tilesets[tsIndex];
    const { data, info } = await sharp(ts.imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    sources.set(tsIndex, { data, width: info.width, height: info.height });
  }

  const mapping = new Map(); // "tsIndex:localId" → index di atlas
  const stats = []; // per index atlas: { tileset, coverage, r, g, b }

  entries.forEach(({ tsIndex, localId }, idx) => {
    const ts = tilesets[tsIndex];
    const src = sources.get(tsIndex);

    const sx = ts.margin + (localId % ts.columns) * (ts.tileWidth + ts.spacing);
    const sy = ts.margin + Math.floor(localId / ts.columns) * (ts.tileHeight + ts.spacing);

    const dx = (idx % cols) * cellW + EXTRUDE;
    const dy = Math.floor(idx / cols) * cellH + EXTRUDE;

    // ambil satu piksel dari sumber, dengan clamp supaya tile di tepi tetap aman
    const px = (x, y) => {
      const cx = Math.min(Math.max(x, 0), src.width - 1);
      const cy = Math.min(Math.max(y, 0), src.height - 1);
      return (cy * src.width + cx) * 4;
    };

    // salin tile + extrude: rentang -1..tileW dibaca dengan clamp,
    // jadi baris/kolom tepi otomatis tergandakan ke luar
    for (let y = -EXTRUDE; y < tileH + EXTRUDE; y++) {
      for (let x = -EXTRUDE; x < tileW + EXTRUDE; x++) {
        const sIdx = px(sx + Math.min(Math.max(x, 0), tileW - 1), sy + Math.min(Math.max(y, 0), tileH - 1));
        const dIdx = ((dy + y) * atlasW + (dx + x)) * 4;
        atlas[dIdx] = src.data[sIdx];
        atlas[dIdx + 1] = src.data[sIdx + 1];
        atlas[dIdx + 2] = src.data[sIdx + 2];
        atlas[dIdx + 3] = src.data[sIdx + 3];
      }
    }

    // statistik untuk menebak tile mana yang menghalangi jalan
    let opaque = 0, sr = 0, sg = 0, sb = 0;
    const opaquePx = [];
    for (let y = 0; y < tileH; y++) {
      for (let x = 0; x < tileW; x++) {
        const i = px(sx + x, sy + y);
        if (src.data[i + 3] > 128) {
          opaque++;
          sr += src.data[i]; sg += src.data[i + 1]; sb += src.data[i + 2];
          opaquePx.push(i);
        }
      }
    }
    // fraksi piksel "biru air" — jauh lebih andal daripada warna rata-rata,
    // karena tile tepi sungai separuhnya rumput dan tanah
    let bluePx = 0;
    for (const i of opaquePx) {
      if (src.data[i + 2] > src.data[i] + 30 && src.data[i + 2] > src.data[i + 1] + 15) bluePx++;
    }
    // titik berat vertikal piksel: benda yang TERGELETAK di tanah (bunga, batu
    // kecil, batang kayu, genangan) titik beratnya di bawah; benda yang
    // MENGGANTUNG (lengan lampu, dahan) di atas. Ini yang membedakan
    // "diinjak" dari "dilewati di bawahnya".
    let cySum = 0;
    for (const i of opaquePx) cySum += Math.floor(i / 4 / src.width);
    const cy = opaque ? (cySum / opaque - Math.floor(sy)) / tileH : 0.5;

    const mr = opaque ? sr / opaque : 0, mg = opaque ? sg / opaque : 0, mb = opaque ? sb / opaque : 0;
    // stddev warna: tile isian polos (rumput, tanah) mendekati 0;
    // rintangan (pohon, pagar, atap) punya garis tepi & bayangan → jauh lebih tinggi
    let vr = 0, vg = 0, vb = 0;
    for (const i of opaquePx) {
      vr += (src.data[i] - mr) ** 2;
      vg += (src.data[i + 1] - mg) ** 2;
      vb += (src.data[i + 2] - mb) ** 2;
    }
    const sd = opaque
      ? (Math.sqrt(vr / opaque) + Math.sqrt(vg / opaque) + Math.sqrt(vb / opaque)) / 3
      : 0;

    stats.push({
      tileset: ts.name,
      srcId: localId,
      key: `${ts.name}:${localId}`,
      coverage: opaque / (tileW * tileH),
      blueFrac: bluePx / (tileW * tileH),
      cy,
      sd,
      r: mr, g: mg, b: mb,
    });

    mapping.set(`${tsIndex}:${localId}`, idx);
  });

  const png = await sharp(atlas, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  return { png, raw: atlas, mapping, stats, cols, rows, count, atlasW, atlasH };
}

/* ------------------------------------------------------------------ */
/* 4. auto-collision — tebakan awal, sampai kamu gambar layer di Tiled  */
/* ------------------------------------------------------------------ */

/**
 * Aturannya sederhana dan bisa dijelaskan:
 *   - layer dasar  : hanya air yang menghalangi (biru dominan, tile penuh)
 *   - layer atasnya: menghalangi kalau tile-nya terisi >60% piksel buram.
 *                    Pohon, rumah, pagar, bangku memenuhi tile-nya;
 *                    bunga, kerikil, rumput kecil tidak.
 *   - jembatan     : selalu bisa dilewati, menimpa aturan air di bawahnya.
 *
 * Begitu layer `collisions` ada di map.tmx, ini otomatis diabaikan.
 */
/**
 * Pengecualian yang tidak bisa ditebak dari piksel. Kuncinya
 * "namaTileset:idLokal" — stabil walau atlas disusun ulang saat map berubah.
 * Jalankan dengan DUMP_TILES=1 untuk melihat daftar kunci tiap tile.
 */
const ids = (tileset, list) => Object.fromEntries(list.map((i) => [`${tileset}:${i}`, 'halangi']));

/**
 * Klasifikasi eksplisit untuk tile yang tidak bisa ditebak dari piksel.
 *
 * Tiga nilai:
 *   'halangi' — menahan langkah
 *   'lewat'   — diinjak: bisa dilewati DAN digambar di bawah karakter
 *   'atas'    — dilewati di bawahnya: tidak menahan, tapi digambar di atas
 *               karakter (lengan lampu, dahan yang menjulur)
 * Kunci "namaTileset:idLokal" stabil walau atlas disusun ulang saat map berubah.
 * Jalankan `DUMP_TILES=1 node tools/build-map.mjs` untuk melihat kunci tiap tile.
 *
 * Heuristik saja tidak cukup: tiang pagar cuma mengisi 35% tile, sudut pagar
 * taman separuhnya rumput, dan bagian bawah rumah setinggi setengah tile —
 * semuanya lolos ambang kepadatan padahal jelas menghalangi.
 */
const OVERRIDE = {
  // Tangga kayu selebar 3 tile yang menembus pagar taman. Sama padatnya dengan
  // pagar di kiri-kanannya, tapi justru inilah satu-satunya jalan naik ke bukit.
  'free_pixel_16_woods:225': 'lewat',
  'free_pixel_16_woods:226': 'lewat',
  'free_pixel_16_woods:227': 'lewat',

  // Tileset "Wood Bridge" dipakai untuk dua benda berbeda: papan jembatan
  // yang melintang di sungai (id 0/5/10) dan panel pagar tegak di tepi kiri
  // peta (id 2/3/4). Menyamaratakan seluruh tileset membuat pagarnya ikut
  // bisa diinjak.
  'Wood Bridge:0': 'lewat',
  'Wood Bridge:5': 'lewat',
  'Wood Bridge:10': 'lewat',
  'Wood Bridge:2': 'halangi',
  'Wood Bridge:3': 'halangi',
  'Wood Bridge:4': 'halangi',

  // --- yang harus menghalangi tapi lolos heuristik ---
  // Lengan lampu jalan menggantung setinggi kepala: boleh dilewati, tapi tetap
  // digambar DI ATAS karakter. Yang menahan langkah cuma tiangnya (id 61).
  'Pixel 16 v2 village free:44': 'atas',
  'Pixel 16 v2 village free:45': 'atas',
  'Pixel 16 v2 village free:61': 'atas', // tiangnya juga — lorongnya cuma 1 tile
  // bangku, tiang lampu, pot, peti
  ...ids('Pixel 16 v2 village free', [30, 31, 78, 98]),
  // batang & tunggul pohon
  ...ids('Maple Tree', [25, 26, 27]),
  // sudut pagar taman — tiga sel inilah celah masuk ke bukit tanpa lewat tangga
  ...ids('free_pixel_16_woods', [
    58, 134, 136, 159,
    // tebing bukit, batang & rimbun pohon yang cuma mengisi separuh tile
    83, 86, 106, 171, 172, 173, 174, 199, 203, 222,
  ]),
  // seluruh tileset pagar: tiangnya tipis (cov 0.35) tapi tetap pagar
  ...ids("Fence's copiar", [0, 1, 2, 3, 5, 6, 8]),
  // dinding, atap, dan pinggiran rumah yang setinggi setengah tile
  ...ids('Premium Pack', [
    60766, 60902, 62024, 62163, 62303, 64967, 130343, 130344, 130345,
    130486, 61046, 61183, 61184, 61185, 62445, 65102, 65106,
  ]),
  // batu besar, patung, pohon mati (batang kayu kecil TIDAK termasuk —
  // itu tergeletak di tanah dan boleh diinjak)
  ...ids('GRASS+', [315, 333, 334]),
};

function computeCollision(jsonLayers, stats, width, height) {
  const SOLID = 0.6;    // tile terisi segini dianggap bangunan/pohon/pagar
  const WATER = 0.25;   // fraksi piksel biru yang bikin tile dihitung air

  const isFlatFill = (t) => t.coverage > 0.99 && t.sd < 5;

  const N = width * height;
  const grid = new Uint8Array(N);
  const free = new Uint8Array(N); // jembatan & override 'lewat' selalu menang
  const air = new Uint8Array(N);             // sel yang terhalang karena air
  const decor = new Uint8Array(N);           // sel berisi dekorasi tanah
  const decorTs = new Array(N).fill(null);   // tileset dekorasi itu
  const solidTs = new Array(N).fill(null);   // tileset tile padat di sel itu

  jsonLayers.forEach((l, li) => {
    const isBase = li === 0;
    for (let i = 0; i < l.data.length; i++) {
      const gid = l.data[i] & GID_MASK;
      if (!gid) continue;
      const t = stats[gid - 1];
      if (!t) continue;
      // Tile yang praktis tidak menggambar apa-apa (bayangan tipis, sisa
      // potongan) bukan rintangan dan bukan dekorasi. Tanpa penjaga ini,
      // titik beratnya jatuh ke nilai bawaan 0.5 sehingga terhitung dekorasi
      // tanah, lalu ikut tersedot aturan ketetanggaan dan memblokir
      // sekeliling rumah.
      if (t.coverage < 0.08) continue;

      const ov = OVERRIDE[t.key];
      if (ov === 'lewat' || ov === 'atas') { free[i] = 1; continue; }
      if (ov === 'halangi') { grid[i] = 1; solidTs[i] = t.tileset; continue; }

      if (isBase) {
        // Di layer dasar hanya air yang menghalangi. Tepi sungai separuhnya
        // rumput, jadi yang dihitung fraksi piksel birunya — bukan rata-rata.
        if (t.blueFrac >= WATER) { grid[i] = 1; air[i] = 1; }
      } else if (isGroundDecor(t)) {
        decor[i] = 1;
        decorTs[i] = t.tileset;
      } else if (!isFlatFill(t) && t.coverage > SOLID) {
        grid[i] = 1;
        solidTs[i] = t.tileset;
      }
    }
  });

  /*
   * Tepi kanopi pohon dan atap gerai terlihat seperti dekorasi kalau dinilai
   * per tile: isinya kurang dari separuh dan titik beratnya di bawah. Tapi dia
   * bagian dari struktur yang sama dengan tile padat di sebelahnya.
   *
   * Satu lintasan: sel dekorasi yang bersentuhan (8 arah) dengan sel padat
   * DARI TILESET YANG SAMA ikut jadi padat. Syarat tileset sama itu yang
   * mencegah bunga di samping tembok ikut terblokir.
   */
  const jadiPadat = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!decor[i] || grid[i] || free[i]) continue;
      for (let dy = -1; dy <= 1 && !jadiPadat.includes(i); dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (grid[j] && solidTs[j] && solidTs[j] === decorTs[i]) { jadiPadat.push(i); break; }
        }
      }
    }
  }
  for (const i of jadiPadat) grid[i] = 1;

  for (let i = 0; i < N; i++) if (free[i]) grid[i] = 0;

  return hanyaAlas(grid, air, width, height);
}

/**
 * Benda hanya menahan langkah di ALASNYA, bukan sepanjang tinggi gambarnya.
 *
 * Pohon, rumah, gerai, dan bangku digambar setinggi beberapa tile, tapi yang
 * benar-benar menempati tanah cuma baris paling bawah. Memblokir seluruh
 * bentuknya membuat pemain tidak bisa lewat di belakangnya — padahal itu
 * justru yang bikin dunia terasa punya kedalaman.
 *
 * Yang TIDAK diperlakukan begini: dinding dan pagar. Bedanya diukur dari
 * bentuk gugusnya — benda itu gumpalan padat yang muat di kotak kecil,
 * sedangkan pagar dan tebing memanjang atau berongga.
 */
function hanyaAlas(grid, air, width, height) {
  const N = width * height;
  const sudah = new Uint8Array(N);
  const hasil = Uint8Array.from(grid);

  for (let i0 = 0; i0 < N; i0++) {
    // Air bukan benda dan tidak boleh menyatu dengan bangunan di tepinya:
    // rumah yang membelakangi sungai akan terbaca sebagai satu gugus raksasa
    // lalu luput dari aturan ini.
    if (!grid[i0] || sudah[i0] || air[i0]) continue;

    // kumpulkan satu gugus yang tersambung
    const gugus = [];
    const antre = [i0];
    sudah[i0] = 1;
    while (antre.length) {
      const i = antre.pop();
      gugus.push(i);
      const x = i % width, y = (i / width) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (grid[j] && !sudah[j] && !air[j]) { sudah[j] = 1; antre.push(j); }
      }
    }

    const xs = gugus.map((i) => i % width);
    const ys = gugus.map((i) => (i / width) | 0);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;
    const kepadatan = gugus.length / (w * h);

    // gumpalan kecil & padat = benda; sisanya dinding/pagar, biarkan utuh
    const benda = w <= 8 && h <= 8 && h >= 2 && kepadatan >= 0.55;
    if (!benda) continue;

    // sisakan hanya sel terbawah di tiap kolom
    const terbawah = new Map();
    for (const i of gugus) {
      const x = i % width, y = (i / width) | 0;
      if (!terbawah.has(x) || y > terbawah.get(x)) terbawah.set(x, y);
    }
    for (const i of gugus) {
      const x = i % width, y = (i / width) | 0;
      if (y !== terbawah.get(x)) hasil[i] = 0;
    }
  }
  return hasil;
}

/**
 * Benda kecil yang tergeletak di tanah: bunga, jamur, batu kecil, genangan,
 * batang kayu. Boleh diinjak, dan harus digambar DI BAWAH karakter.
 * Pembedanya titik berat vertikal — benda yang menggantung seperti lengan
 * lampu punya titik berat di atas dan tidak masuk kategori ini.
 */
function isGroundDecor(t) {
  const ov = OVERRIDE[t.key];
  return t.coverage < 0.55 && t.cy > 0.42 && ov !== 'halangi' && ov !== 'atas';
}

/**
 * Benda tipis yang menggantung di atas kepala — lengan lampu, dahan.
 * Tidak menghalangi jalan, tapi tetap digambar di atas karakter.
 */
function isOverhead(t) {
  return t.coverage < 0.55 && t.cy <= 0.42;
}

/* ------------------------------------------------------------------ */
/* 5. render peta: minimap tajam + peta besar yang bisa diklik          */
/* ------------------------------------------------------------------ */

/**
 * Minimap dari kamera kedua Phaser selalu buram: dunia 624×528 diperkecil
 * ke ~130px dengan nearest-neighbour menghasilkan derau, bukan gambar.
 * Solusinya render sekali di sini — versi penuh untuk peta besar, dan versi
 * kecil yang diperkecil dengan rata-rata area sehingga tetap bersih.
 */
async function renderMaps(jsonLayers, atlasRaw, atlasW, cols, tileW, tileH, width, height) {
  const outW = width * tileW;
  const outH = height * tileH;
  const buf = Buffer.alloc(outW * outH * 4, 0);

  for (const l of jsonLayers) {
    for (let i = 0; i < l.data.length; i++) {
      const gid = l.data[i] & GID_MASK;
      if (!gid) continue;
      const id = gid - 1;
      const sx = EXTRUDE + (id % cols) * (tileW + EXTRUDE * 2);
      const sy = EXTRUDE + Math.floor(id / cols) * (tileH + EXTRUDE * 2);
      const tx = (i % width) * tileW;
      const ty = Math.floor(i / width) * tileH;
      for (let y = 0; y < tileH; y++) {
        for (let x = 0; x < tileW; x++) {
          const sp = ((sy + y) * atlasW + (sx + x)) * 4;
          const a = atlasRaw[sp + 3];
          if (!a) continue;
          const dp = ((ty + y) * outW + (tx + x)) * 4;
          const k = a / 255;
          buf[dp] = atlasRaw[sp] * k + buf[dp] * (1 - k);
          buf[dp + 1] = atlasRaw[sp + 1] * k + buf[dp + 1] * (1 - k);
          buf[dp + 2] = atlasRaw[sp + 2] * k + buf[dp + 2] * (1 - k);
          buf[dp + 3] = 255;
        }
      }
    }
  }

  const full = await sharp(buf, { raw: { width: outW, height: outH, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // 4 px per tile: cukup terbaca sebagai peta, cukup kecil untuk tetap tajam
  // flatten dulu: lanczos pada piksel transparan menyisakan halo di tepi,
  // yang terlihat sebagai garis kotor di pinggir minimap
  /*
   * Minimap dibangun sebagai SKEMA, bukan gambar yang diperkecil.
   *
   * Memampatkan tile 16 px jadi 3–4 px dengan penyaring apa pun pasti kabur:
   * detail sebanyak itu tidak muat, dan lanczos meratakannya jadi bubur.
   * Di sini tiap tile diringkas jadi satu warna rata-rata, lalu dilukis
   * sebagai balok pejal. Hasilnya bertepi tajam dan langsung terbaca —
   * jalan, sungai, dan bangunan tampil sebagai bidang warna yang jelas.
   */
  const skema = (px) => {
    const w = width * px;
    const h = height * px;
    const out = Buffer.alloc(w * h * 4);
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        let r = 0, g = 0, bl = 0, n = 0;
        for (let y = 0; y < tileH; y++) {
          for (let x = 0; x < tileW; x++) {
            const i = ((ty * tileH + y) * outW + (tx * tileW + x)) * 4;
            if (buf[i + 3] < 128) continue;
            r += buf[i]; g += buf[i + 1]; bl += buf[i + 2]; n++;
          }
        }
        // tile kosong memakai warna rumput supaya tidak jadi lubang hitam
        const cr = n ? (r / n) | 0 : 74;
        const cg = n ? (g / n) | 0 : 138;
        const cb = n ? (bl / n) | 0 : 63;
        for (let y = 0; y < px; y++) {
          for (let x = 0; x < px; x++) {
            const o = ((ty * px + y) * w + (tx * px + x)) * 4;
            out[o] = cr; out[o + 1] = cg; out[o + 2] = cb; out[o + 3] = 255;
          }
        }
      }
    }
    return sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  };

  const mini = await skema(4);   // desktop, sudut kiri bawah
  const miniSm = await skema(3); // layar sentuh, sudut kanan atas

  return {
    full, mini, miniSm,
    fullW: outW, fullH: outH,
    miniW: width * 4, miniH: height * 4,
    miniSmW: width * 3, miniSmH: height * 3,
  };
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  log('\n  Desa Mapporto — build map\n');

  if (!existsSync(MAP_TMX)) {
    // Vercel dengan Root Directory = "web" tidak menyertakan ../mapporto ke
    // konteks build. Aset hasil pipeline ikut ter-commit justru untuk kasus
    // ini, jadi build tetap bisa lanjut memakai aset itu.
    const punyaAset = existsSync(path.join(OUT_DIR, 'map.json')) && existsSync(path.join(OUT_DIR, 'atlas.png'));
    if (punyaAset) {
      log(`  ! ${path.relative(ROOT, MAP_TMX)} tidak ada — memakai aset yang sudah ter-commit di public/assets.`);
      log(`    Ini normal saat deploy. Di lokal, artinya folder mapporto/ hilang.\n`);
      return;
    }
    throw new Error(
      `map.tmx tidak ditemukan di ${MAP_TMX}, dan public/assets juga kosong.\n\n` +
        `  Pipeline membaca ../mapporto, di luar folder web/. Jalankan\n` +
        `  \`npm run build:map\` dari klona yang lengkap lalu commit hasilnya.`
    );
  }


  const mapXml = parser.parse(await readFile(MAP_TMX, 'utf8')).map;
  const tileW = num(mapXml['@_tilewidth']);
  const tileH = num(mapXml['@_tileheight']);
  const infinite = mapXml['@_infinite'] === '1';

  const tilesets = await loadTilesets(mapXml, SRC_DIR);
  log(`  ${tilesets.length} tileset di-resolve ke PNG:`);
  for (const ts of tilesets) {
    log(`    ${ts.name.padEnd(26)} ${String(ts.imageWidth).padStart(5)}×${String(ts.imageHeight).padEnd(6)} ${path.relative(SRC_DIR, ts.imagePath)}`);
  }

  // ---- layer ----
  const layers = asArray(mapXml.layer).map(readLayer).filter(Boolean);
  if (!layers.length) throw new Error('Tidak ada tile layer di map.tmx');

  // ---- batas map: hanya dari sel yang terisi ----
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of layers) {
    for (const key of l.cells.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) throw new Error('Semua layer kosong');

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  log(`\n  map ${infinite ? '(infinite → finite)' : '(finite)'}: ${width}×${height} tile, origin digeser (${minX}, ${minY})`);

  // ---- GID terpakai, dikelompokkan per tileset ----
  const tsIndexOf = (gid) => {
    for (let i = tilesets.length - 1; i >= 0; i--) if (gid >= tilesets[i].firstgid) return i;
    return -1;
  };

  const usedByTileset = new Map();
  let placements = 0;
  for (const l of layers) {
    for (const raw of l.cells.values()) {
      const gid = raw & GID_MASK;
      if (!gid) continue;
      const i = tsIndexOf(gid);
      if (i < 0) throw new Error(`GID ${gid} tidak cocok dengan tileset mana pun`);
      if (!usedByTileset.has(i)) usedByTileset.set(i, new Set());
      usedByTileset.get(i).add(gid - tilesets[i].firstgid);
      placements++;
    }
  }

  log('\n  tile terpakai:');
  let totalUnique = 0;
  for (const [i, ids] of [...usedByTileset].sort((a, b) => b[1].size - a[1].size)) {
    log(`    ${tilesets[i].name.padEnd(26)} ${String(ids.size).padStart(4)} unik  / ${tilesets[i].tileCount} tersedia`);
    totalUnique += ids.size;
  }
  log(`    ${'TOTAL'.padEnd(26)} ${String(totalUnique).padStart(4)} unik  / ${placements} penempatan`);

  // ---- atlas ----
  const atlas = await buildAtlas(tilesets, usedByTileset, tileW, tileH);
  if (process.env.DUMP_TILES) {
    atlas.stats.forEach((t, i) =>
      log(`    #${String(i + 1).padStart(3)}  ${t.key.padEnd(30)} cov=${t.coverage.toFixed(2)} biru=${t.blueFrac.toFixed(2)} sd=${t.sd.toFixed(1)}`)
    );
  }
  log(`\n  atlas: ${atlas.cols}×${atlas.rows} tile → ${atlas.atlasW}×${atlas.atlasH} px, ${(atlas.png.length / 1024).toFixed(1)} KB`);

  // ---- tulis ulang layer dengan GID baru ----
  const remap = (raw) => {
    const gid = raw & GID_MASK;
    if (!gid) return 0;
    const flags = raw & FLAG_MASK;
    const i = tsIndexOf(gid);
    const newIndex = atlas.mapping.get(`${i}:${gid - tilesets[i].firstgid}`);
    return ((newIndex + 1) | flags) >>> 0; // firstgid atlas = 1
  };

  const jsonLayers = layers.map((l, i) => {
    const data = new Array(width * height).fill(0);
    for (const [key, raw] of l.cells) {
      const [x, y] = key.split(',').map(Number);
      data[(y - minY) * width + (x - minX)] = remap(raw);
    }
    return {
      id: l.id ?? i + 1,
      name: l.name,
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
      opacity: l.opacity,
      visible: l.visible,
      data,
    };
  });

  // ---- auto-collision ----
  const hasCollisionLayer = asArray(mapXml.objectgroup).some((og) => og['@_name'] === 'collisions');
  const collision = computeCollision(jsonLayers, atlas.stats, width, height);
  const blocked = collision.reduce((a, b) => a + b, 0);
  log(
    `\n  auto-collision: ${blocked} tile terhalang (${((blocked / collision.length) * 100).toFixed(0)}% dari map)` +
      (hasCollisionLayer ? ' — diabaikan, layer "collisions" sudah ada di map.tmx' : '')
  );

  // ---- pisahkan permukaan yang diinjak ke layer tersendiri ----
  // Jembatan, tangga, dan rumput isian taman digambar di layer overlay, yang
  // berada DI ATAS pemain. Akibatnya pemain terlihat berjalan di bawah jembatan.
  // Tile semacam itu dipindah ke layer "lantai" yang ditaruh di bawah pemain.
  // "boleh dilewati" tidak sama dengan "diinjak". Lengan lampu boleh dilewati
  // tapi menggantung di atas kepala, jadi tetap digambar di layer atas.
  // "boleh dilewati" tidak sama dengan "diinjak": yang bertanda 'atas'
  // menggantung di atas kepala dan harus tetap digambar menutupi karakter.
  const isFloorTile = (t) =>
    // Apa pun yang ditandai 'lewat' berarti diinjak, termasuk papan jembatan.
    // Ujung jembatan isinya kurang dari separuh tile dengan titik berat
    // tinggi, jadi uji "menggantung" akan salah menebaknya kalau tidak
    // dilewati lebih dulu oleh penanda ini.
    OVERRIDE[t.key] === 'lewat' ||
    (OVERRIDE[t.key] !== 'atas' &&
      !isOverhead(t) &&
      ((t.coverage > 0.99 && t.sd < 5) || isGroundDecor(t)));

  const floorData = new Array(width * height).fill(0);
  let floorCount = 0;
  for (const l of jsonLayers.slice(1)) {
    for (let i = 0; i < l.data.length; i++) {
      const gid = l.data[i] & GID_MASK;
      if (!gid) continue;
      const t = atlas.stats[gid - 1];
      // sel yang menghalangi tidak boleh pindah ke bawah pemain — kalau tidak,
      // karakter terlihat berdiri di atas atap gerai atau pucuk pohon
      if (!t || !isFloorTile(t) || collision[i]) continue;
      floorData[i] = l.data[i];
      l.data[i] = 0;
      floorCount++;
    }
  }
  if (floorCount) {
    jsonLayers.splice(1, 0, {
      id: 900,
      name: 'lantai',
      type: 'tilelayer',
      x: 0, y: 0, width, height,
      opacity: 1, visible: true,
      data: floorData,
    });
    log(`  lantai : ${floorCount} tile dipindah ke bawah pemain (jembatan, tangga, rumput taman)`);
  }

  /* ---- benda padat dipisah supaya bisa diurut per-y ----
   *
   * Versi sebelumnya menaikkan SEMUA tile yang menghalangi ke atas karakter,
   * dengan alasan "kalau sesuatu menahan langkah, dia ada di depan". Itu benar
   * untuk dinding di SELATAN karakter, dan salah untuk yang di UTARA-nya.
   *
   * Karakter yang merapat ke tanggul taman dari bawah berhenti dengan 7px
   * teratas gambarnya berada di dalam tile tanggul. Tile itu digambar
   * belakangan, jadi kepalanya hilang. Satu lapisan tidak mungkin benar untuk
   * kedua sisi sekaligus.
   *
   * Jadi tile padat dikeluarkan ke layernya sendiri, dan WorldScene
   * menggambarnya satu per satu dengan kedalaman = tepi bawah tile-nya —
   * aturan yang sama persis yang dipakai karakter dan sapi. Yang dasarnya
   * lebih dekat ke kamera menang, tanpa perlu ada yang dinaikkan.
   *
   * Dua wadah karena ada 13 sel yang tile padatnya bertumpuk dua.
   */
  const wadahPadat = ['padat', 'padat 2'].map((name, i) => ({
    id: 910 + i,
    name,
    type: 'tilelayer',
    x: 0, y: 0, width, height,
    opacity: 1, visible: true,
    data: new Array(width * height).fill(0),
  }));
  let dipisah = 0;
  for (const l of jsonLayers) {
    // Tile Layer 1 adalah tanah dasar: air dan jurang memang menghalangi, tapi
    // tidak pernah ada karakter di depan atau di belakangnya.
    if (l.name === 'Tile Layer 1') continue;
    for (let i = 0; i < l.data.length; i++) {
      if (!l.data[i] || !collision[i]) continue;
      const muat = wadahPadat.find((w) => !w.data[i]);
      if (!muat) continue;
      muat.data[i] = l.data[i];
      l.data[i] = 0;
      dipisah++;
    }
  }
  jsonLayers.push(...wadahPadat.filter((w) => w.data.some(Boolean)));
  if (dipisah) log(`  depth  : ${dipisah} tile padat dipisah ke layer terurut-y`);

  // ---- object layer ikut dibawa, koordinatnya digeser mengikuti crop ----
  const offsetX = minX * tileW;
  const offsetY = minY * tileH;
  const objectLayers = asArray(mapXml.objectgroup).map((og, i) => ({
    id: num(og['@_id']) ?? 1000 + i,
    name: og['@_name'],
    type: 'objectgroup',
    draworder: 'topdown',
    opacity: og['@_opacity'] != null ? Number(og['@_opacity']) : 1,
    visible: og['@_visible'] !== '0',
    x: 0,
    y: 0,
    objects: asArray(og.object).map((o) => {
      const props = {};
      for (const p of asArray(asArray(o.properties)[0]?.property)) {
        props[p['@_name']] = p['@_value'] ?? p['#text'] ?? '';
      }
      return {
        id: num(o['@_id']),
        name: o['@_name'] ?? '',
        type: o['@_type'] ?? o['@_class'] ?? '',
        x: (num(o['@_x']) ?? 0) - offsetX,
        y: (num(o['@_y']) ?? 0) - offsetY,
        width: num(o['@_width']) ?? 0,
        height: num(o['@_height']) ?? 0,
        rotation: num(o['@_rotation']) ?? 0,
        visible: o['@_visible'] !== '0',
        point: o.point !== undefined,
        properties: Object.entries(props).map(([name, value]) => ({ name, type: 'string', value })),
      };
    }),
  }));

  if (objectLayers.length) {
    log(`\n  object layer: ${objectLayers.map((o) => `${o.name} (${o.objects.length})`).join(', ')}`);
  } else {
    log(`\n  ! belum ada object layer di map.tmx — collision & POI pakai fallback di src/game/poi.ts`);
  }

  const out = {
    compressionlevel: -1,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.12.1',
    width,
    height,
    tilewidth: tileW,
    tileheight: tileH,
    nextlayerid: jsonLayers.length + objectLayers.length + 1,
    nextobjectid: 1,
    layers: [...jsonLayers, ...objectLayers],
    tilesets: [
      {
        firstgid: 1,
        name: 'atlas',
        image: 'atlas.png',
        imagewidth: atlas.atlasW,
        imageheight: atlas.atlasH,
        columns: atlas.cols,
        tilecount: atlas.cols * atlas.rows,
        tilewidth: tileW,
        tileheight: tileH,
        margin: EXTRUDE,
        spacing: EXTRUDE * 2,
      },
    ],
    // tebakan collision; game memakainya hanya kalau layer `collisions` belum ada
    autoCollision: hasCollisionLayer ? null : Array.from(collision),
    // dipakai game untuk tahu pergeseran origin terhadap koordinat Tiled asli
    properties: [
      { name: 'srcOriginX', type: 'int', value: minX },
      { name: 'srcOriginY', type: 'int', value: minY },
    ],
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'atlas.png'), atlas.png);
  await writeFile(path.join(OUT_DIR, 'map.json'), JSON.stringify(out));

  // ---- render peta untuk minimap & peta besar ----
  const maps = await renderMaps(
    jsonLayers, atlas.raw, atlas.atlasW, atlas.cols, tileW, tileH, width, height
  );
  await writeFile(path.join(OUT_DIR, 'map_full.png'), maps.full);
  await writeFile(path.join(OUT_DIR, 'map_mini.png'), maps.mini);
  await writeFile(path.join(OUT_DIR, 'map_mini_sm.png'), maps.miniSm);
  log(
    `  peta   : map_full ${maps.fullW}×${maps.fullH}` +
      `, map_mini ${maps.miniW}×${maps.miniH}` +
      `, map_mini_sm ${maps.miniSmW}×${maps.miniSmH}`
  );

  // ---- sprite: karakter + efek petir, disalin apa adanya ----
  const SPRITES = [
    ['RPG Top Down Characters - Free Version/Blonde Man/blonde_man.png', 'blonde_man.png'],
    ['RPG Top Down Characters - Free Version/Blonde Man/blonde_man_shadow.png', 'blonde_man_shadow.png'],
    ['RPG Top Down Characters - Free Version/Blue Haired Woman/blue_haired_woman.png', 'blue_haired_woman.png'],
    ['RPG Top Down Characters - Free Version/Blue Haired Woman/blue_haired_woman_shadow.png', 'blue_haired_woman_shadow.png'],
    ['Thunder Effect 02/Thunder Strike/Thunderstrike w blur.png', 'thunderstrike.png'],
    ['Thunder Effect 02/Thunder Splash/Thunder splash wo blur.png', 'thunder_splash.png'],
    // joystick virtual — cincin luar + knob + dua tombol aksi
    ['Virtual Joystick V2/Joystick_Virtual.png', 'joy_base.png'],
    ['Virtual Joystick V2/HandleFilled2.png', 'joy_knob.png'],
    // penghuni kandang
    ['Farm RPG FREE 16x16 - Tiny Asset Pack/Farm RPG FREE 16x16 - Tiny Asset Pack/Farm Animals/Male Cow Brown.png', 'sapi_jantan.png'],
    ['Farm RPG FREE 16x16 - Tiny Asset Pack/Farm RPG FREE 16x16 - Tiny Asset Pack/Farm Animals/Female Cow Brown.png', 'sapi_betina.png'],
  ];
  const spriteDir = path.join(OUT_DIR, 'sprites');
  await mkdir(spriteDir, { recursive: true });
  let spriteBytes = 0;
  for (const [from, to] of SPRITES) {
    const src = path.join(SRC_DIR, from);
    if (!existsSync(src)) { log(`  ! sprite hilang: ${from}`); continue; }
    const buf = await sharp(src).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(spriteDir, to), buf);
    spriteBytes += buf.length;
  }
  log(`  sprite: ${SPRITES.length} file → ${(spriteBytes / 1024).toFixed(1)} KB`);

  /*
   * ---- cap versi ----
   *
   * Nama berkas di /assets tidak pernah berubah: atlas.png tetap atlas.png
   * walaupun isinya baru. Browser yang pernah menyimpannya akan memakai salinan
   * lamanya sampai masa berlaku habis — dan pada satu titik masa berlakunya
   * pernah disetel satu tahun. Akibatnya peta yang diperbarui tidak sampai ke
   * pengunjung lama, dan tidak ada cara memaksanya dari sisi server.
   *
   * Karena itu URL-nya yang dibuat berubah: sidik isi seluruh aset ditulis ke
   * src/game/versi.ts, lalu ditempelkan sebagai ?v= saat dimuat. Isi berubah =
   * URL berubah = tidak ada salinan lama yang bisa dipakai. Bundel JS-nya
   * sendiri sudah diberi hash oleh Astro, jadi cap ini selalu ikut terbawa.
   */
  const berkasAset = [];
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith('.png') || f.endsWith('.json')) berkasAset.push(path.join(OUT_DIR, f));
  }
  for (const f of await readdir(spriteDir)) berkasAset.push(path.join(spriteDir, f));
  berkasAset.sort();
  const sidik = createHash('sha1');
  for (const f of berkasAset) sidik.update(await readFile(f));
  const versi = sidik.digest('hex').slice(0, 10);
  await writeFile(
    path.join(ROOT, 'src', 'game', 'versi.ts'),
    `// Dibuat otomatis oleh tools/build-map.mjs. Jangan diedit tangan.\n` +
      `// Sidik isi seluruh berkas di public/assets — lihat komentar di pipeline.\n` +
      `export const VERSI = '${versi}';\n`
  );
  log(`  versi  : ${versi} (dari ${berkasAset.length} berkas aset)`);

  const jsonKB = Buffer.byteLength(JSON.stringify(out)) / 1024;
  log(`\n  ✓ public/assets/atlas.png   ${(atlas.png.length / 1024).toFixed(1)} KB`);
  log(`  ✓ public/assets/map.json   ${jsonKB.toFixed(1)} KB\n`);
}

main().catch((err) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
