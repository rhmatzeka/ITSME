#!/bin/bash
# Dijalankan tiap kali kontainer sesi dimulai. /home/tamu adalah tmpfs kosong,
# jadi berkas contoh disalin ke sana dulu, sambutan ditampilkan, lalu zsh dibuka.
# `timeout` di sini adalah batas waktu yang ditegakkan dari DALAM kontainer:
# bash interaktif mengabaikan SIGTERM dari luar, tapi tidak bisa mengabaikan
# proses induknya sendiri yang berhenti.
cp -r /opt/sambutan/. "$HOME"/ 2>/dev/null
welcome
# shell pengunjung: zsh ala dotfiles rifuki (lihat rifuki/zshrc); bash tetap ada
timeout --foreground --kill-after=5s 15m zsh --login
kode=$?
# Pamit yang jelas, bukan layar yang tiba-tiba putus. Setelah ini ttyd
# menampilkan "Press ⏎ to Reconnect" (auto-reconnect dimatikan di service).
case $kode in
  124 | 137) alasan='the 15-minute limit is up' ;;
  *) alasan='' ;;  # exit, atau diam 5 menit (kode keluar zsh tidak membedakannya)
esac
printf '\n  \033[1;38;2;255;121;198m● session ended\033[0m%s\n' "${alasan:+ — $alasan}"
printf '  \033[38;2;108;117;125myour sandbox was wiped. Press Enter for a fresh one.\033[0m\n\n'
sleep 1
