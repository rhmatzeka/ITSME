---
title: "MonadWishes"
summary: "Patungan hadiah ulang tahun on-chain: dana terkunci sampai hari-H, menghasilkan yield selama menunggu, lalu cair bersama NFT berisi ucapan teman-teman."
stack: ["React", "TypeScript", "Solidity", "Foundry", "Monad", "Envio", "Privy"]
year: 2026
repo: "https://github.com/rhmatzeka/MonadWishes"
demo: "https://monadwishes.rahmateka.my.id/"
images: ["/img/projects/monadwishes.webp", "/img/projects/monadwishes-2.webp", "/img/projects/monadwishes-3.webp"]
order: 1
---

Patungan hadiah ulang tahun yang berjalan sendiri. Sekelompok teman membuat vault
berjangka, menyumbang MON beserta ucapan on-chain, dan uangnya tidak menganggur
selama menunggu — langsung disetor ke precompile staking bawaan Monad di `0x1000`.
Begitu hari-H tiba, pokok plus yield-nya cair ke penerima bersama NFT booklet
berisi seluruh ucapan.

NFT-nya digambar **100% on-chain**: SVG-nya dirakit di dalam Solidity, tanpa IPFS,
jadi tidak ada gambar yang bisa hilang belakangan. Harga MON/USD dibaca langsung
dari Pyth, dan seluruh event kontrak diindeks lewat Envio HyperIndex — dengan RPC
Monad sebagai cadangan kalau indexer-nya goyang.

Dibangun berdua untuk hackathon Monad, dan hidup di testnet-nya.
