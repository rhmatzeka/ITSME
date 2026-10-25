# Terminal pengunjung — Desa Mapporto

Komputer di meja Rahmat (halaman rumah About) membuka terminal. Ada dua mode:

| Mode | Kapan | Isinya |
| --- | --- | --- |
| **BROWSER** | `PUBLIC_TERMINAL_URL` kosong atau server mati | Shell di browser pengunjung (`web/src/terminal/`): sistem berkas di memori, `nvim`/`nano`, `python3` (Pyodide) dan `node` di Web Worker. Tidak ada yang dikirim ke server. |
| **LIVE** | `PUBLIC_TERMINAL_URL` diisi dan servernya hidup | Linux sungguhan dari folder ini: ttyd + satu kontainer Docker sekali pakai per pengunjung. |

> **Jangan pasang di VPS tradebot atau VPS kerja.** Pakai VPS terpisah khusus
> untuk ini (1 vCPU / 1 GB RAM cukup untuk 6 pengunjung sekaligus).

## Pengaman tiap pengunjung

Aturan yang sama di kedua mode:

- **Satu pengunjung = satu user = satu kontainer sendiri**, dibuat saat
  monitor dinyalakan dan dihapus (`--rm`) begitu ditutup.
- **5 MB per pengunjung:** folder rumah `/home/tamu` 4 MB + `/tmp` 1 MB
  (tmpfs). Sisanya hanya-baca (`--read-only`).
- **Terkunci di folder rumah:** `cd` keluar dari `~` ditolak, dan folder sistem
  (`/`, `/etc`, `/usr`, `/var`, …) tidak bisa dibuka isinya (izin `711`).
- **Tanpa internet** (`--network none`): tidak bisa dipakai menyerang orang lain.
- **Tidak bisa jadi root:** user 1000, `--cap-drop ALL`,
  `no-new-privileges`, tanpa program setuid, tanpa sudo.
- **Tidak bisa menghabiskan server:** memori 96 MB, ½ CPU, 64 proses,
  256 berkas terbuka per pengunjung; semua sesi bersama dikurung
  `mapporto.slice` (400 MB, 1 CPU).
- **Paling banyak 3 pengunjung sekaligus** (`MAPPORTO_MAKS`, ditegakkan
  `mulai-sesi.sh` di bawah `flock`). `hitung-sesi.sh` menulis jumlah sesi ke
  `status.json` tiap 2 detik; situsnya membaca itu dulu, jadi pengunjung ke-4
  melihat layar **TERMINAL FULL** di monitor dan otomatis tersambung begitu ada
  yang keluar (atau pindah ke terminal browser). Kalau dua orang berebut slot
  terakhir, yang kalah dapat pesan "The terminal is full" di terminalnya.
- **Waktu:** diam 5 menit atau total 15 menit → sesi ditutup, dengan pesan
  "session ended"; Enter membuka sandbox baru (auto-reconnect ttyd dimatikan). `sapu.sh`
  (tiap 5 menit) membereskan kontainer yang lebih dari 16 menit.
- **Hanya lewat HTTPS dan hanya dari situs portfolio:** ttyd cuma mendengarkan
  di `127.0.0.1`; Caddy memasang HTTPS dan `frame-ancestors`, jadi terminalnya
  tidak bisa ditanam di situs lain.
