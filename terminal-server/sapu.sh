#!/bin/sh
# Jaring pengaman: matikan kontainer sesi yang hidup lebih dari 16 menit.
# Normalnya sesi sudah berakhir sendiri (timeout 15 menit di dalam kontainer,
# atau diam 5 menit), tapi kalau ada yang lolos, di sini ia dibereskan.
# Kontainer yang sudah dibuat tapi tidak pernah dijalankan (mulai-sesi.sh
# terputus di tengah jalan) juga dibuang, supaya tidak memakan slot.
# Dijalankan tiap 5 menit oleh mapporto-sapu.timer.
BATAS=960
sekarang=$(date +%s)
docker ps -q --filter label=mapporto.sesi=1 | while read -r id; do
  mulai=$(date -d "$(docker inspect -f '{{.State.StartedAt}}' "$id")" +%s 2>/dev/null) || continue
  [ $((sekarang - mulai)) -gt $BATAS ] && docker kill "$id" >/dev/null
done
docker ps -aq --filter label=mapporto.sesi=1 --filter status=created | while read -r id; do
  dibuat=$(date -d "$(docker inspect -f '{{.Created}}' "$id")" +%s 2>/dev/null) || continue
  [ $((sekarang - dibuat)) -gt 60 ] && docker rm -f "$id" >/dev/null
done
exit 0
