#!/bin/sh
# Membuat halaman ttyd versi desa: halaman bawaan ttyd (diambil dari ttyd
# sementara di port lain) + gaya-ttyd.html disisipkan sebelum </head>.
# Hasilnya dipakai ttyd-mapporto.service lewat --index.
#   sudo ./buat-index.sh [keluaran]   (bawaan: /etc/mapporto/ttyd-index.html)
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
KELUAR=${1:-/etc/mapporto/ttyd-index.html}
/usr/local/bin/ttyd --interface 127.0.0.1 --port 7690 true >/dev/null 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS -o /tmp/ttyd-asli.html http://127.0.0.1:7690/ 2>/dev/null && break
  sleep 0.5
done
# judul bawaan "ttyd - Terminal" dibuang, diganti judul dari gaya-ttyd.html
sed -i 's|<title>ttyd - Terminal</title>||' /tmp/ttyd-asli.html
# teks pesan ttyd dibuat lebih jelas untuk pengunjung
sed -i -e 's|Press ⏎ to Reconnect|Press Enter for a new session|g' \
  -e 's|"Reconnecting..."|"Connecting…"|g' -e 's|"Connection Closed"|"Session closed"|g' /tmp/ttyd-asli.html
install -d "$(dirname "$KELUAR")"
awk -v f="$DIR/gaya-ttyd.html" '
  !done && /<\/head>/ { while ((getline l < f) > 0) sisip = sisip l "\n"; sub(/<\/head>/, sisip "</head>"); done = 1 }
  { print }' /tmp/ttyd-asli.html > "$KELUAR"
rm -f /tmp/ttyd-asli.html
grep -q 'Mats OS' "$KELUAR"
chmod 644 "$KELUAR"
echo "halaman ttyd: $KELUAR"
