/**
 * Prestasi desa: hal-hal kecil yang bisa ditemukan pengunjung di Desa
 * Mapporto — masuk ke semua rumah, menendang bola, bertemu penjual nasi
 * goreng malam-malam, dan seterusnya.
 *
 * Dicatat di browser pengunjung (localStorage). Game mengabarkan kejadiannya
 * lewat event `mapporto:jejak` (Desa.astro meneruskannya ke catat()); yang
 * baru didapat diumumkan MATS-BOT di desa. Tanya MATS-BOT "kasih petunjuk
 * prestasi" / "achievements": dia menunjukkan yang sudah didapat dan
 * petunjuk untuk yang belum (ringkasan()).
 */
import type { Bahasa } from './ingat';

type Teks = [string, string]; // [Inggris, Indonesia]
export type Jejak = { id: string; nama: Teks; petunjuk: Teks; bagian?: string[] };

/** Rumah yang dihitung untuk "Keliling desa": slug panelnya. */
const RUMAH = ['about', 'projects', 'office', 'stack', 'cv', 'contact'];

export const JEJAK: Jejak[] = [
  {
    id: 'rumah',
    nama: ['Door to door', 'Dari pintu ke pintu'],
    petunjuk: ['Step inside all six buildings: About, Projects, AI Office, Tech Stack, CV and Contact.', 'Masuki keenam bangunan: About, Projects, AI Office, Tech Stack, CV, dan Contact.'],
    bagian: RUMAH,
  },
  {
    id: 'mats-bot',
    nama: ['Robot friend', 'Teman robot'],
    petunjuk: ['Ask me anything about Rahmat.', 'Tanya aku apa saja soal Rahmat.'],
  },
  {
    id: 'terminal',
    nama: ['Hacker', 'Peretas'],
    petunjuk: ["Sit at Rahmat's desk, right of the About house, and turn on the terminal.", 'Duduk di meja Rahmat, di kanan rumah About, lalu nyalakan terminalnya.'],
  },
  {
    id: 'warga',
    nama: ['Friendly neighbour', 'Tetangga ramah'],
    petunjuk: ['Tap one of the villagers to chat with them.', 'Ketuk salah satu warga untuk mengobrol.'],
  },
  {
    id: 'bola',
    nama: ['Kick-off', 'Tendangan pertama'],
    petunjuk: ['Find the plastic ball in the field next to the CV house and walk into it.', 'Cari bola plastik di lapangan sebelah rumah CV, lalu tabrak bolanya.'],
  },
  {
    id: 'tur',
    nama: ['Guided tour', 'Tur lengkap'],
    petunjuk: ['Let me take you on a tour, all the way to the last stop.', 'Ikut turku sampai pemberhentian terakhir.'],
  },
  {
    id: 'malam',
    nama: ['Night owl', 'Burung hantu'],
    petunjuk: ['Stay until night falls, or ask me to make it night.', 'Tunggu sampai malam, atau minta aku bikin malam.'],
  },
  {
    id: 'hujan',
    nama: ['Rainy day', 'Kehujanan'],
    petunjuk: ['Get caught in the drizzle. I can start the rain if you ask.', 'Kehujanan gerimis. Aku bisa menurunkan hujan kalau kamu minta.'],
  },
  {
    id: 'kembang-api',
    nama: ['Sparklers', 'Kembang api'],
    petunjuk: ['On some nights the kids play with sparklers next to the CV house. Or ask me to light them.', 'Di malam tertentu anak-anak main kembang api di sebelah rumah CV. Atau minta aku menyalakannya.'],
  },
  {
    id: 'surat',
    nama: ['Village courier', 'Kurir desa'],
    petunjuk: [
      "The courier lost five letters. Find them near the houses and walk each one in through the right front door.",
      'Kurir kehilangan lima surat. Cari di dekat rumah-rumah, lalu antar lewat pintu depan rumah tujuannya.',
    ],
    bagian: ['about', 'projects', 'office', 'cv', 'contact'],
  },
  {
    id: 'tamu',
    nama: ['Signed the book', 'Tanda tangan'],
    petunjuk: ['Leave a message in the guestbook across the road from the Contact house.', 'Tulis pesan di buku tamu di seberang jalan rumah Contact.'],
  },
  {
    id: 'lambai',
    nama: ['Hello, neighbour', 'Halo, tetangga'],
    petunjuk: ['When another visitor is walking around the village, walk up to them and tap them to wave.', 'Kalau ada pengunjung lain di desa, dekati lalu ketuk untuk melambai.'],
  },
  {
    id: 'ikan',
    nama: ['Gone fishing', 'Mancing mania'],
    petunjuk: ['Walk onto the little jetty on the west river, left of the About house, and reel in a catch.', 'Jalan ke dermaga kecil di sungai barat, kiri rumah About, lalu tarik tangkapanmu.'],
  },
  {
    id: 'bintang',
    nama: ['Wish upon a star', 'Bintang jatuh'],
    petunjuk: ['On a clear night, watch the sky for a shooting star and tap it before it fades.', 'Di malam yang cerah, tunggu bintang jatuh melintas lalu ketuk sebelum hilang.'],
  },
  {
    id: 'layar',
    nama: ['Movie night', 'Nonton layar tancap'],
    petunjuk: ['On Saturday nights the village watches an open-air film at the CV field. Sit with them for a bit.', 'Tiap Sabtu malam warga nonton layar tancap di lapangan rumah CV. Ikut nonton sebentar.'],
  },
  {
    id: 'nasgor',
    nama: ['Midnight snack', 'Jajan tengah malam'],
    petunjuk: ['At night a nasi goreng seller pushes his cart along the north road. Tap him to say hi.', 'Malam hari penjual nasi goreng mendorong gerobaknya di jalan utara. Ketuk dia untuk menyapa.'],
  },
];

