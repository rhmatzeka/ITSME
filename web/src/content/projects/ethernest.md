---
title: "Ethernest"
summary: "A multi-chain crypto wallet for Android: nine EVM networks, swaps through its own pool, and buying ETH with rupiah via Midtrans."
stack: ["Java", "Android", "Web3j", "Solidity", "Hardhat", "Express"]
year: 2026
repo: "https://github.com/rhmatzeka/EthernestMobileApps"
images: ["/img/projects/ethernest.webp", "/img/projects/ethernest-2.webp", "/img/projects/ethernest-3.webp", "/img/projects/ethernest-4.webp", "/img/projects/ethernest-5.webp"]
order: 1
---

An Android crypto wallet built with Java and Web3j. Nine EVM networks come
preconfigured — Ethereum, Sepolia, BSC, Avalanche, Polygon, Arbitrum,
Optimism, Base, Fantom — and you can add your own RPCs. ETH and ERC-20
balances, 721/1155 NFTs, candlestick charts, send and receive via QR, and swaps
against a pool whose contracts live in the same repo.

The most interesting part to build: buying ETH with rupiah. The private key
never touches that flow — the app only creates an order, and the backend
creates the Midtrans transaction and sends ETH from the treasury once the
payment clears. The ETH/IDR price is computed on the server from CoinGecko,
with Indodax and then Binance as fallbacks.
