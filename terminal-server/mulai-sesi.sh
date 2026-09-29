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
exec docker run --rm -i -t \
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
  mapporto-sandbox
