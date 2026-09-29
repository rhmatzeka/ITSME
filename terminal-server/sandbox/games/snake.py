#!/usr/bin/env python3
"""snake — ular-ularan untuk terminal pengunjung Desa Mapporto.

Ditulis sendiri (bukan paket nsnake) karena nsnake menolak jalan di layar
lebih kecil dari 80x24, sedangkan monitor di desa cuma ±93x20 di desktop dan
±45 kolom di HP. Ukuran arenanya mengikuti layar, sekecil apa pun.

Kontrol: panah, WASD, atau hjkl (papan ketik HP tidak punya panah)
         p jeda, q keluar, r main lagi setelah kalah.
Kodenya pendek dan boleh dibaca: `cat $(which snake)`.
"""
import curses
import random
import time

ARAH = {
    curses.KEY_UP: (-1, 0), ord("w"): (-1, 0), ord("k"): (-1, 0),
    curses.KEY_DOWN: (1, 0), ord("s"): (1, 0), ord("j"): (1, 0),
    curses.KEY_LEFT: (0, -1), ord("a"): (0, -1), ord("h"): (0, -1),
    curses.KEY_RIGHT: (0, 1), ord("d"): (0, 1), ord("l"): (0, 1),
}


def main(layar):
    curses.curs_set(0)
    layar.nodelay(True)
    layar.keypad(True)
    curses.start_color()
    curses.use_default_colors()
    for i, warna in enumerate((curses.COLOR_GREEN, curses.COLOR_RED, curses.COLOR_YELLOW, curses.COLOR_CYAN), 1):
        curses.init_pair(i, warna, -1)
    while main_sekali(layar):
        pass


def tulis(layar, y, x, teks, gaya=0):
    try:
        layar.addstr(y, x, teks, gaya)
    except curses.error:
        pass  # sudut kanan bawah layar: curses mengeluh, tapi tulisannya sudah tampil


def main_sekali(layar):
    tinggi, lebar = layar.getmaxyx()
    # satu petak = dua kolom, supaya ularnya tampak persegi
    baris, kolom = tinggi - 3, (lebar - 2) // 2
    if baris < 5 or kolom < 8:
        layar.clear()
        tulis(layar, 0, 0, "Screen too small for snake :(")
        layar.refresh()
        time.sleep(2)
        return False
    tengah = (baris // 2, kolom // 2)
    ular = [tengah, (tengah[0], tengah[1] - 1), (tengah[0], tengah[1] - 2)]
    arah = (0, 1)
    skor = 0
    jeda = False

    def taruh_makanan():
        while True:
            m = (random.randrange(baris), random.randrange(kolom))
            if m not in ular:
                return m

    makanan = taruh_makanan()
    while True:
        # masukan: ambil tombol terakhir yang ditekan sejak langkah sebelumnya
        tombol = -1
        while True:
            t = layar.getch()
            if t == -1:
                break
            tombol = t
        if tombol in (ord("q"), 27):
            return False
        if tombol == curses.KEY_RESIZE:
            return True
        if tombol == ord("p"):
            jeda = not jeda
        baru = ARAH.get(tombol)
        if baru and (baru[0] != -arah[0] or baru[1] != -arah[1]):
            arah = baru

        if not jeda:
            kepala = ((ular[0][0] + arah[0]) % baris, (ular[0][1] + arah[1]) % kolom)
            if kepala in ular:
                return kalah(layar, skor, tinggi, lebar)
            ular.insert(0, kepala)
            if kepala == makanan:
                skor += 1
                makanan = taruh_makanan()
            else:
                ular.pop()

        layar.erase()
        tulis(layar, 0, 1, f" SNAKE  score {skor} ", curses.color_pair(3) | curses.A_BOLD)
        petunjuk = " wasd/arrows · p pause · q quit " if lebar >= 52 else " wasd · q quit "
        tulis(layar, 0, max(len(f" SNAKE  score {skor} ") + 2, lebar - len(petunjuk) - 1), petunjuk, curses.A_DIM)
        # bingkai arena
        tulis(layar, 1, 0, "┌" + "─" * (kolom * 2) + "┐", curses.color_pair(4))
        for y in range(baris):
            tulis(layar, 2 + y, 0, "│", curses.color_pair(4))
            tulis(layar, 2 + y, kolom * 2 + 1, "│", curses.color_pair(4))
        tulis(layar, 2 + baris, 0, "└" + "─" * (kolom * 2) + "┘", curses.color_pair(4))
        tulis(layar, 2 + makanan[0], 1 + makanan[1] * 2, "◆ ", curses.color_pair(2) | curses.A_BOLD)
        for i, (y, x) in enumerate(ular):
            tulis(layar, 2 + y, 1 + x * 2, "██" if i == 0 else "▓▓", curses.color_pair(1) | (curses.A_BOLD if i == 0 else 0))
        if jeda:
            tulis(layar, 2 + baris // 2, max(1, kolom - 3), " PAUSED ", curses.A_REVERSE)
        layar.refresh()
        # makin panjang makin cepat
        time.sleep(max(0.06, 0.16 - skor * 0.004))


def kalah(layar, skor, tinggi, lebar):
    pesan = [" GAME OVER ", f" score {skor} ", " r = again · q = quit "]
    for i, p in enumerate(pesan):
        tulis(layar, tinggi // 2 - 1 + i, max(0, (lebar - len(p)) // 2), p, curses.A_REVERSE | curses.A_BOLD)
    layar.refresh()
    layar.nodelay(False)
    while True:
        t = layar.getch()
        if t == ord("r"):
            layar.nodelay(True)
            return True
        if t in (ord("q"), 27):
            return False


if __name__ == "__main__":
    try:
        curses.wrapper(main)
    except KeyboardInterrupt:
        pass
