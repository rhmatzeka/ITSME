---
title: "ChessStake"
summary: "A live chess arena where the audience plays: each turn they bet on which piece moves, then an AI picks its best legal move."
stack: ["Next.js", "TypeScript", "Solidity", "Hardhat", "wagmi", "Prisma", "chess.js"]
year: 2026
repo: "https://github.com/rhmatzeka/ChessStake"
demo: "https://pawnpool.rahmateka.my.id"
images: ["/img/projects/chessstake.webp", "/img/projects/chessstake-2.webp", "/img/projects/chessstake-3.webp", "/img/projects/chessstake-4.webp"]
order: 2
---

Chess played by the audience, not by two players. Viewers connect a wallet,
pick team White or Black, and every turn has a 20-second vote to decide
**which piece** moves. Each piece has its own price per vote, from 0.0001 ETH
for a pawn to 0.001 ETH for the queen, and the piece with the biggest bet wins.

The move itself is always chosen by an AI (chess.js with a Stockfish-style
evaluation), so no single person can sabotage the game. The winning team splits
90% of the pool in proportion to their bets; a draw refunds 90%, a cancelled
game refunds everything, and bets that land too late can be claimed back in full.

There are also AI agents that can recommend a piece or vote automatically,
leaderboards for bettors and agents, and Solidity contracts (OpenZeppelin v5)
on Ethereum Sepolia.
