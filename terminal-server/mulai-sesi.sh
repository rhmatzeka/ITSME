#!/bin/sh
# Dijalankan ttyd untuk SETIAP pengunjung yang membuka terminal: satu kontainer
# sekali pakai. Pengunjung tidak bisa memberi argumen apa pun ke sini (ttyd
# dijalankan tanpa --url-arg), jadi yang berjalan selalu persis perintah ini.
#
#   --network none          tidak ada internet: tidak bisa dipakai menyerang orang lain
#   --memory/--cpus/--pids  satu pengunjung tidak bisa menghabiskan server
#   --cgroup-parent         SEMUA sesi bersama dikurung mapporto.slice (400 MB,
#                           1 CPU total), jadi bot lain di VPS yang sama aman
#   --read-only + tmpfs     berkas sistem tidak bisa diubah. Yang bisa ditulis cuma
#                           /home/tamu (4 MB) dan /tmp (1 MB): 5 MB per pengunjung,
#                           dan hilang begitu sesinya selesai
#   --cap-drop ALL, no-new-privileges, user 1000   tidak ada jalan naik ke root
#   --rm                    kontainer terhapus begitu sesi selesai
#
# MAPPORTO_RUNTIME=runsc (gVisor, diisi di berkas service): kontainernya
# berjalan di atas kernel tiruan, jadi celah kernel Linux tidak bisa dipakai
# untuk keluar ke server — lihat README.
#
# Paling banyak MAPPORTO_MAKS (3) kontainer sekaligus. Menghitung dan membuat
# kontainer dilakukan di bawah satu kunci, jadi dua pengunjung yang masuk
# bersamaan tidak bisa sama-sama lolos di slot terakhir. Yang kebagian penuh
# cuma melihat pesan di bawah (situsnya sendiri sudah memeriksa status.json
# lebih dulu, jadi ini hanya terjadi kalau benar-benar berebut).
MAKS=${MAPPORTO_MAKS:-3}

penuh() {
  printf '\r\n  \033[1;38;2;255;121;198mThe terminal is full\033[0m\r\n\r\n'
  printf '  %s people are using it right now (max %s).\r\n' "$1" "$MAKS"
  printf '  Please try again in a few minutes.\r\n\r\n'
  sleep 2
  exit 0
}

exec 9>/run/lock/mapporto-sesi.lock
flock -w 15 9 || penuh "$MAKS"
aktif=$(docker ps -aq --filter label=mapporto.sesi=1 | wc -l)
[ "$aktif" -ge "$MAKS" ] && penuh "$aktif"

id=$(docker create -i -t --rm \
  --network none \
  --memory 96m --memory-swap 96m --cpus 0.5 --pids-limit 64 \
  --cgroup-parent mapporto.slice \
  --ulimit nofile=256:256 --ulimit nproc=64:64 \
  --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=1m \
  --tmpfs /home/tamu:rw,nosuid,nodev,size=4m,uid=1000,gid=1000,mode=700 \
  --cap-drop ALL --security-opt no-new-privileges \
  --user 1000:1000 --hostname desa-mapporto \
  --label mapporto.sesi=1 \
  ${MAPPORTO_RUNTIME:+--runtime "$MAPPORTO_RUNTIME"} \
  "${MAPPORTO_IMAGE:-mapporto-sandbox}") || exit 1
exec 9>&-

# Pengunjung menutup monitor -> ttyd mengirim SIGHUP -> kontainernya dibuang
# saat itu juga, slotnya langsung lowong untuk orang berikutnya.
trap 'docker rm -f "$id" >/dev/null 2>&1; exit 0' HUP INT TERM
docker start -a -i "$id"
docker rm -f "$id" >/dev/null 2>&1
exit 0
