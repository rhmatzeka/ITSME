# Desa Mapporto — Rencana Teknis

Portfolio berbentuk game pixel 2D yang dibangun dari map Tiled `mapporto/map.tmx`.
Alur: loading → layar judul → spawn petir → jelajahi desa → masuk ke 9 titik singgah.

- **Sumber map**: `mapporto/` (project Tiled, tidak ikut di-deploy)
- **Target first load**: ~380 KB gzip
- **Estimasi**: 13–20 hari kerja santai, 8 fase

---

## 0. Yang perlu dipahami dulu: `.tsx` vs `.png`

File `.tsx` di folder `mapporto/` **bukan** TypeScript/React, dan **tidak menyimpan gambar**.
Itu Tiled TileSet XML — rata-rata ~280 byte, isinya cuma penunjuk:

```xml
<!-- Premium Pack.tsx — INI SELURUH ISINYA, 287 byte -->
<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" name="Premium Pack" tilewidth="16" tileheight="16"
         tilecount="131180" columns="140">
  <image source="Farm RPG FREE 16x16 - Tiny Asset Pack/Premium Pack.png"
         width="2250" height="15000"/>
</tileset>
```

Alurnya: **Tiled buka `.tsx` → baca baris `<image source>` → buka PNG → itu yang ditampilkan.**

Panel Project di Tiled hanya menampilkan file yang bisa dibuka sebagai dokumen Tiled
(`.tmx` dan `.tsx`). Makanya PNG tidak kelihatan di sana — padahal ada **109 file PNG**
di dalam subfolder. Cek sendiri: pilih tab tileset → panel Properties → baris **Image**.

Konsekuensinya untuk web: browser tidak bisa membaca `.tsx`. Yang di-upload ke GPU
tetap PNG-nya. Jadi semua batasan ukuran gambar di bawah tetap berlaku.

**Tapi cara kerjamu di Tiled tidak berubah sama sekali.** Script build justru membaca
`.tsx` persis seperti Tiled melakukannya.

---

## 1. Kondisi map sekarang

Hasil pembacaan langsung `map.tmx` + 27 berkas tileset.

### 1.1 Penghambat — `Premium Pack.png` tidak akan tampil di HP

`2250 × 15000 px`. Batas ukuran tekstur WebGL di banyak HP ada di 4096 px, sebagian
di 8192 px. Kalau di-load apa adanya, tileset gagal upload ke GPU dan sebagian map jadi
kosong — bukan error yang kelihatan, tile-nya hilang diam-diam.

Dari 131.180 tile di dalamnya, map cuma pakai **73**.

### 1.2 Peluang — seluruh map muat dalam satu atlas 256×256

Gabungan semua layer cuma memakai **252 tile unik** dari 8 tileset:

| Tileset | Tile unik | Total penempatan |
|---|---:|---:|
| Premium Pack | 73 | 73 |
| free_pixel_16_woods | 71 | 461 |
| Pixel 16 v2 village free | 40 | 311 |
| Tileset Spring | 20 | 858 |
| GRASS+ | 20 | 48 |
| Maple Tree | 14 | 52 |
| Fence's copiar | 8 | 20 |
| Wood Bridge | 6 | 24 |
| **Total** | **252** | **1.847** |

252 tile pas dalam grid 16×16. Jadi: 8 gambar → 1 gambar, ~20 MB → ~40 KB.

### 1.3 Belum ada object layer

`nextobjectid="1"` — belum ada satu pun object. Ini pekerjaan manual di Tiled yang
memblokir semua logika game: collision, titik spawn, dan 9 POI. Skema di bagian 4.

### 1.4 Dua hal kecil

- Map masih mode **infinite** (chunk-based). Phaser tidak membaca chunk — harus diubah
  ke finite sebelum ekspor.
- `blonde_man.png` terdaftar sebagai tileset 16×16, padahal frame aslinya **32×32**
  (grid 4 kolom × 8 baris = 32 frame). Karakter bukan tileset — itu spritesheet,
  jalur load-nya beda.

---

## 2. Tech stack

Kriteria: enteng, output statis, cepat dikoding & dirawat, dan bisa baca format Tiled.