- Opsional, isolasi lebih kuat: pasang [gVisor](https://gvisor.dev) lalu isi
  `Environment=MAPPORTO_RUNTIME=runsc` di `ttyd-mapporto.service`.

## Pasang (VPS baru, Debian/Ubuntu)

1. Arahkan subdomain ke IP VPS itu, misalnya `terminal.rahmateka.my.id`
   (DNS record A).
2. Salin folder ini ke VPS dan jalankan:

   ```bash
   sudo ./pasang.sh terminal.rahmateka.my.id
   ```

   Skripnya memasang Docker, ttyd 1.7.7, image `mapporto-sandbox` (zsh,
   Neovim + NvChad, tmux, python3, node, git, nano, …), JetBrainsMono Nerd
   Font (`pasang-font.sh`), layanan systemd, dan Caddy. Boleh dijalankan ulang
   untuk memperbarui: `caddy-blok.py` cuma mengganti isi blok situs terminal di
   `/etc/caddy/Caddyfile` (alamat `http://` dan situs lain tetap, cadangan di
   `Caddyfile.sebelum-pasang`).
3. Buka `https://terminal.rahmateka.my.id` — harus muncul terminal.
4. Di Vercel: **Settings → Environment Variables** →
   `PUBLIC_TERMINAL_URL = https://terminal.rahmateka.my.id/`, lalu redeploy.
   Monitor di desa akan menampilkan lencana **LIVE**.

## Desa ramai: pengunjung live + buku tamu

`desa/desa.mjs` (Node 22, tanpa paket npm) melayani dua hal di bawah `/desa`
domain yang sama, lewat Caddy:

- **`/desa/ws`** (WebSocket): pengunjung yang sedang membuka portfolio saling
  melihat sebagai warga samar di desa dan bisa saling melambai. Yang dikirim
  cuma posisi, arah hadap, dan nomor rupa — tanpa nama, tanpa IP. Maks 60
  orang, 4 per IP, 20 pesan/detik per orang. Tidak ada yang disimpan.
- **`/desa/tamu`** (buku tamu): GET 40 pesan terbaru, POST nama ≤ 24 + pesan
  ≤ 140 huruf. Langsung tampil, tapi tautan dan kata kasar ditolak, 1 pesan
  per 2 menit dan 5 per hari per IP, 300 per hari total. Tiap pesan baru
  dikabarkan ke Telegram (token dari `tanya.env`) dengan tautan hapus
  bertanda tangan. `/admin` → **Guestbook** juga bisa menghapus, lewat
  `POST /desa/tamu/hapus` dengan `DESA_ADMIN_KEY`.
- Pesan disimpan di `/var/lib/private/mapporto-desa/tamu.jsonl` (tambah-saja,
  penghapusan dicatat sebagai baris sendiri).

`pasang.sh` membuat `/etc/mapporto/desa.env` dengan dua kunci acak kalau
belum ada, memasang `mapporto-desa.service`, dan Caddy meneruskan `/desa*`.
Di server dengan failover server-mats (`giliran`), layanannya tidak nyala
sendiri saat boot: giliran yang menyalakannya di server yang sedang menerima
tunnel, dan buku tamunya ikut pindah bersama data bot lain.
**Isi `DESA_ADMIN_KEY` yang sama di Vercel** (Production + Preview) supaya
tombol hapus di `/admin` jalan. Situsnya memakai asal `PUBLIC_TERMINAL_URL`;
untuk menguji di laptop: `node desa/desa.mjs` lalu
`PUBLIC_DESA_URL=http://127.0.0.1:7683 npm run dev` (dengan
`ASAL_TAMBAHAN=http://127.0.0.1:4321` di server lokalnya).

## Tampilan

- `sandbox/welcome.sh`: sambutan (logo RAHMAT bergradasi), menyesuaikan lebar
  layar; di HP versi ringkas. Perintah `welcome`/`help` menampilkannya lagi.
- `gaya-ttyd.html` disisipkan ke halaman ttyd oleh `buat-index.sh`
  (`--index`): latar menyatu, scrollbar tipis, kotak pesan bergaya desa.
- Shell ala dotfiles rifuki: zsh + Oh My Zsh, Starship, neofetch, yazi (`y`)
  dengan tema Miku, tmux dengan tema catppuccin frappe (`/etc/tmux.conf`), dan
  fzf, ripgrep, htop.
- Neovim 0.12 dengan config NvChad rifuki (`sandbox/rifuki/nvim/`): tema,
  statusline, nvim-tree, telescope, treesitter, completion, noice sama seperti
  di laptop; tanpa AI, LSP/Mason, Rust, Discord, dan wakatime. Plugin
  dipasang persis sesuai `lazy-lock.json` saat image dibangun (tahap `nvim` di
  Dockerfile) ke `/usr/share/mapporto-nvim`, hanya-baca; `sandbox/nvim.sh`
  mengarahkan nvim ke sana. Cache bytecode Lua dimatikan: ±1,5 MB, terlalu
  besar untuk folder rumah 4 MB.
- Ikon (NvChad, yazi, Starship) butuh Nerd Font: `pasang-font.sh` memasang
  JetBrainsMono Nerd Font Mono di `/srv/mapporto-font`, Caddy menyajikannya di
  `/fonts/`, dan `gaya-ttyd.html` memuatnya sebagai "Mapporto Mono" lalu
  menyuruh xterm mengukur ulang setelah font siap.
- Daftar font ttyd (`-t fontFamily=…` di service) ditulis TANPA tanda kutip:
  ttyd membacanya sebagai JSON, dan daftar berkutip terbaca cuma nama
  pertamanya, tanpa cadangan.

## Merawat

```bash
systemctl status ttyd-mapporto            # layanannya
docker ps --filter label=mapporto.sesi=1   # sesi yang sedang jalan
cat /var/lib/mapporto-status/status.json   # yang dilihat situs
journalctl -u ttyd-mapporto -f             # log koneksi
docker build -t mapporto-sandbox sandbox/  # setelah mengubah isi kontainer
```

Isi folder rumah pengunjung (contoh kode, README) ada di `sandbox/sambutan/`.

Untuk mencoba image baru tanpa mengganggu pengunjung: bangun dengan tag lain
(`docker build -t mapporto-sandbox:baru sandbox/`) dan jalankan ttyd kedua di
port lain dengan `MAPPORTO_IMAGE=mapporto-sandbox:baru` (dibaca `mulai-sesi.sh`).
