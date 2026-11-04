---
title: "PawnPool"
summary: "Chess where nobody plays alone: the whole crowd plays White against an AI Boss and picks one of three moves every 15 seconds."
stack: ["Next.js", "TypeScript", "Postgres", "Prisma", "Stockfish", "Privy"]
year: 2026
repo: "https://github.com/rhmatzeka/pawnpool"
demo: "https://pawnpool.rahmateka.my.id"
images: ["/img/projects/pawnpool.webp", "/img/projects/pawnpool-2.webp", "/img/projects/pawnpool-3.webp"]
order: 2
---

A community plays chess together against an AI Boss. Every turn the arena shows
three candidate moves from Stockfish, and everyone has 15 seconds to pick one.
The move with the most picks is played, then the Boss replies, until the Boss is
checkmated or the crowd runs out of moves.

You earn points for showing up and more for picking well, based on how close
your pick was to the best move. A live events page lists the next battles, and
the practice arena is always open.

Playing is free and there is no betting. Sponsors pay to run a named event, so
the prizes come from them. Sign-in goes through Privy with email or any wallet.
