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
      zsh neofetch curl \
 && rm -rf /var/lib/apt/lists/* \
 # ala dotfiles rifuki: Oh My Zsh + dua plugin + Starship, dipasang di folder
 # sistem (folder rumah pengunjung cuma 4 MB). Diunduh saat image dibuat;
 # kontainer pengunjung sendiri tetap tanpa internet.
 && git clone --depth 1 https://github.com/ohmyzsh/ohmyzsh /usr/share/oh-my-zsh \
 && git clone --depth 1 https://github.com/zsh-users/zsh-autosuggestions /usr/share/oh-my-zsh/custom/plugins/zsh-autosuggestions \
 && git clone --depth 1 https://github.com/zsh-users/zsh-syntax-highlighting /usr/share/oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
 && rm -rf /usr/share/oh-my-zsh/.git /usr/share/oh-my-zsh/custom/plugins/*/.git \
 && curl -fsSL https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin \
 && apt-get purge -y curl && apt-get autoremove -y \
 # tidak ada program setuid/setgid: jalan naik ke root ditutup dari dalam juga
 && (find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true)

RUN useradd --uid 1000 --create-home --shell /bin/bash tamu
COPY sambutan/ /opt/sambutan/
COPY bashrc /etc/mapporto.bashrc
COPY masuk.sh /usr/local/bin/masuk
COPY rifuki/ /etc/mapporto/
RUN chmod 755 /usr/local/bin/masuk \
 # folder sistem tidak bisa dibuka isinya (x tanpa r): program tetap bisa
 # memakai berkas di dalamnya lewat namanya, tapi `ls /etc` dan sejenisnya ditolak
 && chmod 711 / /usr /etc /var /opt /srv /mnt /media /boot /home /usr/local /usr/src /root 2>/dev/null; true \
 && chmod 755 /usr/local/bin/masuk \
 && chmod -R a+rX /opt/sambutan /etc/mapporto.bashrc \
 && printf '\n. /etc/mapporto.bashrc\n' >> /etc/bash.bashrc \
 && printf '\nsource /etc/mapporto/zshrc\n' >> /etc/zsh/zshrc \
 && chmod -R a+rX /etc/mapporto /usr/share/oh-my-zsh \
 && usermod -s /bin/zsh tamu \
 # cache completion zsh dibangun sekali di sini, sebagai tamu dengan rumah yang
 # sama seperti saat sesi (fpath harus sama persis, kalau beda dibangun ulang)
 && install -d -o tamu /usr/share/oh-my-zsh/dump \
 && su -s /bin/sh tamu -c 'HOME=/home/tamu zsh -ic exit; zsh -fc "zcompile /usr/share/oh-my-zsh/dump/zcompdump"' \
 && chown -R root:root /usr/share/oh-my-zsh/dump && chmod -R a+rX /usr/share/oh-my-zsh/dump \
 && ls -la /usr/share/oh-my-zsh/dump && rm -rf /home/tamu/.cache

USER tamu
WORKDIR /home/tamu
ENV HOME=/home/tamu LANG=C.UTF-8 TERM=xterm-256color
ENTRYPOINT ["/usr/local/bin/masuk"]
