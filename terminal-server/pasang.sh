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

echo "== 1/6 Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "== 2/6 ttyd $TTYD_VERSI"
arsi=$(uname -m); [ "$arsi" = aarch64 ] || arsi=x86_64
curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/$TTYD_VERSI/ttyd.$arsi"
chmod 755 /usr/local/bin/ttyd

echo "== 3/6 pengguna layanan"
id mapporto >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin mapporto
usermod -aG docker mapporto

echo "== 4/6 image kamar pasir"
docker build -t mapporto-sandbox "$DIR/sandbox"
install -m 755 "$DIR/mulai-sesi.sh" /usr/local/bin/mapporto-sesi
install -m 755 "$DIR/sapu.sh" /usr/local/bin/mapporto-sapu

echo "== 5/6 layanan systemd"
install -m 644 "$DIR/ttyd-mapporto.service" "$DIR/mapporto-sapu.service" "$DIR/mapporto-sapu.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ttyd-mapporto.service mapporto-sapu.timer

echo "== 6/6 Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
sed "s/terminal\.rahmateka\.my\.id/$DOMAIN/" "$DIR/Caddyfile.contoh" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo
echo "Selesai. Cek: buka https://$DOMAIN di browser (harus muncul terminal)."
echo "Lalu di Vercel isi PUBLIC_TERMINAL_URL=https://$DOMAIN/ dan redeploy situsnya."
