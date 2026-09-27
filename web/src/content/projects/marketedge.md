---
title: "MarketEdge"
summary: "Aplikasi pasar dan berita keuangan Android ala Investing.com: harga kripto, forex, dan emas, grafik, watchlist, plus asisten chat WarrenAI."
stack: ["Kotlin", "Android", "Material Components", "CoinGecko API", "Groq"]
year: 2026
repo: "https://github.com/rhmatzeka/MarketEdge"
order: 2
---

Aplikasi Android untuk memantau pasar dan berita keuangan, bergaya Investing.com
dengan tema gelap dan aksen oranye. Daftar harga kripto, forex, emas, dan perak
yang ringkas; halaman detail instrumen dengan grafik harga berjangka waktu,
statistik kunci (bid/ask, rentang harian dan 52 minggu, volume, market cap);
berita terbaru; dan watchlist yang bisa diatur sendiri.

**WarrenAI** menjawab pertanyaan memakai data pasar dan berita yang baru saja
dimuat aplikasi, dan tetap bisa dipakai walau tanpa API key. Semua datanya dari
feed publik gratis — CoinGecko, order book publik Coinbase, feed mata uang, dan
Spaceflight News — dengan status muat, galat, dan coba lagi kalau salah satunya
sedang mati.

Ditulis dengan Kotlin tanpa pustaka jaringan tambahan: tampilan Android dibangun
lewat kode, grafik memakai `SparklineView` buatan sendiri, dan susunan kodenya
dipisah jadi `data`, `domain`, dan `presentation`.
