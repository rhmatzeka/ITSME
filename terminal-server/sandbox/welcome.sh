#!/bin/bash
# Sambutan terminal pengunjung (dipanggil masuk.sh, dan lewat perintah
# `welcome`/`help`). Tata letaknya mengikuti lebar layar: di HP terminalnya
# cuma ±34 kolom, jadi logo besar dan kolom keterangan hanya muncul kalau muat.
kolom=$(tput cols 2>/dev/null)
[[ $kolom =~ ^[0-9]+$ ]] && ((kolom > 0)) || kolom=80

e=$'\e'
rgb() { printf '%s[38;2;%d;%d;%dm' "$e" "$1" "$2" "$3"; }
B="${e}[1m" N="${e}[0m"
CYAN=$(rgb 0 217 255) PINK=$(rgb 255 121 198) HIJAU=$(rgb 80 250 123)
ORANYE=$(rgb 255 184 108) ABU=$(rgb 108 117 125) PUTIH=$(rgb 230 237 243)

# Tiap huruf diwarnai menurut kolomnya: cyan -> ungu -> pink (warna rifuki).
gradasi() {
  local s=$1 n=$2 i t r g b c
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    [[ $c == ' ' ]] && { printf ' '; continue; }
    t=$((i * 200 / (n > 1 ? n - 1 : 1)))
    if ((t <= 100)); then
      r=$((189 * t / 100)) g=$((217 - 70 * t / 100)) b=$((255 - 6 * t / 100))
    else
      t=$((t - 100)) r=$((189 + 66 * t / 100)) g=$((147 - 26 * t / 100)) b=$((249 - 51 * t / 100))
    fi
    printf '%s[38;2;%d;%d;%dm%s' "$e" "$r" "$g" "$b" "$c"
  done
  printf '%s\n' "$N"
}

LOGO=(
  '██████   █████  ██   ██ ███    ███  █████  ████████'
  '██   ██ ██   ██ ██   ██ ████  ████ ██   ██    ██   '
  '██████  ███████ ███████ ██ ████ ██ ███████    ██   '
  '██   ██ ██   ██ ██   ██ ██  ██  ██ ██   ██    ██   '
  '██   ██ ██   ██ ██   ██ ██      ██ ██   ██    ██   '
)

echo
if ((kolom >= 58)); then
  for baris in "${LOGO[@]}"; do printf '  '; gradasi "$baris" ${#LOGO[0]}; done
  echo
  printf '  %s%sMats OS%s %s·%s %sa real Linux sandbox, made just for you%s\n' "$B" "$PINK" "$N" "$ABU" "$N" "$PUTIH" "$N"
else
  printf ' %s' "$B"; gradasi "RAHMAT'S COMPUTER" 17
  printf ' %s%sMats OS%s %s·%s %sreal Linux sandbox%s\n' "$B" "$PINK" "$N" "$ABU" "$N" "$PUTIH" "$N"
fi
echo

# Aturannya: tiap baris pendek supaya muat di HP tanpa terlipat.
p=$([ "$kolom" -ge 58 ] && echo '  ' || echo ' ')
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