| Bagian | Pilihan | Bobot | Alasan |
|---|---|---:|---|
| Meta-framework | **Astro** (`output: 'static'`) | ~0 KB | Zero-JS by default. Konten jadi Content Collections. Di atas Vite, jadi semua tooling di bawah tetap jalan. |
| Game engine | **Phaser 3** | ~280 KB | Satu-satunya engine JS yang baca Tiled JSON langsung. Loader punya event progress, ada arcade physics + kamera kedua untuk minimap. |
| Bahasa | **TypeScript** | 0 KB | Data POI & konten bertipe. Salah ketik `id` ketahuan sebelum runtime. |
| Konten | **Content Collections + Zod** | 0 KB | Tiap projek = satu file `.md`. Nambah projek tidak nyentuh kode. |
| Styling UI | **Tailwind v4** | ~8 KB | Iterasi cepat untuk panel & menu. Token pixel-art didefinisikan sekali di `@theme`. |
| Font | **Silkscreen / Press Start 2P** | ~15 KB | Subset latin. Di-load di Boot scene supaya loading bar tidak sempat pakai font fallback. |
| Hosting | **Cloudflare Pages / Vercel** | — | Statis murni, gratis, domain sendiri. |

### 2.1 Kenapa Astro, bukan Vite polos

Alasan utamanya bukan "Astro modern", tapi ini: **game tidak terbaca mesin pencari,
dan tidak ramah orang yang buru-buru.** Semua konten terkubur di dalam `<canvas>`.

Astro memberi dua lapisan dari satu sumber Markdown yang sama:

| | Lapisan game | Lapisan statis |
|---|---|---|
| URL | `/` | `/projects/[slug]`, `/cv`, `/about` |
| Isi | Phaser, desa bisa dijelajahi | HTML biasa, load instan, zero JS |
| Untuk | Yang mau menikmati | Google + rekruter yang punya 30 detik |

Ditambah: Content Collections (maintenance), `astro:assets` + sharp (sudah ikut Astro,
kepakai juga oleh script build map), dan file-based routing.

### 2.2 Yang dipertimbangkan tapi tidak dipakai

| Alternatif | Status | Kenapa |
|---|---|---|
| Vite polos + TS | lewat | Sama saja tapi kehilangan lapisan statis & Content Collections. |
| Next.js | tidak perlu | Berat untuk site yang 100% statis. Astro lebih pas untuk content-first. |
| PixiJS | lewat | Lebih ringan ~150 KB, tapi tilemap, collision, kamera ditulis sendiri. Hemat 130 KB, bayar dua minggu kerja. |
| Kaplay | lewat | Ringan & enak, tapi dukungan Tiled manual. Kamu sudah investasi besar di Tiled. |
| React | tidak perlu | Tidak ada state kompleks. Kalau nanti kurang, Preact 4 KB cukup. |
| Godot → web | lewat | Bundle WASM 20–40 MB. Kebalikan dari tujuan untuk link yang dibuka dari LinkedIn. |

---

## 3. Pipeline asset

Bagian paling berdampak, bentuknya satu script Node yang jalan tiap map berubah.

`tools/build-map.mjs`:

```
map.tmx  ──baca──►  daftar .tsx yang dipakai
   │                      │
   │                      └──baca <image source>──►  PNG sumber
   │
   └──kumpulkan GID terpakai──► potong 252 tile ──► atlas.png + map.json
```

Langkahnya:

1. Parse `map.tmx`, resolve tiap `<tileset source="*.tsx">`
2. Baca tiap `.tsx`, ambil path PNG dari `<image source>`
3. Kumpulkan GID unik dari semua layer (buang flag flip di 3 bit teratas)
4. Potong tiap tile 16×16 dari PNG sumber pakai `sharp`
5. **Extrude 1 px** tiap sisi tile, susun jadi atlas 16×16 tile dengan `spacing: 2`
6. Tulis ulang Tiled JSON: satu tileset, GID dipetakan ulang
7. Output ke `public/assets/`

### 3.1 Anggaran asset

