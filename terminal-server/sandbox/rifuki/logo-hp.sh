#!/bin/bash
# Logo neofetch untuk layar sempit (HP, di bawah 75 kolom): logo Miku butuh
# ±75 kolom, jadi di HP neofetch dijalankan tanpa logo (--off) dan logo kecil
# ini dicetak di atasnya — tulisan MATS OS dua baris, 25 kolom, bergradasi.
. /etc/mapporto/gradasi.sh
LOGO=(
  '█▀▄▀█ ▄▀█ ▀█▀ █▀   █▀█ █▀'
  '█ ▀ █ █▀█  █  ▄█   █▄█ ▄█'
)
echo
for baris in "${LOGO[@]}"; do gradasi "$baris" ${#LOGO[0]}; done
echo
