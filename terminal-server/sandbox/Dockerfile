# Kamar pasir untuk pengunjung Desa Mapporto: satu kontainer per sesi.
# Dibangun sekali oleh pasang.sh (`docker build -t mapporto-sandbox sandbox/`).

# ---- tahap 1: Neovim + config rifuki (NvChad) ----
# Dibangun terpisah supaya kompiler C (untuk parser treesitter) dan git tidak
# ikut ke image pengunjung. Plugin dipasang persis sesuai lazy-lock.json
# rifuki; parser treesitter untuk bahasa yang ada di contoh-contoh kode.
FROM debian:bookworm-slim AS nvim
ARG NVIM_VERSI=v0.12.5
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gcc libc6-dev tar \
 && curl -fsSL "https://github.com/neovim/neovim/releases/download/${NVIM_VERSI}/nvim-linux-x86_64.tar.gz" | tar -xz -C /opt \
 && mv /opt/nvim-linux-x86_64 /opt/nvim
COPY rifuki/nvim /etc/mapporto/nvim
COPY nvim.sh /usr/local/bin/nvim
ENV HOME=/tmp/bangun
# tema tmux rifuki (catppuccin), versi yang sama dengan di laptop Rahmat
RUN git clone -q https://github.com/catppuccin/tmux /usr/share/mapporto-tmux/catppuccin \
 && git -C /usr/share/mapporto-tmux/catppuccin checkout -q d2d25bd3393fe43f19eb4fff6cdd2bdf5578e622 \
 && rm -rf /usr/share/mapporto-tmux/catppuccin/.git
RUN chmod 755 /usr/local/bin/nvim \
 && nvim --headless "+Lazy! restore" +qa \
 # treesitter di-lazy-load: muat dulu, baru perintah TSInstallSync ada
 && nvim --headless "+Lazy! load nvim-treesitter" "+TSInstallSync! python javascript typescript tsx bash json html css yaml toml" +qa \
 # nvim headless keluar dengan kode 0 walau perintahnya gagal: periksa hasilnya
 && for p in python javascript typescript bash json; do test -f /usr/share/mapporto-nvim/nvim/lazy/nvim-treesitter/parser/$p.so || { echo "parser $p tidak ada"; exit 1; }; done \
 # tema NvChad (base46) dikompilasi sekali di sini, bukan di tiap kontainer
 && nvim --headless -c 'lua require("base46").load_all_highlights()' +qa \
 && ls /usr/share/mapporto-nvim/nvim/base46 \
 && find /usr/share/mapporto-nvim -name .git -prune -exec rm -rf {} + \
 && find /usr/share/mapporto-nvim -type d -name tests -prune -exec rm -rf {} +

# ---- tahap 2: image pengunjung ----
FROM debian:bookworm-slim

# Alat yang wajar untuk "coba-coba ngoding": bahasa, editor, dan beberapa mainan.
# Tidak ada kompiler berat dan tidak ada sudo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash-completion bc ca-certificates coreutils file git jq less nano procps tree \
      fzf ripgrep htop tmux \
      python3 nodejs \
      figlet cowsay sl \
      zsh neofetch curl unzip \
 && rm -rf /var/lib/apt/lists/* \
 # ala dotfiles rifuki: Oh My Zsh + dua plugin + Starship, dipasang di folder
 # sistem (folder rumah pengunjung cuma 4 MB). Diunduh saat image dibuat;
 # kontainer pengunjung sendiri tetap tanpa internet.
 && git clone --depth 1 https://github.com/ohmyzsh/ohmyzsh /usr/share/oh-my-zsh \
 && git clone --depth 1 https://github.com/zsh-users/zsh-autosuggestions /usr/share/oh-my-zsh/custom/plugins/zsh-autosuggestions \
 && git clone --depth 1 https://github.com/zsh-users/zsh-syntax-highlighting /usr/share/oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
 && rm -rf /usr/share/oh-my-zsh/.git /usr/share/oh-my-zsh/custom/plugins/*/.git \
 && curl -fsSL https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin \
 # yazi (pengelola berkas di dotfiles rifuki): satu program statis, tanpa
 # pratinjau berat (ffmpeg, poppler, dll. tidak dipasang)
 && curl -fsSL -o /tmp/yazi.zip "https://github.com/sxyazi/yazi/releases/latest/download/yazi-$(uname -m)-unknown-linux-musl.zip" \
 && unzip -q /tmp/yazi.zip -d /tmp/yazi && install -m 755 /tmp/yazi/*/yazi /tmp/yazi/*/ya /usr/local/bin/ \
 && rm -rf /tmp/yazi /tmp/yazi.zip \
 && apt-get purge -y curl unzip && apt-get autoremove -y \
 # tidak ada program setuid/setgid: jalan naik ke root ditutup dari dalam juga
 && (find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true)

# Neovim + NvChad rifuki dari tahap 1 (config-nya ikut rifuki/ di bawah)
COPY --from=nvim /opt/nvim /opt/nvim
COPY --from=nvim /usr/share/mapporto-nvim /usr/share/mapporto-nvim
COPY --from=nvim /usr/share/mapporto-tmux /usr/share/mapporto-tmux
COPY rifuki/tmux.conf /etc/tmux.conf
COPY nvim.sh /usr/local/bin/nvim

RUN useradd --uid 1000 --create-home --shell /bin/bash tamu
COPY sambutan/ /opt/sambutan/
COPY bashrc /etc/mapporto.bashrc
COPY masuk.sh /usr/local/bin/masuk
COPY welcome.sh /usr/local/bin/welcome
COPY rifuki/ /etc/mapporto/
RUN chmod 755 /usr/local/bin/masuk /usr/local/bin/nvim \
 && chmod -R a+rX /opt/nvim /usr/share/mapporto-nvim /usr/share/mapporto-tmux /etc/tmux.conf \
 # folder sistem tidak bisa dibuka isinya (x tanpa r): program tetap bisa
 # memakai berkas di dalamnya lewat namanya, tapi `ls /etc` dan sejenisnya ditolak
 && chmod 711 / /usr /etc /var /opt /srv /mnt /media /boot /home /usr/local /usr/src /root 2>/dev/null; true \
 && chmod 755 /usr/local/bin/masuk /usr/local/bin/welcome \
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
