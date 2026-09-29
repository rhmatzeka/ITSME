#!/bin/bash
# Dijalankan tiap kali kontainer sesi dimulai. /home/tamu adalah tmpfs kosong,
# jadi berkas sambutan disalin ke sana dulu, lalu bash interaktif dibuka.
# `timeout` di sini adalah batas waktu yang ditegakkan dari DALAM kontainer:
# bash interaktif mengabaikan SIGTERM dari luar, tapi tidak bisa mengabaikan
# proses induknya sendiri yang berhenti.
cp -r /opt/sambutan/. "$HOME"/ 2>/dev/null
cat "$HOME/.sambutan" 2>/dev/null
# shell pengunjung: zsh ala dotfiles rifuki (lihat rifuki/zshrc); bash tetap ada
exec timeout --foreground --kill-after=5s 15m zsh --login
