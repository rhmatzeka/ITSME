# Rekaman suara

Semua rekaman di bawah ini berlisensi **CC0 1.0 (domain publik)** dari
[Freesound](https://freesound.org). Tidak wajib dicantumkan, tapi dicatat
di sini supaya asalnya jelas. Diolah dengan `ffmpeg` + skrip Python:
dipotong, diseragamkan kerasnya, mono 22 kHz, MP3 32 kbps.

| Berkas | Isi | Sumber |
| --- | --- | --- |
| `suara_pria.mp3` | 46 suku kata 160 ms (bank gumam pria) | [Maggie's Diner Documentary Narration](https://freesound.org/s/384982/) — JapanYoshiTheGamer |
| `suara_wanita.mp3` | 42 suku kata 160 ms (bank gumam wanita/anak) | [female_open_source_democracy.wav](https://freesound.org/s/574227/) — a-n-rose |
| `tawa.mp3` | tawa kakek | [Laugh_old_man_6.wav](https://freesound.org/s/166150/), [Low chuckle](https://freesound.org/s/790713/) |
| | tawa bapak | [Man chuckling soft laughter](https://freesound.org/s/823548/), [Various Chuckles_Male.mp3](https://freesound.org/s/643665/) |
| | tawa anak | [Laugh Group of Children.wav](https://freesound.org/s/416703/), [KidsLaughingAtYa.wav](https://freesound.org/s/443133/) |

Tabel potongan (mulai/lama tiap suku kata dan tawa) ada di `src/game/bunyi.ts`;
titik bunyi pertama tiap berkas di `AWAL_SAMPEL`, `src/game/suara.ts`.