| Asset | Mentah | Setelah pipeline | Perlakuan |
|---|---:|---:|---|
| 8 tileset map | 1,5 MB | ~40 KB | Repack jadi satu atlas 256×256 |
| Premium Pack.png | 1,2 MB | 0 KB | Dibuang — 73 tile-nya sudah pindah |
| Sisa pack tak terpakai | 17 MB | 0 KB | Tinggal di folder sumber |
| Sprite karakter | 7 KB | 7 KB | Spritesheet 32×32 |
| Petir strike + splash | 29 KB | 29 KB | 13 frame @64×64, 14 frame @48×48 |
| Peta minimap | — | ~60 KB | Render sekali dari Tiled |

### 3.2 Wajib: extrude

Pixel art yang di-zoom 3× akan menampilkan garis jahitan tipis antar tile kalau atlas-nya
rapat. Perbaikannya di pipeline, bukan di kode:

- Gandakan 1 px tepi tiap tile ke luar, set `spacing: 2` di tileset JSON
- Di Phaser: `pixelArt: true`, `roundPixels: true`
- Zoom kamera **bilangan bulat saja** — zoom 2,5 bikin pixel goyang saat karakter jalan

### 3.3 Setup

```bash
npm create astro@latest web -- --template minimal --typescript strict
cd web
npx astro add tailwind
npm i phaser
npm i -D fast-xml-parser        # sharp sudah ikut Astro

npm run build:map               # → public/assets/{atlas.png, map.json}
```

---

## 4. Yang harus dikerjakan manual di Tiled

Empat langkah ini memblokir semua kode. Nama layer & properti dipakai persis oleh game.

1. **Matikan mode infinite** — *Map → Map Properties → Infinite: false*.
   Tiled otomatis memangkas ke area terpakai (~48×48 tile).
2. **Object layer `collisions`** — rectangle di atas sungai, rumah, pagar, pohon, batas map.
   Rectangle besar jauh lebih murah daripada per-tile. Kejar 30–50 kotak, bukan 500.
3. **Object layer `spawn`** — satu point object bernama `player_spawn`, di jalan setapak
   dekat pusat desa.
4. **Object layer `poi`** — satu rectangle per titik singgah, dengan properti di bawah.

### 4.1 Skema custom properties layer `poi`

```
id      : string   // "rumah_projects" — kunci unik, dipakai di URL
label   : string   // "Projects" — teks di minimap
panel   : string   // "projects" — slug konten yang dibuka
enterAt : string   // "24,31" — tile tempat karakter mendarat
facing  : string   // "up" | "down" | "left" | "right"
```

`enterAt` dipisah dari posisi object supaya petirnya menyambar di depan pintu,
bukan di tengah atap.

### 4.2 Urutan depth

Menentukan karakter bisa lewat di belakang pohon:

| Layer | Depth |
|---|---:|
| `Tile Layer 1` | 0 |
| `di bawah` | 1 |
| bayangan karakter | 9 |
| karakter | 10 |
| `di atas map 1` | 20 |

---

## 5. Sembilan titik singgah

Rinciannya 4 rumah + 4 bangku + 1 kios = **9** (bukan 8).

| Tempat | Letak | `id` | Isi |
|---|---|---|---|
| Rumah atap teal | kanan atas | `rumah_projects` | **Projects** — galeri karya, thumbnail, stack, link repo/demo |
| Rumah lebar | tengah kiri | `rumah_about` | **About Me** — cerita singkat, foto, apa yang dicari |
| Rumah coklat | tengah kanan | `rumah_cv` | **CV** — riwayat kerja & pendidikan, unduh PDF |
| Rumah besar tan | bawah tengah | `rumah_contact` | **Contact** — email, LinkedIn, GitHub |
| Kios beratap garis | bawah kiri | `kios_stack` | **Tech Stack** — tool yang kamu "jual" |
| Bangku × 4 | tersebar | `bangku_1`…`bangku_4` | **Memo** — sertifikat, tulisan, easter egg, buku tamu |

### 5.1 Routing

Tiap POI punya URL sendiri: `/#/rumah_projects`. Isinya jadi bisa di-share langsung —
kirim `/#/rumah_cv` ke rekruter, game spawn langsung di sana lengkap dengan petirnya.
Tombol back browser tetap jalan.

