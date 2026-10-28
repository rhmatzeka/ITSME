---
title: "Taniin Play to Earn"
summary: "A pixel farming game for the web and Android where every harvest can be recorded on Ethereum Sepolia."
stack: ["Flutter", "Flame", "Node.js", "Postgres", "Privy", "Solidity"]
year: 2026
repo: "https://github.com/rhmatzeka/TaniinPlaytoEarn"
demo: "https://taniin.rahmateka.my.id"
download: "https://taniin.rahmateka.my.id/unduh/Taniin.apk"
images: ["/img/projects/taniin-play-to-earn.webp", "/img/projects/taniin-play-to-earn-2.webp", "/img/projects/taniin-play-to-earn-3.webp"]
order: 1
---

A pixel farming game for the browser and Android, built with Flutter and
Flame. Players buy seeds, plant, harvest, and sell crops, level up through
daily quests, and share the map with other farmers and **Pak Tani AI**, an
assistant that plants and harvests when you ask it in chat.

Anyone can play straight away as a guest. Signing in with **Privy** (email,
Google, or a wallet) creates a Sepolia wallet automatically and carries the
guest farm over. From then on land is an ERC-721, seeds and crops are
ERC-1155 items, and Game Coin can be swapped for the TANI token or Sepolia ETH.

The part I cared about most is that the economy can't be printed from the
client. Every action goes to a server that checks prices, grow time, and
inventory in Postgres before the signer sends anything, with idempotency
keys, rate limits, daily payout caps, and a kill switch.
