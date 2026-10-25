#!/usr/bin/env python3
"""Pasang blok situs terminal ke /etc/caddy/Caddyfile tanpa menimpa yang lain.

  caddy-blok.py <domain> <Caddyfile.contoh> <Caddyfile>

Kalau Caddyfile sudah punya blok untuk domain itu (dengan atau tanpa
http:// / https://), cuma isi blok itu yang diganti dengan isi dari contoh;
baris alamatnya tetap (mis. `http://` di server yang lewat Cloudflare Tunnel),
opsi global dan situs lain (Kantor AI, dsb.) tidak disentuh. Kalau belum ada
blok domain itu, Caddyfile diganti contoh seperti pemasangan pertama.
"""
import re
import sys


def kurung(baris):
    # komentar tidak dihitung; isi contoh tidak memakai { } di dalam string
    isi = re.sub(r"^\s*#.*", "", baris)
    return isi.count("{") - isi.count("}")


def cari_blok(baris, domain):
    """Indeks baris alamat dan baris } penutup blok domain, atau None."""
    for i, b in enumerate(baris):
        alamat = re.match(r"^(?:https?://)?(\S+)\s*\{\s*$", b)
        if alamat and alamat.group(1) == domain:
            dalam = kurung(b)
            for j in range(i + 1, len(baris)):
                dalam += kurung(baris[j])
                if dalam == 0:
                    return i, j
            sys.exit(f"blok {domain} di Caddyfile tidak ditutup")
    return None


domain, berkas_contoh, berkas_caddy = sys.argv[1:4]
contoh = open(berkas_contoh).read().replace("terminal.rahmateka.my.id", domain)
try:
    lama = open(berkas_caddy).read()
except FileNotFoundError:
    lama = ""

baris = lama.splitlines(keepends=True)
ada = cari_blok(baris, domain)
if ada is None:
    open(berkas_caddy, "w").write(contoh)
    print("   Caddyfile baru dari contoh")
else:
    baris_contoh = contoh.splitlines(keepends=True)
    c_awal, c_akhir = cari_blok(baris_contoh, domain)
    awal, akhir = ada
    baru = baris[: awal + 1] + baris_contoh[c_awal + 1 : c_akhir] + baris[akhir:]
    open(berkas_caddy, "w").write("".join(baru))
    print(f"   blok {domain} diperbarui, situs lain di Caddyfile tetap")