Versi statisnya di `/projects`, `/cv`, dst — dari file Markdown yang sama.

---

## 6. Animasi spawn petir

Dipakai saat klik PLAY dan tiap pindah antar titik singgah. Karena akan dilihat puluhan
kali, durasinya dijaga di bawah satu detik.

Frame tersedia:
- `Thunderstrike w blur.png` — 832×64 = **13 frame @64×64**
- `Thunder splash wo blur.png` — 672×48 = **14 frame @48×48**

### 6.1 Timeline 900 ms

| Waktu | Kejadian |
|---|---|
| 0–160 ms | Layar gelap, kamera pindah ke tujuan |
| 160–470 ms | Sambaran turun, 13 frame |
| 420–490 ms | Kilat putih layar penuh |
| 450–680 ms | Splash + karakter masuk `scaleY` 0→1, getar kamera 120 ms |
| 630–900 ms | Bubble chat + panel konten masuk |

Dua detail yang menentukan rasanya:

- **Kilat putih menutupi momen ganti kamera** — karakter tidak pernah terlihat
  "teleport", dia muncul dari kilat.
- **Karakter masuk dengan scale, bukan fade** — fade terasa seperti hantu,
  scale terasa seperti dihantam ke tanah.

### 6.2 Wajib: mode cepat

Simpan flag di `localStorage`. Sesudah transisi kelima, potong durasi jadi 350 ms
otomatis, dan sediakan toggle "animasi cepat" di menu.

Yang paling sering bolak-balik di portfolio ini adalah orang yang sedang menilai kamu —
jangan buat mereka menunggu hal yang sama sembilan kali.

Hormati juga `prefers-reduced-motion`: langsung potong ke fade 150 ms.

---

## 7. Struktur kode

```
PORTOOO/
├─ plan.md
├─ mapporto/                    # sumber Tiled — TIDAK di-deploy
│  ├─ map.tmx
│  ├─ *.tsx                     # penunjuk ke PNG
│  └─ */*.png                   # gambar asli, 109 file
└─ web/
   ├─ astro.config.mjs          # output: 'static'
   ├─ tools/build-map.mjs       # tmx + tsx + png → atlas.png + map.json
   ├─ public/assets/            # hasil build, ~140 KB
   └─ src/
      ├─ content/
      │  ├─ config.ts           # skema Zod tiap collection
      │  ├─ projects/*.md
      │  ├─ memos/*.md
      │  └─ pages/{about,cv,contact,stack}.md
      ├─ pages/
      │  ├─ index.astro         # halaman game
      │  ├─ projects/[slug].astro   # versi statis, SEO
      │  ├─ cv.astro
      │  └─ content.json.ts     # prerender → JSON yang dibaca game
      ├─ game/
      │  ├─ main.ts
      │  ├─ scenes/
      │  │  ├─ BootScene.ts     # font + sprite kecil
      │  │  ├─ PreloadScene.ts  # bar 0–100%
      │  │  ├─ TitleScene.ts    # judul + tombol PLAY
      │  │  ├─ WorldScene.ts    # map, karakter, POI, minimap
      │  │  └─ UIScene.ts       # overlay, jalan paralel
      │  ├─ objects/
      │  │  ├─ Player.ts        # 32×32, 4 arah, idle + walk
      │  │  ├─ PoiMarker.ts
      │  │  ├─ ThunderFx.ts     # urutan 900 ms
      │  │  └─ ChatBubble.ts
      │  └─ router.ts           # hash route ↔ POI
      └─ components/            # panel, menu, modal MAP (Astro + Tailwind)
```

### 7.1 Titik integrasi Astro ↔ Phaser

Content Collections hanya bisa dibaca saat build (server-side). Game berjalan di browser.
Jembatannya satu endpoint yang di-prerender jadi file statis:

```ts
// src/pages/content.json.ts
export const prerender = true;
export async function GET() {
  const projects = await getCollection('projects');
  const memos    = await getCollection('memos');
  return Response.json({ projects, memos });
}
```

Game fetch `/content.json` sekali di PreloadScene, sekalian ikut kehitung di loading bar.
Satu sumber Markdown, dua konsumen.

