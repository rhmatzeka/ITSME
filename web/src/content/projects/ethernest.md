---
title: "Ethernest"
summary: "Dompet kripto multi-chain untuk Android: sembilan jaringan EVM, swap lewat pool sendiri, dan beli ETH pakai rupiah lewat Midtrans."
stack: ["Java", "Android", "Web3j", "Solidity", "Hardhat", "Express"]
year: 2026
repo: "https://github.com/rhmatzeka/EthernestMobileApps"
images: ["/img/projects/ethernest.jpg", "/img/projects/ethernest-2.jpg", "/img/projects/ethernest-3.jpg", "/img/projects/ethernest-4.jpg", "/img/projects/ethernest-5.jpg"]
order: 1
---

Dompet kripto Android dengan Java dan Web3j. Sembilan jaringan EVM sudah
disiapkan — Ethereum, Sepolia, BSC, Avalanche, Polygon, Arbitrum, Optimism,
Base, Fantom — dan RPC lain boleh ditambah sendiri. Saldo ETH dan ERC-20,
NFT 721/1155, grafik candlestick, kirim-terima lewat QR, dan swap ke pool
yang kontraknya ikut di repo ini.

Yang paling menarik dikerjakan: beli ETH pakai rupiah. Kunci privat tidak
pernah menyentuh alur itu — aplikasi cuma membuat order, backend yang membuat
transaksi Midtrans dan mengirim ETH dari treasury setelah pembayarannya lunas.
Harga ETH/IDR dihitung di server dari CoinGecko, lalu Indodax, lalu Binance
sebagai cadangan.
