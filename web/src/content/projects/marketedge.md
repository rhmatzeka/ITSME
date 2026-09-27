---
title: "MarketEdge"
summary: "An Investing.com-style Android app for markets and financial news: crypto, forex, and gold prices, charts, a watchlist, and the WarrenAI chat assistant."
stack: ["Kotlin", "Android", "Material Components", "CoinGecko API", "Groq"]
year: 2026
repo: "https://github.com/rhmatzeka/MarketEdge"
images: ["/img/projects/marketedge.webp", "/img/projects/marketedge-2.webp", "/img/projects/marketedge-3.webp", "/img/projects/marketedge-4.webp", "/img/projects/marketedge-5.webp", "/img/projects/marketedge-6.webp"]
order: 2
---

An Android app for following markets and financial news, styled after
Investing.com with a dark theme and orange accents. A compact price list for
crypto, forex, gold, and silver; instrument pages with price charts across time
ranges and key stats (bid/ask, daily and 52-week range, volume, market cap);
the latest news; and a watchlist you arrange yourself.

**WarrenAI** answers questions using the market data and news the app just
loaded, and still works without an API key. All data comes from free public
feeds — CoinGecko, Coinbase's public order book, a currency feed, and
Spaceflight News — with loading, error, and retry states when one of them is
down.

Written in Kotlin with no extra networking libraries: the Android views are
built in code, charts use a custom `SparklineView`, and the code is split into
`data`, `domain`, and `presentation`.
