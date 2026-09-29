# Warna bersama untuk sambutan (welcome) dan logo kecil neofetch di HP.
# Di-source oleh skrip bash, bukan dijalankan sendiri.
e=$'\e'
rgb() { printf '%s[38;2;%d;%d;%dm' "$e" "$1" "$2" "$3"; }
B="${e}[1m" N="${e}[0m"
CYAN=$(rgb 0 217 255) PINK=$(rgb 255 121 198) HIJAU=$(rgb 80 250 123)
ORANYE=$(rgb 255 184 108) ABU=$(rgb 108 117 125) PUTIH=$(rgb 230 237 243)

# Tiap huruf diwarnai menurut kolomnya: cyan -> ungu -> pink (warna rifuki).
# gradasi <teks> <lebar>: <lebar> = lebar baris terpanjang logonya, supaya
# semua baris logo memakai gradasi yang sama dari kiri ke kanan.
gradasi() {
  local s=$1 n=$2 i t r g b c
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    [[ $c == ' ' ]] && { printf ' '; continue; }
    t=$((i * 200 / (n > 1 ? n - 1 : 1)))
    if ((t <= 100)); then
      r=$((189 * t / 100)) g=$((217 - 70 * t / 100)) b=$((255 - 6 * t / 100))
    else
      t=$((t - 100)) r=$((189 + 66 * t / 100)) g=$((147 - 26 * t / 100)) b=$((249 - 51 * t / 100))
    fi
    printf '%s[38;2;%d;%d;%dm%s' "$e" "$r" "$g" "$b" "$c"
  done
  printf '%s\n' "$N"
}
