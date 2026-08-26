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

import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const OVERRIDE = {
  // Tangga kayu selebar 3 tile yang menembus pagar taman. Piksel-nya sama
  // padatnya dengan pagar di kiri-kanannya, tapi justru inilah satu-satunya
  // jalan masuk ke kedua taman berpagar — di (7..9,11) dan (26..28,11).
  'free_pixel_16_woods:225': 'lewat',
  'free_pixel_16_woods:226': 'lewat',
  'free_pixel_16_woods:227': 'lewat',
};

function computeCollision(jsonLayers, stats, width, height) {
  const SOLID = 0.6;      // tile terisi segini dianggap bangunan/pohon
  const CONTINUE = 0.3;   // ambang lebih rendah untuk sambungan ke bawah
  const WATER = 0.25;     // fraksi piksel biru yang bikin tile dihitung air

  const isFlatFill = (t) => t.coverage > 0.99 && t.sd < 5;
  const isBridge = (t) => t.tileset === 'Wood Bridge';

  const N = width * height;
  const solid = new Uint8Array(N);   // dari aturan utama
  const grid = new Uint8Array(N);
  const free = new Uint8Array(N);    // jembatan & override 'lewat' menang

  const cover = new Float32Array(N); // coverage overlay tertinggi per sel

  jsonLayers.forEach((l, li) => {
    const isBase = li === 0;
    for (let i = 0; i < l.data.length; i++) {
      const gid = l.data[i] & GID_MASK;
      if (!gid) continue;
      const t = stats[gid - 1];
      if (!t) continue;

      const ov = OVERRIDE[t.key];
      if (ov === 'lewat' || isBridge(t)) { free[i] = 1; continue; }
      if (ov === 'halangi') { solid[i] = 1; continue; }

      if (isBase) {
        // Di layer dasar hanya air yang menghalangi. Tepi sungai separuhnya
        // rumput, jadi yang dihitung fraksi piksel birunya — bukan rata-rata.
        if (t.blueFrac >= WATER) solid[i] = 1;
      } else {
        if (!isFlatFill(t)) {
          if (t.coverage > SOLID) solid[i] = 1;
          cover[i] = Math.max(cover[i], t.coverage);
        }
      }
    }
  });

  grid.set(solid);

  // Sambungan ke bawah: bagian bawah rumah dan pagar sering cuma setengah tile
  // (coverage ~0.5) sehingga lolos ambang utama. Kalau tile tepat di atasnya
  // sudah padat dan tile ini masih cukup terisi, dia bagian dari bangunan yang sama.
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (grid[i] || free[i]) continue;
      if (grid[i - width] && cover[i] >= CONTINUE) grid[i] = 1;
    }
  }

  for (let i = 0; i < N; i++) if (free[i]) grid[i] = 0;
  return grid;
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
  const mini = await sharp(buf, { raw: { width: outW, height: outH, channels: 4 } })
    .resize(width * 4, height * 4, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { full, mini, fullW: outW, fullH: outH, miniW: width * 4, miniH: height * 4 };
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  log('\n  Desa Mapporto — build map\n');

  if (!existsSync(MAP_TMX)) throw new Error(`map.tmx tidak ditemukan di ${MAP_TMX}`);

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
  log(
    `  peta   : map_full ${maps.fullW}×${maps.fullH} (${(maps.full.length / 1024).toFixed(1)} KB)` +
      `, map_mini ${maps.miniW}×${maps.miniH} (${(maps.mini.length / 1024).toFixed(1)} KB)`
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
    ['Virtual Joystick V2/Joystick_Button_A.png', 'joy_a.png'],
    ['Virtual Joystick V2/Joystick_Button_B.png', 'joy_b.png'],
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

  const jsonKB = Buffer.byteLength(JSON.stringify(out)) / 1024;
  log(`\n  ✓ public/assets/atlas.png   ${(atlas.png.length / 1024).toFixed(1)} KB`);
  log(`  ✓ public/assets/map.json   ${jsonKB.toFixed(1)} KB\n`);
}

main().catch((err) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
