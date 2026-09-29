#!/bin/sh
# Neovim pengunjung dengan config rifuki (NvChad). Config-nya di
# /etc/mapporto/nvim dan semua plugin di /usr/share/mapporto-nvim — keduanya
# dipasang saat image dibangun dan hanya-baca, jadi tidak memakan jatah 5 MB
# folder rumah. Yang ditulis ke ~ cuma riwayat, undo, dan cache kecil.
export XDG_CONFIG_HOME=/etc/mapporto XDG_DATA_HOME=/usr/share/mapporto-nvim
exec /opt/nvim/bin/nvim "$@"
