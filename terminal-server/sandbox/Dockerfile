# Kamar pasir untuk pengunjung Desa Mapporto: satu kontainer per sesi.
# Dibangun sekali oleh pasang.sh (`docker build -t mapporto-sandbox sandbox/`).
FROM debian:bookworm-slim

# Alat yang wajar untuk "coba-coba ngoding": bahasa, editor, dan beberapa mainan.
# Tidak ada kompiler berat dan tidak ada sudo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash-completion bc ca-certificates coreutils file git jq less nano neovim procps tree \
      python3 nodejs \
      figlet cowsay sl \
 && rm -rf /var/lib/apt/lists/* \
 # tidak ada program setuid/setgid: jalan naik ke root ditutup dari dalam juga
 && find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

RUN useradd --uid 1000 --create-home --shell /bin/bash tamu
COPY sambutan/ /opt/sambutan/
COPY bashrc /etc/mapporto.bashrc
COPY masuk.sh /usr/local/bin/masuk
RUN chmod 755 /usr/local/bin/masuk \
 # folder sistem tidak bisa dibuka isinya (x tanpa r): program tetap bisa
 # memakai berkas di dalamnya lewat namanya, tapi `ls /etc` dan sejenisnya ditolak
 && chmod 711 / /usr /etc /var /opt /srv /mnt /media /boot /home /usr/local /usr/src /root 2>/dev/null; true \
 && chmod 755 /usr/local/bin/masuk \
 && chmod -R a+rX /opt/sambutan /etc/mapporto.bashrc \
 && printf '\n. /etc/mapporto.bashrc\n' >> /etc/bash.bashrc

USER tamu
WORKDIR /home/tamu
ENV HOME=/home/tamu LANG=C.UTF-8 TERM=xterm-256color
ENTRYPOINT ["/usr/local/bin/masuk"]
