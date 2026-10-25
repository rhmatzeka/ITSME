#!/usr/bin/env bash
# Pasang terminal pengunjung Desa Mapporto di VPS BARU (Debian/Ubuntu).
#
#   sudo ./pasang.sh terminal.rahmateka.my.id
#
# JANGAN dijalankan di VPS tradebot atau VPS kerja — lihat README.
set -euo pipefail
DOMAIN="${1:?pakai: sudo ./pasang.sh <subdomain terminal, mis. terminal.rahmateka.my.id>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TTYD_VERSI=1.7.7
[ "$(id -u)" = 0 ] || { echo "jalankan dengan sudo"; exit 1; }

echo "== 1/7 Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "== 2/7 gVisor (runsc): kernel tiruan untuk tiap kontainer"
if ! command -v runsc >/dev/null; then
  curl -fsSL https://gvisor.dev/archive.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" > /etc/apt/sources.list.d/gvisor.list
  apt-get -o DPkg::Lock::Timeout=600 update && apt-get -o DPkg::Lock::Timeout=600 install -y runsc
fi
runsc install
systemctl restart docker

echo "== 3/7 ttyd $TTYD_VERSI"
arsi=$(uname -m); [ "$arsi" = aarch64 ] || arsi=x86_64
# unduh ke berkas lain lalu mv: kalau dijalankan ulang, ttyd yang sedang jalan tidak bisa ditimpa
curl -fsSL -o /usr/local/bin/ttyd.baru "https://github.com/tsl0922/ttyd/releases/download/$TTYD_VERSI/ttyd.$arsi"
chmod 755 /usr/local/bin/ttyd.baru
mv -f /usr/local/bin/ttyd.baru /usr/local/bin/ttyd

echo "== 4/7 pengguna layanan"
id mapporto >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin mapporto
usermod -aG docker mapporto

echo "== 5/7 image kamar pasir"
docker build -t mapporto-sandbox "$DIR/sandbox"
"$DIR/pasang-font.sh" /srv/mapporto-font
install -m 755 "$DIR/mulai-sesi.sh" /usr/local/bin/mapporto-sesi
install -m 755 "$DIR/sapu.sh" /usr/local/bin/mapporto-sapu
install -m 755 "$DIR/hitung-sesi.sh" /usr/local/bin/mapporto-hitung
"$DIR/buat-index.sh" /etc/mapporto/ttyd-index.html

echo "== 6/7 layanan systemd"
install -m 644 "$DIR/mapporto.slice" "$DIR/ttyd-mapporto.service" "$DIR/mapporto-sapu.service" "$DIR/mapporto-sapu.timer" "$DIR/mapporto-hitung.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mapporto-hitung.service mapporto-sapu.timer
# restart, bukan cuma enable: kalau dijalankan ulang, pengaturan barunya terpakai
systemctl enable ttyd-mapporto.service && systemctl restart ttyd-mapporto.service

echo "== 7/7 Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  apt-get -o DPkg::Lock::Timeout=600 install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get -o DPkg::Lock::Timeout=600 update && apt-get -o DPkg::Lock::Timeout=600 install -y caddy
fi
# ufw (kalau dipakai) juga harus membuka 80/443, selain firewall di panel VPS
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp
fi
# Cuma blok situs terminal yang diganti: situs lain di Caddyfile yang sama (mis. Kantor AI)
# dan alamat http:// di server yang lewat Cloudflare Tunnel tetap. Konfigurasi rusak -> kembalikan.
command -v python3 >/dev/null || apt-get -o DPkg::Lock::Timeout=600 install -y python3
[ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.sebelum-pasang
python3 "$DIR/caddy-blok.py" "$DOMAIN" "$DIR/Caddyfile.contoh" /etc/caddy/Caddyfile
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  [ -f /etc/caddy/Caddyfile.sebelum-pasang ] && cp /etc/caddy/Caddyfile.sebelum-pasang /etc/caddy/Caddyfile
  echo "   Caddyfile baru tidak valid, yang lama dikembalikan"; exit 1
fi
systemctl reload caddy || systemctl restart caddy

echo "== MATS-BOT (penjawab AI, /tanya lewat Caddy)"
# kuncinya tidak ada di repo: /etc/mapporto/tanya.env (lihat tanya/tanya.env.contoh)
if [ -s /etc/mapporto/tanya.env ] && command -v node >/dev/null; then
  chmod 600 /etc/mapporto/tanya.env
  install -m 644 "$DIR/tanya/mapporto-tanya.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable mapporto-tanya.service && systemctl restart mapporto-tanya.service
else
  echo "   dilewati: isi /etc/mapporto/tanya.env (dan pasang Node) lalu jalankan pasang.sh lagi"
fi

echo "== Desa ramai (pengunjung live + buku tamu, /desa lewat Caddy)"
if command -v node >/dev/null; then
  mkdir -p /etc/mapporto
  if [ ! -s /etc/mapporto/desa.env ]; then
    # kunci acak sekali pakai; DESA_ADMIN_KEY juga diisi di Vercel
    printf 'DESA_RAHASIA=%s\nDESA_ADMIN_KEY=%s\nPUBLIK=https://%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" "$DOMAIN" > /etc/mapporto/desa.env
    echo "   /etc/mapporto/desa.env dibuat; salin DESA_ADMIN_KEY-nya ke Vercel"
  fi
  chmod 600 /etc/mapporto/desa.env
  install -m 644 "$DIR/desa/mapporto-desa.service" /etc/systemd/system/
  systemctl daemon-reload
  if systemctl cat giliran-jaga.timer &>/dev/null || systemctl cat giliran-rumah.timer &>/dev/null; then
    # failover server-mats (giliran) yang menyalakan desa di server yang sedang menerima tunnel,
    # bersama buku tamunya: jangan nyala sendiri saat boot, restart cuma kalau memang sedang jalan
    systemctl disable mapporto-desa.service 2>/dev/null || true
    systemctl try-restart mapporto-desa.service
  else
    systemctl enable mapporto-desa.service && systemctl restart mapporto-desa.service
  fi
else
  echo "   dilewati: pasang Node 22 lalu jalankan pasang.sh lagi"
fi

echo
echo "Selesai. Cek: buka https://$DOMAIN di browser (harus muncul terminal)."
echo "Lalu di Vercel isi PUBLIC_TERMINAL_URL=https://$DOMAIN/ dan redeploy situsnya."
