---
title: "MonadWishes"
summary: "An on-chain birthday gift pool: funds stay locked until the big day, earn yield while they wait, then pay out with an NFT full of friends' wishes."
stack: ["React", "TypeScript", "Solidity", "Foundry", "Monad", "Envio", "Privy"]
year: 2026
repo: "https://github.com/rhmatzeka/MonadWishes"
demo: "https://monadwishes.rahmateka.my.id/"
images: ["/img/projects/monadwishes.webp", "/img/projects/monadwishes-2.webp", "/img/projects/monadwishes-3.webp"]
order: 1
---

A birthday gift pool that runs itself. A group of friends creates a time-locked
vault and chips in MON along with on-chain messages, and the money doesn't sit
idle while it waits — it goes straight into Monad's native staking precompile at
`0x1000`. When the day arrives, the principal plus yield is released to the
recipient together with an NFT booklet of every message.

The NFT is drawn **100% on-chain**: the SVG is assembled inside Solidity, with
no IPFS, so no image can go missing later. The MON/USD price is read straight
from Pyth, and every contract event is indexed with Envio HyperIndex — with
Monad RPC as a fallback if the indexer wobbles.

Built by a team of two for a Monad hackathon, and live on the Monad testnet.
