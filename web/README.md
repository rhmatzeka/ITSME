# Desa Mapporto — web

Portfolio berbentuk game pixel 2D. Astro (situs) + Phaser 3 (game).

## Perintah

```bash
npm install
npm run dev       # build:map lalu dev server → http://localhost:4321
npm run build     # build:map lalu build statis → dist/
npm run build:map # HANYA repack asset dari ../mapporto
npm run preview   # cek hasil build
```

`npm run dev` dan `npm run build` sudah menjalankan `build:map` lebih dulu,
jadi cukup edit map di Tiled lalu jalankan ulang salah satunya.

## Alur asset

```
../mapporto/map.tmx  ──►  daftar .tsx  ──►  <image source>  ──►  PNG sumber
                                                    │
                       tools/build-map.mjs ─────────┘
                                │
                                ▼
             public/assets/{atlas.png, map.json, sprites/}
```

Kamu tidak pernah menyentuh PNG manual. Script menelusuri rantai yang sama
dengan yang Tiled pakai, mengambil **252 tile yang benar-benar terpakai** dari
8 tileset, lalu menyusunnya jadi satu atlas 288×288 (15 KB) — dari 20 MB mentah.

## Kontrol

| Tombol | Fungsi |
|---|---|
| `WASD` / panah | jalan |
| klik tanah | jalan ke titik itu |
| klik rumah/bangku/kios | pindah ke sana dengan animasi petir |
| klik minimap | pindah ke POI terdekat |
| `C` | tampilkan kotak collision (debug) |
| `Esc` | tutup panel / peta |

### Di HP / layar sentuh

Joystick virtual muncul otomatis kalau `pointer: coarse` terdeteksi atau lebar
layar di bawah 700px. Asetnya dari `Virtual Joystick V2`.

| Kontrol | Fungsi |
|---|---|
| joystick kiri bawah | jalan — cincinnya pindah ke tempat jempol mendarat |
| tombol **A** | masuk ke titik singgah terdekat (radius 6 tile) |
| tombol **B** | buka peta |

Minimap sudut sengaja tidak dibuat di layar sentuh — ruangnya dipakai joystick,
dan tombol MAP sudah memberi akses peta penuh.

## Debugging

`window.__game` diekspos ke konsol browser — pegangan langsung ke instance Phaser:

```js
__game.scene.getScene('World').travelTo('rumah_cv')   // pindah paksa
__game.scene.getScene('World').busy                   // sedang animasi?
Math.round(__game.loop.actualFps)                     // fps
```

## Menambah konten

Tambah file `.md` di `src/content/`:

- `projects/` — satu file = satu kartu di panel Projects
- `pages/` — about, cv, contact, stack (`panel:` harus cocok dengan POI)
- `memos/` — isi bangku (`poi:` harus cocok, mis. `bangku_1`)

Frontmatter divalidasi Zod saat build — salah ketik ketahuan sebelum deploy.

## Collision

Saat ini memakai **auto-collision** hasil tebakan pipeline (232 tile terhalang):
air menghalangi, jembatan tidak, tile terisi >60% menghalangi kecuali isian
polos seperti rumput taman.

Begitu kamu menggambar object layer bernama `collisions` di Tiled, layer itu
otomatis menang dan tebakan ini diabaikan. Tekan `C` di dalam game untuk
melihat kotaknya sebelum memutuskan mana yang perlu diperbaiki.

## POI

Sembilan titik singgah sekarang didefinisikan di `src/game/poi.ts` sebagai
fallback, koordinatnya sudah divalidasi bisa dicapai dari titik spawn.
Kalau kamu membuat object layer `poi` di Tiled (lihat `../plan.md` bagian 4),
daftar itu yang dipakai dan fallback diabaikan.

## Deploy ke Vercel

`vercel.json` ada di **root repo** (`../vercel.json`), bukan di sini — karena
`build:map` membaca `../mapporto` yang berada di luar folder `web/`.

Di dashboard Vercel: **Root Directory dibiarkan kosong** (root repo).
Sisanya sudah diatur `vercel.json`:

```
installCommand  : npm --prefix web install
buildCommand    : npm --prefix web run build
outputDirectory : web/dist
```

Atau lewat CLI, dari root repo:

```bash
npx vercel        # preview
npx vercel --prod # produksi
```
