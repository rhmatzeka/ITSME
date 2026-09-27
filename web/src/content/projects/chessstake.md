---
title: "ChessStake"
summary: "Arena catur live tempat penonton yang bermain: tiap giliran mereka bertaruh bidak mana yang bergerak, lalu AI memilih langkah legal terbaiknya."
stack: ["Next.js", "TypeScript", "Solidity", "Hardhat", "wagmi", "Prisma", "chess.js"]
year: 2026
repo: "https://github.com/rhmatzeka/ChessStake"
demo: "https://pawnpool.rahmateka.my.id"
order: 2
---

Catur yang dimainkan penonton, bukan dua pemain. Penonton menyambungkan dompet,
memilih tim Putih atau Hitam, lalu tiap giliran punya voting 20 detik untuk
menentukan **bidak mana** yang bergerak. Tiap bidak punya harga per suara, dari
pion 0,0001 ETH sampai ratu 0,001 ETH, dan bidak dengan taruhan terbesar menang.

Langkahnya sendiri selalu dipilih AI (chess.js dengan evaluasi ala Stockfish),
jadi tidak ada satu orang pun yang bisa menyabotase permainan. Tim pemenang
membagi 90% pool sesuai besar taruhannya; seri mengembalikan 90%, permainan batal
mengembalikan semuanya, dan taruhan yang terlambat masuk bisa diklaim penuh.

Ada juga agen AI yang bisa merekomendasikan bidak atau memilih otomatis, papan
peringkat untuk penaruh dan agen, serta kontrak Solidity (OpenZeppelin v5) di
Ethereum Sepolia.