const KUNCI = 'mapporto:jejak';
type Simpanan = Record<string, true | string[]>;

function baca(): Simpanan {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI) ?? '{}');
    return x && typeof x === 'object' ? (x as Simpanan) : {};
  } catch {
    return {};
  }
}
const selesai = (s: Simpanan, j: Jejak) => (j.bagian ? Array.isArray(s[j.id]) && j.bagian.every((b) => (s[j.id] as string[]).includes(b)) : s[j.id] === true);

/**
 * Catat satu kejadian. Mengembalikan prestasinya kalau BARU SAJA selesai
 * (untuk diumumkan), selain itu undefined.
 */
export function catat(id: string, bagian?: string): Jejak | undefined {
  const j = JEJAK.find((x) => x.id === id);
  if (!j) return;
  const s = baca();
  if (selesai(s, j)) return;
  if (j.bagian) {
    if (!bagian || !j.bagian.includes(bagian)) return;
    const ada = Array.isArray(s[id]) ? (s[id] as string[]) : [];
    if (ada.includes(bagian)) return;
    s[id] = [...ada, bagian];
  } else {
    s[id] = true;
  }
  try {
    localStorage.setItem(KUNCI, JSON.stringify(s));
  } catch {
    return; // tidak bisa disimpan: jangan umumkan sesuatu yang besok hilang
  }
  return selesai(s, j) ? j : undefined;
}

export function progres() {
  const s = baca();
  const dapat = JEJAK.filter((j) => selesai(s, j));
  return { dapat: dapat.length, total: JEJAK.length, s };
}

/** Kalimat MATS-BOT saat prestasi baru didapat. */
export function pengumuman(j: Jejak, b: Bahasa) {
  const { dapat, total } = progres();
  const i = b === 'id' ? 1 : 0;
  return b === 'id'
    ? `Prestasi baru: ${j.nama[i]}! (${dapat}/${total}) Tanya aku kalau mau petunjuk yang lain.`
    : `Achievement unlocked: ${j.nama[i]}! (${dapat}/${total}) Ask me for hints to find the rest.`;
}

/** Jawaban untuk "petunjuk prestasi": yang sudah didapat, lalu petunjuk untuk sampai tiga yang belum. */
export function ringkasan(b: Bahasa) {
  const { dapat, total, s } = progres();
  const i = b === 'id' ? 1 : 0;
  const sudah = JEJAK.filter((j) => selesai(s, j)).map((j) => `✓ ${j.nama[i]}`);
  const belum = JEJAK.filter((j) => !selesai(s, j));
  const petunjuk = belum.slice(0, 3).map((j) => {
    const n = j.bagian && Array.isArray(s[j.id]) ? ` (${(s[j.id] as string[]).length}/${j.bagian.length})` : '';
    return `• ${j.nama[i]}${n}: ${j.petunjuk[i]}`;
  });
  if (!belum.length)
    return b === 'id'
      ? `Hebat, kamu sudah mendapat semua ${total} prestasi desa! Rahmat pasti senang.`
      : `Amazing, you found all ${total} village achievements! Rahmat would be proud.`;
  const kepala = b === 'id' ? `Kamu sudah mendapat ${dapat} dari ${total} prestasi desa.` : `You have ${dapat} of ${total} village achievements.`;
  const bawah = b === 'id' ? 'Petunjuk berikutnya:' : 'Hints for the next ones:';
  return [kepala, ...sudah, '', bawah, ...petunjuk].join('\n');
}
