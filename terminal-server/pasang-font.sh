#!/bin/sh
# Font terminal pengunjung: JetBrainsMono Nerd Font Mono, font yang sama
# dengan terminal Rahmat. Disajikan Caddy di /fonts/ dan dimuat halaman ttyd
# (gaya-ttyd.html), jadi ikon NvChad, yazi, dan Starship tampil di browser
# siapa pun — pengunjung tidak perlu memasang Nerd Font sendiri. Varian
# "Mono": ikonnya tepat satu kotak, jadi grid xterm tidak bergeser.
#   sudo ./pasang-font.sh [folder]   (bawaan: /srv/mapporto-font)
set -eu
KE=${1:-/srv/mapporto-font}
[ -s "$KE/JetBrainsMonoNerdFontMono-Regular.ttf" ] && [ -s "$KE/JetBrainsMonoNerdFontMono-Bold.ttf" ] && { echo "font sudah ada di $KE"; exit 0; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/jb.tar.xz" https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.tar.xz
tar -xJf "$tmp/jb.tar.xz" -C "$tmp" JetBrainsMonoNerdFontMono-Regular.ttf JetBrainsMonoNerdFontMono-Bold.ttf
install -d -m 755 "$KE"
install -m 644 "$tmp"/JetBrainsMonoNerdFontMono-*.ttf "$KE"/
echo "font terpasang di $KE"
