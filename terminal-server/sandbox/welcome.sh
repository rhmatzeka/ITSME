#!/bin/bash
# Sambutan terminal pengunjung (dipanggil masuk.sh, dan lewat perintah
# `welcome`/`help`). Tata letaknya mengikuti lebar layar: di HP terminalnya
# cuma ±34 kolom, jadi logo besar dan kolom keterangan hanya muncul kalau muat.
kolom=$(tput cols 2>/dev/null)
[[ $kolom =~ ^[0-9]+$ ]] && ((kolom > 0)) || kolom=80

# warna dan gradasi dipakai bersama logo kecil neofetch (rifuki/gradasi.sh)
. /etc/mapporto/gradasi.sh
baris=$(tput lines 2>/dev/null)
[[ $baris =~ ^[0-9]+$ ]] && ((baris > 0)) || baris=24

LOGO=(
  '██████   █████  ██   ██ ███    ███  █████  ████████'
  '██   ██ ██   ██ ██   ██ ████  ████ ██   ██    ██   '
  '██████  ███████ ███████ ██ ████ ██ ███████    ██   '
  '██   ██ ██   ██ ██   ██ ██  ██  ██ ██   ██    ██   '
  '██   ██ ██   ██ ██   ██ ██      ██ ██   ██    ██   '
)
# versi HP: dua baris setengah-blok, 25 kolom, bentuk hurufnya sama
LOGO_HP=(
  '█▀█ ▄▀█ █ █ █▀▄▀█ ▄▀█ ▀█▀'
  '█▀▄ █▀█ █▀█ █ ▀ █ █▀█  █ '
)

# Aturannya: tiap baris pendek supaya muat di HP tanpa terlipat.
p=$( ((kolom >= 58)) && echo '  ' || echo ' ')
# baris kosong di atas hanya kalau layarnya cukup tinggi (monitor desktop cuma ±20 baris)
((baris >= 24)) && echo
# logo besar hanya kalau muat lebar DAN tingginya (5 baris + sambutan ±20
# baris); kalau tidak, bagian atasnya langsung tergulung keluar layar
if ((kolom >= 58 && baris >= 30)); then
  for l in "${LOGO[@]}"; do printf '  '; gradasi "$l" ${#LOGO[0]}; done
  echo
  printf '  %s%sMats OS%s %s·%s %sa real Linux sandbox, made just for you%s\n' "$B" "$PINK" "$N" "$ABU" "$N" "$PUTIH" "$N"
else
  for l in "${LOGO_HP[@]}"; do printf '%s' "$p"; gradasi "$l" ${#LOGO_HP[0]}; done
  printf '%s%s%sMats OS%s %s·%s %sreal Linux sandbox%s\n' "$p" "$B" "$PINK" "$N" "$ABU" "$N" "$PUTIH" "$N"
fi
echo

garis() { printf '%s%s▍%s %s\n' "$p" "$CYAN" "$N" "$1"; }
if ((kolom >= 46)); then
  garis "you are ${B}${CYAN}tamu${N}, with a ${B}5 MB${N} home (~)"
  garis "no internet · ${B}15 min${N} max · 5 min idle"
  garis "wiped when you turn the monitor off"
else
  garis "you're ${B}${CYAN}tamu${N} · ${B}5 MB${N} home"
  garis "no internet · ${B}15 min${N} max"
  garis "wiped when you close it"
fi
echo

printf '%s%s%stry these%s\n' "$p" "$B" "$ORANYE" "$N"
# coba <perintah> <keterangan> <keterangan pendek untuk HP>
coba() {
  if ((kolom >= 46)); then
    printf '%s  %s%-18s%s %s%s%s\n' "$p" "$HIJAU" "$1" "$N" "$ABU" "$2" "$N"
  elif ((kolom >= 33)); then
    printf '%s %s%-17s%s%s%s%s\n' "$p" "$HIJAU" "$1" "$N" "$ABU" "$3" "$N"
  else
    printf '%s %s%s%s\n' "$p" "$HIJAU" "$1" "$N"
  fi
}
coba 'ls' 'look around' 'look around'
coba 'cat README.txt' 'who made this' 'who made this'
coba 'python3 hello.py' 'run some Python' 'run Python'
coba 'node hello.js' 'or JavaScript' 'run JavaScript'
coba 'nvim hello.py' 'edit (i · Esc · :wq)' 'edit a file'
coba 'y' 'yazi file manager' 'file manager'
coba 'neofetch' 'system info' 'system info'
coba 'welcome' 'show this again' 'this again'
echo
