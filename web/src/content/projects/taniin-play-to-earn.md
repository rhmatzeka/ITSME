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

Prototipe game bertani pixel untuk Android dan browser, dibangun di Flutter/Flame
di atas peta TMX. Pemain membeli benih, menanam, memanen, menjual hasil, dan
membeli tanah — dan seluruh isi kebun tetap ada setelah aplikasi ditutup.

Dompetnya membaca saldo ETH lewat RPC Sepolia dan token TANI dari kontrak ERC-20;
tiap aksi yang punya hash bisa dibuka di Etherscan.

Yang paling menarik dikerjakan justru batasnya. Penanda tangannya sengaja
**gagal-tertutup**: yang diizinkan lewat cuma aksi yang membakar token, bukan
yang mencetaknya, sampai autentikasi tanda tangan dompet dan pembukuan yang
otoritatif benar-benar ada. Lebih baik fiturnya belum tersedia daripada
ekonominya bisa dicetak sembarangan.
