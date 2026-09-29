#!/bin/sh
# Tiap 2 detik menulis jumlah sesi terminal yang sedang jalan ke status.json,
# yang dibaca situs portfolio (lewat Caddy) sebelum menyalakan monitor: kalau
# sudah penuh, pengunjung diberi pemberitahuan alih-alih terminal yang gagal.
# Dijalankan mapporto-hitung.service; berkasnya ditulis utuh lalu di-rename,
# jadi Caddy tidak pernah menyajikan berkas setengah jadi.
MAKS=${MAPPORTO_MAKS:-3}
DIR=${STATE_DIRECTORY:-/var/lib/mapporto-status}
while :; do
  aktif=$(docker ps -aq --filter label=mapporto.sesi=1 2>/dev/null | wc -l)
  printf '{"aktif":%d,"maks":%d,"t":%d}\n' "$aktif" "$MAKS" "$(date +%s)" > "$DIR/.status.json"
  mv -f "$DIR/.status.json" "$DIR/status.json"
  sleep 2
done