Phaser dimuat lewat `<script>` biasa di `index.astro` — tidak butuh integrasi framework:

```astro
<canvas id="game"></canvas>
<script>
  import { startGame } from '../game/main';
  startGame();
</script>
```

`UIScene` berjalan **bersamaan** dengan `WorldScene`, bukan menggantikannya — supaya panel
bisa dibuka tanpa menghentikan animasi map.

---

## 8. Urutan pengerjaan

Disusun supaya ada yang bisa dilihat jalan sejak hari pertama.

### Fase 1 — Pipeline asset · 1–2 hari
Tulis `build-map.mjs`. Duluan sebelum apa pun, karena semua fase lain load hasilnya.
Selesai kalau `atlas.png` + `map.json` terbentuk otomatis.

### Fase 2 — Map jalan + karakter bergerak · 2–3 hari
Astro + Phaser, render map, karakter WASD/panah dengan 8 animasi, collision dari layer
`collisions`, kamera mengikuti. Milestone paling memuaskan — setelah ini desanya sudah
bisa dijelajahi.

### Fase 3 — Konten + POI + panel · 2–3 hari
Setup Content Collections, tulis konten aslinya, baca layer `poi`, tampilkan penanda,
deteksi dekat & klik, buka panel. Jangan tunda isi kontennya — teks asli sering mengubah
kebutuhan layout.

### Fase 4 — Transisi petir · 1–2 hari
Rangkai urutan 900 ms di bagian 6, plus getar kamera, kilat, dan mode cepat.

### Fase 5 — Loading & layar judul · 1–2 hari
Boot → Preload dengan bar sungguhan dari event `progress`, lalu layar judul. Latar
judulnya: render map sendiri di zoom tinggi — tidak perlu art baru.

### Fase 6 — Menu, bubble chat, minimap · 2–3 hari
Menu atas, bubble chat mengikuti karakter, minimap sudut (kamera kedua Phaser, zoom 0.12),
modal MAP layar penuh dengan label yang bisa diklik.

### Fase 7 — Mobile · 2 hari
Joystick virtual (asset sudah ada: `Joystick_Virtual.tsx`), tap-to-move, panel jadi bottom
sheet, zoom kamera per lebar layar. Sekitar separuh pengunjung portfolio datang dari HP —
ini bukan opsional.

### Fase 8 — Poles & rilis · 2–3 hari
Halaman statis `/projects/[slug]` & `/cv`, audio (langkah kaki, guntur, ambience, mute),
`prefers-reduced-motion`, meta OG untuk preview link, sitemap, deploy + domain.

**Total ~13–20 hari.** Fase 1–4 sudah menghasilkan sesuatu yang layak dibagikan;
sisanya membuatnya terasa jadi.

---

## 9. Keputusan yang perlu diambil

- **Karakter mana yang jadi kamu?** Ada `blonde_man` dan `blue_haired_woman`, keduanya
  lengkap dengan sheet bayangan. Sheet bayangan dipasang sebagai sprite terpisah di depth
  persis di bawah karakter.
- **POI dibuka dengan klik, atau berjalan mendekat?** Saran: keduanya. Klik untuk yang
  buru-buru, mendekat lalu tekan tombol untuk yang menikmati jalan-jalannya. Biayanya
  kecil, dan dua tipe pengunjung ini benar-benar beda.
- **Bahasa: Indonesia, Inggris, atau dua-duanya?** Berpengaruh ke struktur `content/`.
  Kalau ada kemungkinan dwibahasa, pisahkan per bahasa sejak Fase 3 — jauh lebih murah
  daripada memisahkannya belakangan.
- **Bangku ke-4 dan kios sudah ada isinya?** Lima titik dengan konten kuat lebih baik
  daripada sembilan yang setengah isi. Kalau bahannya belum ada, kunci dulu titiknya
  (bubble "belum dibuka") dan buka saat isinya siap.

---

*Angka tile, dimensi sprite, dan jumlah frame di dokumen ini terukur langsung dari
`map.tmx`, 27 berkas tileset, dan 109 PNG di `C:\PORTOOO\mapporto` — bukan perkiraan.*
