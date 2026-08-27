---
title: "Taniin Play to Earn"
summary: "Game bertani pixel untuk Android dan Web dengan ekonomi yang tersambung ke blockchain."
stack: ["Flutter", "Flame", "Solidity", "Hardhat", "Tiled", "Kotlin"]
year: 2026
repo: "https://github.com/rhmatzeka/TaniinPlaytoEarn"
demo: "https://taniin.rahmateka.my.id"
image: "/img/projects/taniin-play-to-earn.jpg"
order: 1
---

Prototipe game bertani lanskap yang berjalan di Android dan browser. Pemain
membeli benih, menanam, memanen, menjual hasil, dan membeli tanah — dengan
koin di dalam game yang bisa disinkronkan ke dompet kripto.

## Yang ada di dalamnya

- **Mesin game** — loop Flutter/Flame dengan peta TMX, collision, layer
  depan, minimap, joystick, dan dukungan tombol fisik.
- **Siklus bertani utuh** — kepemilikan tanah, jual tanah, pilih benih,
  beli per jumlah, konfirmasi tanam, konfirmasi panen, efek panen, plus
  toko benih dan rumah penjualan hasil yang terpisah.
- **Simpanan lokal** — koin, benih, inventaris panen, kepemilikan tanah, dan
  tanaman yang sedang tumbuh tetap ada setelah aplikasi ditutup.
- **Audio** — musik latar dan efek suara klik, error, serta langkah kaki,
  lengkap dengan pengatur di menu.
- **Jembatan Web3** — tombol dompet yang membaca saldo ETH lewat RPC Sepolia
  dan saldo token TANI dari kontrak ERC-20, plus riwayat transaksi yang
  membuka Etherscan untuk tiap aksi yang punya hash.

## Yang paling menarik dikerjakan

Batas antara game dan blockchain. Setiap aksi ekonomi — beli tanah, jual
tanah, beli benih, tanam, panen, jual hasil — dilacak dan bisa dikirim ke
endpoint penanda tangan; kalau backend-nya tidak dikonfigurasi, aksinya
tercatat lokal alih-alih menggantung.

Bagian itu juga yang memaksa saya berhati-hati. Batas penanda tangan
sengaja **gagal-tertutup**: aksi on-chain publik dimatikan sampai
autentikasi berbasis tanda tangan dompet dan pembukuan yang otoritatif
benar-benar ada. Yang diizinkan lewat cuma aksi yang membakar token, bukan
yang mencetaknya. Lebih baik fiturnya belum tersedia daripada ekonominya
bisa dicetak sembarangan.
