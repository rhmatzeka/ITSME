---
title: "Taniin Play to Earn"
summary: "A pixel farming game for Android and the web with an economy connected to the blockchain."
stack: ["Flutter", "Flame", "Solidity", "Hardhat", "Tiled", "Kotlin"]
year: 2026
repo: "https://github.com/rhmatzeka/TaniinPlaytoEarn"
demo: "https://taniin.rahmateka.my.id"
images: ["/img/projects/taniin-play-to-earn.webp", "/img/projects/taniin-play-to-earn-2.webp", "/img/projects/taniin-play-to-earn-3.webp"]
order: 1
---

A pixel farming game prototype for Android and the browser, built with
Flutter/Flame on top of a TMX map. Players buy seeds, plant, harvest, sell
crops, and buy land — and the whole farm is still there after the app is
closed.

The wallet reads the ETH balance over Sepolia RPC and TANI tokens from an
ERC-20 contract; every action with a transaction hash can be opened on
Etherscan.

The most interesting part was the limits. The signer is deliberately
**fail-closed**: only actions that burn tokens are allowed through, not ones
that mint them, until wallet-signature authentication and authoritative
bookkeeping actually exist. Better that a feature isn't available yet than an
economy anyone can print.
