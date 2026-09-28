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
- **Tidak bisa menghabiskan server:** memori 128 MB, ½ CPU, 64 proses,
  256 berkas terbuka; paling banyak 6 pengunjung sekaligus (`--max-clients`).
- **Waktu:** diam 5 menit atau total 15 menit → sesi ditutup. `sapu.sh`
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

   Skripnya memasang Docker, ttyd 1.7.7, image `mapporto-sandbox` (bash,
   neovim, python3, node, git, nano, …), layanan systemd, dan Caddy.
3. Buka `https://terminal.rahmateka.my.id` — harus muncul terminal.
4. Di Vercel: **Settings → Environment Variables** →
   `PUBLIC_TERMINAL_URL = https://terminal.rahmateka.my.id/`, lalu redeploy.
   Monitor di desa akan menampilkan lencana **LIVE**.

## Merawat

```bash
systemctl status ttyd-mapporto            # layanannya
docker ps --filter label=mapporto.sesi=1   # sesi yang sedang jalan
journalctl -u ttyd-mapporto -f             # log koneksi
docker build -t mapporto-sandbox sandbox/  # setelah mengubah isi kontainer
```

Isi folder rumah pengunjung (sambutan, contoh kode, konfigurasi neovim) ada di
`sandbox/sambutan/`.
