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
curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/$TTYD_VERSI/ttyd.$arsi"
chmod 755 /usr/local/bin/ttyd

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
sed "s/terminal\.rahmateka\.my\.id/$DOMAIN/" "$DIR/Caddyfile.contoh" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo
echo "Selesai. Cek: buka https://$DOMAIN di browser (harus muncul terminal)."
echo "Lalu di Vercel isi PUBLIC_TERMINAL_URL=https://$DOMAIN/ dan redeploy situsnya."
