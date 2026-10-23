import Phaser from 'phaser';
import { dor, gumam, laguUltah, siulRoket, tawa, type JenisSuara } from '../bunyi';
import { ACARA, DEPTH, PLAYER, kedalaman, type Dir } from '../config';
import { GAMBAR_ACARA } from './AcaraGambar';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatPanjat, buatPoseLompat } from './Rupa';
import { Umbul } from './Umbul';
import { bisaDiajak, tanganTerangkat } from './Warga';

/* ---------------- kalender ---------------- */

export type JenisAcara = 'tujuhbelas' | 'lomba' | 'pasar' | 'ultah' | 'tahunbaru';
const SEMUA: JenisAcara[] = ['tujuhbelas', 'lomba', 'pasar', 'ultah', 'tahunbaru'];

/**
 * `?acara=pasar,ultah` di alamat memaksa acara itu tampil hari ini — untuk
 * melihat acara yang jatuh di hari lain tanpa mengubah jam komputer.
 * `?acara=semua` menyalakan semuanya.
 */
let paksaanTersimpan: Set<JenisAcara> | undefined;
function paksaan(): Set<JenisAcara> {
  if (paksaanTersimpan) return new Set(paksaanTersimpan);
  paksaanTersimpan = bacaPaksaan();
  return new Set(paksaanTersimpan);
}
function bacaPaksaan(): Set<JenisAcara> {
  try {
    const q = new URLSearchParams(location.search).get('acara');
    if (!q) return new Set();
    const daftar = q === 'semua' ? SEMUA : (q.split(',') as JenisAcara[]).filter((a) => SEMUA.includes(a));
    // lomba tanpa hiasan Agustus terasa janggal
    if (daftar.includes('lomba')) daftar.push('tujuhbelas');
    return new Set(daftar);
  } catch {
    return new Set();
  }
}

/** Acara yang berlangsung pada saat `d` menurut jam pengunjung. */
export function acaraPada(d: Date): Set<JenisAcara> {
  const a = paksaan();
  const bulan = d.getMonth();
  const tgl = d.getDate();
  const jam = d.getHours();
  if (bulan === 7) a.add('tujuhbelas');
  if (bulan === 7 && tgl >= ACARA.lomba.dari && tgl <= ACARA.lomba.sampai) a.add('lomba');
  if (d.getDay() === 5 && jam >= ACARA.pasar.buka && jam < ACARA.pasar.tutup) a.add('pasar');
  if (bulan === ACARA.ultah.bulan - 1 && tgl === ACARA.ultah.tanggal) a.add('ultah');
  if ((bulan === 11 && tgl === 31 && jam >= 18) || (bulan === 0 && tgl === 1)) a.add('tahunbaru');
  return a;
}

/** Pengumuman MATS-BOT untuk acara yang sedang berlangsung. */
const KABAR: Record<JenisAcara, string> = {
  tujuhbelas: 'It is August, so the village is decked out in red and white for Independence Day!',
  lomba: 'Independence Day games are on! Someone is trying the greasy pole by the CV house — go cheer them on.',
  pasar: 'It is Friday afternoon, so the pop-up market is open on the north road. The fried snacks smell amazing.',
  ultah: "Today is Rahmat's birthday! The neighbours made a tumpeng next to the Projects house.",
  tahunbaru: 'Happy New Year! Look up, the fireworks are going off over the village.',
};

/* ---------------- huruf spanduk ---------------- */

/** Huruf piksel 3×5 untuk tulisan di spanduk kain. */
const HURUF: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  W: '101101111111101', Y: '101101010010010', '0': '111101101101111', '1': '010110010010111',
  '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110',
  '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110',
  '!': '010010010000010', ' ': '000000000000000',
};

/**
 * Spanduk kain bertiang bambu dua: tulisannya baris per baris, huruf 3×5.
 * Digambar ke kanvas sekali; kuncinya dari isi tulisannya.
 */
function spanduk(scene: Phaser.Scene, baris: string[], kain: string, tulisan: string, tinggiTiang: number) {
  const key = `spanduk_${baris.join('_').replace(/[^A-Z0-9]/g, '')}_${kain.slice(1)}`;
  const tx = scene.textures;
  if (tx.exists(key)) return key;
  const lebarTeks = Math.max(...baris.map((b) => b.length * 4 - 1));
  const w = lebarTeks + 10;
  const tinggiKain = baris.length * 6 + 4;
  const h = tinggiKain + tinggiTiang;
  const k = tx.createCanvas(key, w, h)!;
  const c = k.getContext();
  const kotak = (x: number, y: number, lw: number, lh: number, warna: string) => {
    c.fillStyle = warna;
    c.fillRect(x, y, lw, lh);
  };
  // tiang bambu beruas (tanpa tiang: kain saja, untuk ditempel di meja)
  for (const x of tinggiTiang ? [1, w - 3] : []) {
    kotak(x - 1, 0, 4, h, '#2a1c14');
    kotak(x, 0, 2, h, '#c8a050');
    for (let y = 6; y < h; y += 7) kotak(x, y, 2, 1, '#9a7a38');
  }
  // kain, sedikit melendut di tengah bawah
  kotak(3, 1, w - 6, tinggiKain, '#2a1c14');
  kotak(4, 2, w - 8, tinggiKain - 2, kain);
  kotak(4, tinggiKain - 2, w - 8, 1, 'rgba(0,0,0,0.18)');
  baris.forEach((b, i) => {
    const x0 = Math.round((w - (b.length * 4 - 1)) / 2);
    const y0 = 4 + i * 6;
    [...b].forEach((ch, n) => {
      const pola = HURUF[ch] ?? HURUF[' '];
      for (let p = 0; p < 15; p++) if (pola[p] === '1') kotak(x0 + n * 4 + (p % 3), y0 + Math.floor(p / 3), 1, 1, tulisan);
    });
  });
  k.refresh();
  return key;
}

/* ---------------- bantu: warga tambahan ---------------- */

/** Sprite warga diam dengan bayangan kaki, menghadap `arah`. */
function wargaDiam(scene: Phaser.Scene, rupa: string, x: number, kaki: number, arah: Dir, skala = 1) {
  Player.registerAnimations(scene, rupa);
  const s = scene.add.sprite(x, kaki - PLAYER.baseY * skala, rupa, 0).setScale(skala).setDepth(kedalaman(kaki));
  s.play(`${rupa}_idle_${arah}`);
  const b = scene.add
    .image(x, kaki - 1, bayanganKaki(scene))
    .setScale(skala)
    .setAlpha(BAYANGAN_KAKI)
    .setDepth(kedalaman(kaki) - 0.5);
  return { s, b };
}

/** Skala anak kecil (dua pertiga orang dewasa), dibulatkan ke piksel layar. */
function skalaAnak(scene: Phaser.Scene) {
  const z = scene.cameras.main.zoom;
  return Math.max(1, Math.round(z * 0.67)) / z;
}

/* ---------------- acara ---------------- */

/**
 * Acara kalender desa: pengunjung yang datang di hari berbeda melihat desa
 * yang berbeda.
 *
 * - Agustus: umbul-umbul merah putih tambahan di sepanjang jalan tengah.
 * - 15-20 Agustus: lomba panjat pinang di lapangan rumah CV, di sebelah
 *   tiang bendera — seorang anak memanjat, merosot karena licin, mencoba
 *   lagi, dan dua temannya bersorak.
 * - Jumat sore: pasar kaget di rumput utara jalan atas — tiga lapak dengan
 *   penjualnya, penjual balon di tepi jalan, dan pembeli yang menawar.
 *   Kendaraan tidak lewat selama jalannya dipakai pembeli.
 * - 25 Mei: ulang tahun Rahmat — tumpeng di pelataran rumah Projects,
 *   spanduk, dan warga yang menyanyikan lagu ulang tahun saat Rahmat datang.
 * - Malam tahun baru dan 1 Januari: kembang api di langit dan spanduk.
 *
 * Jadwalnya mengikuti jam pengunjung; `?acara=…` di alamat memaksa acara
 * tertentu tampil (lihat paksaan()).
 */
export class Acara {
  private aktif = new Set<JenisAcara>();
  private pasar?: Pasar;
  private langit?: KembangLangit;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Player | undefined,
    blocked: Phaser.Physics.Arcade.StaticGroup,
    tambahDinding: (k: { x0: number; y0: number; x1: number; y1: number }) => void
  ) {
    // Benda yang dipasang ditentukan sekali, dari tanggal hari ini; yang
    // terikat jam (pasar, kembang api) muncul dan hilang sendiri.
    const hariIni = acaraPada(new Date());
    const sepanjangHari = new Set(hariIni);
    const d = new Date();
    if (d.getDay() === 5) sepanjangHari.add('pasar');
    if ((d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1)) sepanjangHari.add('tahunbaru');

    if (sepanjangHari.has('tujuhbelas')) new Umbul(scene, ACARA.umbul, 'umbul_agustus');
    if (sepanjangHari.has('lomba')) new PanjatPinang(scene, blocked, tambahDinding);
    if (sepanjangHari.has('pasar')) this.pasar = new Pasar(scene, gelap);
    if (sepanjangHari.has('ultah')) new Ultah(scene, pemain);
    if (sepanjangHari.has('tahunbaru')) this.langit = new KembangLangit(scene, gelap);

    this.periksa();
    scene.time.addEvent({ delay: 20000, loop: true, callback: () => this.periksa() });
  }

  /** Jalan atas sedang dipakai pasar: kendaraan tidak lewat. */
  get jalanDitutup() {
    return !!this.pasar?.buka;
  }

  /** Acara yang sedang berlangsung, untuk diumumkan MATS-BOT. */
  get sekarang() {
    return [...this.aktif];
  }

  /** Kalimat MATS-BOT untuk acara hari ini, atau undefined kalau tidak ada. */
  kabar() {
    const urut: JenisAcara[] = ['ultah', 'tahunbaru', 'lomba', 'pasar', 'tujuhbelas'];
    const a = urut.find((x) => this.aktif.has(x));
    return a ? KABAR[a] : undefined;
  }

  private periksa() {
    const kini = acaraPada(new Date());
    this.aktif = kini;
    this.pasar?.atur(kini.has('pasar'));
    this.langit?.atur(kini.has('tahunbaru'));
  }
}

/* ---------------- panjat pinang ---------------- */

const KATA_PINANG = ['Come on, come on!', 'Slippery!', 'Almost there!', 'Waaa!', 'Merdeka!'];

class PanjatPinang {
  private pemanjat: Phaser.GameObjects.Sprite;
  private penonton: Phaser.GameObjects.Sprite[] = [];
  private tinggi = 0;
  private keadaan: 'naik' | 'merosot' | 'rehat' | 'menang' = 'rehat';
  private sampai = 0;
  private hadiah: Phaser.GameObjects.Rectangle[] = [];
  private readonly x: number;
  private readonly kaki: number;

  constructor(
    private scene: Phaser.Scene,
    blocked: Phaser.Physics.Arcade.StaticGroup,
    tambahDinding: (k: { x0: number; y0: number; x1: number; y1: number }) => void
  ) {
    const { x, kaki } = ACARA.pinang;
    this.x = x;
    this.kaki = kaki;
    const g = GAMBAR_ACARA.pinang;
    spritesheetTeks(scene, 'pinang', g.frame, g.palet);
    scene.add.image(x, kaki + 1, 'pinang').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    // pangkal tiang menghalangi pemain dan memantulkan bola
    const r = scene.add.rectangle(x, kaki - 2, 8, 4);
    scene.physics.add.existing(r, true);
    blocked.add(r);
    tambahDinding({ x0: x - 4, y0: kaki - 4, x1: x + 4, y1: kaki });

    buatPanjat(scene, 'anak', 'anak_panjat');
    const sk = skalaAnak(scene);
    this.pemanjat = scene.add.sprite(x, kaki, 'anak_panjat', 0).setOrigin(0.5, 30 / 32).setScale(sk);
    bisaDiajak(scene, this.pemanjat, 'Kid', ['The prizes are at the top! The pole is covered in oil, so it is really slippery.', 'Merdeka! Happy Independence Day!']);

    // dua teman bersorak dari kiri-kanan pangkal tiang
    for (const [rupa, dx, dk] of [
      ['anak_bola', -20, -8],
      ['anak_engklek', 18, -14],
    ] as const) {
      const key = `${rupa}_sorak`;
      buatPoseLompat(scene, rupa, key);
      if (!scene.textures.exists(key)) continue;
      const s = scene.add.sprite(x + dx, kaki + dk, key, 5).setOrigin(0.5, 30 / 32).setScale(sk).setDepth(kedalaman(kaki + dk));
      scene.add
        .image(x + dx, kaki + dk - 1, bayanganKaki(scene))
        .setScale(sk)
        .setAlpha(BAYANGAN_KAKI)
        .setDepth(kedalaman(kaki + dk) - 0.5);
      bisaDiajak(scene, s, 'Kid', ['Go go go! He is almost at the top!', 'Next year I will climb it myself.']);
      this.penonton.push(s);
    }
    this.sampai = scene.time.now + 2000;
    scene.events.on('update', this.detak, this);
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const puncak = ACARA.pinang.puncak;
    switch (this.keadaan) {
      case 'rehat':
        this.tinggi = 0;
        this.pemanjat.setFrame(1);
        if (t > this.sampai) this.keadaan = 'naik';
        break;
      case 'naik': {
        // naik tersendat: dua tarikan tiap detik, kadang merosot sebentar
        const tarik = Math.floor(t / 320) % 2;
        this.pemanjat.setFrame(tarik);
        if (tarik === 0) this.tinggi += 9 * dt;
        if (this.tinggi > 10 && Math.random() < 0.0035 * (delta / 16)) {
          this.keadaan = 'merosot';
          this.seru(KATA_PINANG[3]);
          tawa(this.x, this.kaki - 20, 'anak');
        }
        if (this.tinggi >= puncak) {
          this.tinggi = puncak;
          this.keadaan = 'menang';
          this.sampai = t + 6000;
          this.seru(KATA_PINANG[4]);
          this.ambilHadiah();
        }
        break;
      }
      case 'merosot':
        this.pemanjat.setFrame(0);
        this.tinggi -= 40 * dt;
        if (this.tinggi <= 0) {
          this.tinggi = 0;
          this.keadaan = 'rehat';
          this.sampai = t + Phaser.Math.Between(1500, 3500);
        }
        break;
      case 'menang':
        this.pemanjat.setFrame(Math.floor(t / 200) % 2);
        if (t > this.sampai) {
          this.keadaan = 'merosot';
          this.sampai = t;
        }
        break;
    }
    const y = this.kaki - this.tinggi;
    // tampak samping menghadap kanan: tangannya (kolom 22-23 frame) di sisi kiri tiang
    this.pemanjat.setPosition(this.x - 6, Math.round(y)).setDepth(kedalaman(this.kaki) + 0.5);
    // penonton melompat-lompat saat ada yang memanjat, diam saat rehat
    const sorak = this.keadaan !== 'rehat';
    this.penonton.forEach((s, i) => {
      const f = sorak ? (Math.floor(t / 260 + i) % 2 ? 7 : 5) : 5;
      s.setFrame(f);
    });
    if (sorak && Math.random() < 0.004 * (delta / 16)) this.seru(Phaser.Utils.Array.GetRandom(KATA_PINANG.slice(0, 3)), this.penonton[0]);
  }

  private seru(msg: string, siapa: Phaser.GameObjects.Sprite = this.pemanjat) {
    this.scene.game.events.emit('mapporto:ucap', { msg, siapa, nama: 'Kid', lama: 2200 });
    gumam(siapa.x, siapa.y, 'anak', 3, 1, 'seru');
  }

  /** Hadiah melayang turun dari roda di puncak, lalu tumbuh lagi. */
  private ambilHadiah() {
    const warna = Phaser.Utils.Array.GetRandom([0x3b7dd8, 0xe0463a, 0xf2c94c, 0x4caf50]);
    const r = this.scene.add
      .rectangle(this.x + 6, this.kaki - ACARA.pinang.puncak - 16, 4, 4, warna)
      .setStrokeStyle(1, 0x2a1c14)
      .setDepth(kedalaman(this.kaki) + 1);
    this.hadiah.push(r);
    this.scene.tweens.add({
      targets: r,
      y: this.kaki - 2,
      x: this.x + 12,
      duration: 900,
      ease: 'Bounce.easeOut',
      onComplete: () => this.scene.time.delayedCall(4000, () => r.destroy()),
    });
  }
}

/* ---------------- pasar Jumat ---------------- */

const SUARA_PEMBELI: Record<string, JenisSuara> = { woman: 'wanita', nenek: 'wanita', pembeli: 'pria', kakek: 'kakek' };

interface Pembeli {
  s: Phaser.GameObjects.Sprite;
  b: Phaser.GameObjects.Image;
  rupa: string;
  tujuan: number;
  tunggu: number;
  y: number;
}

class Pasar {
  buka = false;
  private semua: Phaser.GameObjects.GameObject[] = [];
  private lampu: Phaser.GameObjects.Image[] = [];
  private pembeli: Pembeli[] = [];

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    const { lapak, kaki, spanduk: sp, pembeli, balon } = ACARA.pasar;
    const kata: Record<string, string[]> = {
      buah: ['Fresh fruit! Mangoes, oranges, bananas — all from this morning.', 'Two kilos of oranges for a good price, just for you.'],
      baju: ['T-shirts, sarongs, all sizes! Try one on.', 'This batik one would look great on Rahmat.'],
      gorengan: ['Gorengan! Fried tofu and tempeh, still hot.', 'Bakwan, tahu isi, pisang goreng — five for a few coins.'],
    };
    for (const { x, jenis, penjual } of lapak) {
      const nama = `lapak_${jenis}`;
      const g = GAMBAR_ACARA[nama];
      spritesheetTeks(scene, nama, g.frame, g.palet);
      // lapak 36×46 dua lapis: tiang belakang + gantungan di balik penjual,
      // atap, meja, dan dagangan di depannya. Kepala penjual (baris 13 frame
      // warga) tampak utuh di antara rumbai atap dan dagangan di meja.
      const atas = kaki - 45;
      const blk = scene.add.image(x, kaki + 1, nama, 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki) - 0.4);
      Player.registerAnimations(scene, penjual);
      const p = scene.add.sprite(x, atas + 15, penjual, 0).setDepth(kedalaman(kaki) - 0.2);
      p.play(`${penjual}_idle_down`);
      bisaDiajak(scene, p, 'Seller', kata[jenis]);
      const img = scene.add.image(x, kaki + 1, nama, 1).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
      this.semua.push(blk, p, img);
      // pelita yang tergantung di kiri atap, menyala saat senja
      const l = scene.add
        .image(x - 12, atas + 14, scene.textures.exists('lampu_nasgor') ? 'lampu_nasgor' : 'sorot_motor')
        .setScale(0.6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.above + 61);
      this.lampu.push(l);
    }
    this.pasangBalon(balon.x, balon.kaki);
    const key = spanduk(scene, ['PASAR', 'JUMAT'], '#e0463a', '#fbf6e6', 14);
    this.semua.push(scene.add.image(sp.x, sp.kaki + 1, key).setOrigin(0.5, 1).setDepth(kedalaman(sp.kaki)));

    pembeli.rupa.forEach((rupa, i) => {
      if (!scene.textures.exists(rupa)) return;
      Player.registerAnimations(scene, rupa);
      const y = pembeli.kaki[i % pembeli.kaki.length];
      const x = Phaser.Math.Between(pembeli.x0, pembeli.x1);
      const s = scene.add.sprite(x, y - PLAYER.baseY, rupa, 0);
      const b = scene.add.image(x, y - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI);
      bisaDiajak(scene, s, 'Shopper', ['The Friday market is the best part of the week.', 'I always come for the gorengan before it sells out.']);
      this.pembeli.push({ s, b, rupa, tujuan: x, tunggu: 0, y });
      this.semua.push(s, b);
    });
    this.atur(false);
    scene.events.on('update', this.detak, this);
  }

  /**
   * Penjual balon keliling di tepi jalan: tangannya terangkat memegang
   * tongkat berisi balon dan kincir kertas yang bergoyang ditiup angin.
   * Balonnya digambar setinggi langit (di atas tajuk cemara di belakangnya).
   */
  private pasangBalon(x: number, kaki: number) {
    const scene = this.scene;
    tanganTerangkat(scene, 'pakde', 'pakde_angkat', '#c68b5e', '#ecebe4');
    const g = GAMBAR_ACARA.balon_jual;
    spritesheetTeks(scene, 'balon_jual', g.frame, g.palet);
    const s = scene.add.sprite(x, kaki, 'pakde_angkat', 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    const b = scene.add.image(x, kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(kaki) - 0.5);
    bisaDiajak(scene, s, 'Balloon seller', ['Balloons! Pinwheels! One for the little ones?', 'The red one floats the highest, I promise.']);
    // genggaman frame tanganTerangkat di (23,18): tongkat berdiri di situ
    const tongkat = scene.add
      .image(x + 8, kaki - 13, 'balon_jual')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.above + 25);
    scene.tweens.add({ targets: tongkat, angle: { from: -4, to: 4 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.semua.push(s, b, tongkat);
  }

  atur(buka: boolean) {
    this.buka = buka;
    for (const o of this.semua) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(buka);
    if (!buka) for (const l of this.lampu) l.setVisible(false);
  }

  private detak(t: number, delta: number) {
    if (!this.buka) return;
    const nyala = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.4, 0, 1);
    this.lampu.forEach((l, i) => l.setVisible(nyala > 0).setAlpha(nyala * (0.55 + Math.sin(t / 110 + i) * 0.05)));
    const { lapak, pembeli: aturan } = ACARA.pasar;
    for (const p of this.pembeli) {
      if (p.tunggu > t) continue;
      const dx = p.tujuan - p.s.x;
      if (Math.abs(dx) < 1) {
        // sampai di depan lapak: menghadap ke lapak dan menawar, lalu pindah
        if (p.tunggu) {
          p.tujuan = Phaser.Utils.Array.GetRandom([...lapak]).x + Phaser.Math.Between(-6, 6);
          p.tunggu = 0;
        } else {
          p.tunggu = t + Phaser.Math.Between(3000, 7000);
          p.s.play(`${p.rupa}_idle_up`, true);
          if (Math.random() < 0.6) gumam(p.s.x, p.s.y, SUARA_PEMBELI[p.rupa] ?? 'pria', 4, 0.8, 'tanya');
        }
        continue;
      }
      const langkah = (28 * Math.min(delta, 100)) / 1000;
      p.s.x += Math.sign(dx) * Math.min(langkah, Math.abs(dx));
      p.s.play(`${p.rupa}_walk_${dx > 0 ? 'right' : 'left'}`, true);
      p.s.setDepth(kedalaman(p.y));
      p.b.setPosition(p.s.x, p.y - 1).setDepth(kedalaman(p.y) - 0.5);
      p.s.x = Phaser.Math.Clamp(p.s.x, aturan.x0, aturan.x1);
    }
  }
}

/* ---------------- ulang tahun Rahmat ---------------- */

const UCAPAN_ULTAH = ['Happy birthday, Rahmat!', 'Selamat ulang tahun!', 'Make a wish!', 'Panjang umur!'];

class Ultah {
  private tamu: Phaser.GameObjects.Sprite[] = [];
  private nyanyiLagi = 0;
  private bernyanyi = 0;

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Player | undefined
  ) {
    const { meja, tamu } = ACARA.ultah;
    const g = GAMBAR_ACARA.tumpeng;
    spritesheetTeks(scene, 'tumpeng', g.frame, g.palet);
    const m = scene.add.image(meja.x, meja.kaki + 1, 'tumpeng').setOrigin(0.5, 1).setDepth(kedalaman(meja.kaki));
    // tulisan di kain depan meja (baris 14-27 gambar meja)
    const key = spanduk(scene, ['HAPPY BIRTHDAY', 'RAHMAT!'], '#3b7dd8', '#f2c94c', 0);
    scene.add.image(meja.x, meja.kaki - 15, key).setOrigin(0.5, 0).setDepth(kedalaman(meja.kaki) + 0.1);
    m.setInteractive({ useHandCursor: true });
    m.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', {
        msg: 'Tumpeng: yellow turmeric rice shaped like a mountain, cut from the top by the birthday person. Happy birthday, Rahmat!',
        siapa: m,
        nama: 'Tumpeng',
      });
      this.nyanyi(true);
    });
    for (const t of tamu) {
      if (!scene.textures.exists(t.rupa)) continue;
      const w = wargaDiam(scene, t.rupa, t.x, t.kaki, t.arah as Dir);
      bisaDiajak(scene, w.s, 'Neighbour', ['Happy birthday, Rahmat! We made you a tumpeng.', 'Make a wish before you cut the top!']);
      this.tamu.push(w.s);
    }
    this.nyanyiLagi = scene.time.now + 4000;
    scene.events.on('update', this.detak, this);
  }

  private detak(t: number) {
    const p = this.pemain();
    const { meja } = ACARA.ultah;
    const dekat = p?.visible && Phaser.Math.Distance.Between(p.x, p.y + PLAYER.baseY, meja.x, meja.kaki) < 110;
    if (dekat && t > this.nyanyiLagi) this.nyanyi();
    // selama bernyanyi: tamu bergoyang dan not balok beterbangan
    if (t < this.bernyanyi) {
      this.tamu.forEach((s, i) => s.setY(s.getData('y0') - (Math.floor(t / 330 + i) % 2)));
      if (Math.random() < 0.05) this.not(Phaser.Utils.Array.GetRandom(this.tamu));
    }
  }

  private nyanyi(paksa = false) {
    const t = this.scene.time.now;
    if (!paksa && t < this.nyanyiLagi) return;
    if (t < this.bernyanyi) return;
    this.nyanyiLagi = t + 60000;
    this.bernyanyi = t + 13000;
    for (const s of this.tamu) if (s.getData('y0') === undefined) s.setData('y0', s.y);
    const { meja } = ACARA.ultah;
    laguUltah(meja.x, meja.kaki - 10);
    this.scene.time.delayedCall(13200, () => {
      for (const s of this.tamu) s.setY(s.getData('y0'));
      this.konfeti();
      const siapa = Phaser.Utils.Array.GetRandom(this.tamu);
      this.scene.game.events.emit('mapporto:ucap', { msg: Phaser.Utils.Array.GetRandom(UCAPAN_ULTAH), siapa, nama: 'Neighbour' });
      tawa(siapa.x, siapa.y, 'bapak');
    });
  }

  private not(s: Phaser.GameObjects.Sprite) {
    const n = this.scene.add
      .text(s.x + Phaser.Math.Between(-4, 4), s.y - 14, Math.random() < 0.5 ? '♪' : '♫', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#2a1c14',
        resolution: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.above + 30);
    this.scene.tweens.add({ targets: n, y: n.y - 16, x: n.x + Phaser.Math.Between(-6, 6), alpha: 0, duration: 1600, onComplete: () => n.destroy() });
  }

  private konfeti() {
    const { meja } = ACARA.ultah;
    const warna = [0xe0463a, 0xf2c94c, 0x3b7dd8, 0x4caf50, 0xe08ab0, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const r = this.scene.add
        .rectangle(meja.x + Phaser.Math.Between(-6, 6), meja.kaki - 24, 1, 2, Phaser.Utils.Array.GetRandom(warna))
        .setDepth(DEPTH.above + 30);
      const sudut = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const laju = Phaser.Math.Between(20, 50);
      this.scene.tweens.add({
        targets: r,
        x: r.x + Math.cos(sudut) * laju,
        y: { value: r.y + Math.sin(sudut) * laju * 0.7 + 30, ease: 'Quad.easeIn' },
        angle: Phaser.Math.Between(-360, 360),
        alpha: { from: 1, to: 0, delay: 900 },
        duration: 1700,
        onComplete: () => r.destroy(),
      });
    }
  }
}

/* ---------------- kembang api tahun baru ---------------- */

interface Percik {
  r: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  umur: number;
  lama: number;
}

const WARNA_LEDAK = [
  [0xff5a4a, 0xffd0c0],
  [0xffd24a, 0xfff4c0],
  [0x5ad86a, 0xd0ffd8],
  [0x5aa8ff, 0xd0e8ff],
  [0xff7ad8, 0xffd8f4],
  [0xffffff, 0xfff0d0],
];

class KembangLangit {
  private nyala = false;
  private lagi = 0;
  private percik: Percik[] = [];
  private spandukImg?: Phaser.GameObjects.Image;
  private tengahMalam = false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    const d = new Date();
    const tahun = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const { spanduk: sp } = ACARA.tahunbaru;
    const key = spanduk(scene, ['HAPPY NEW YEAR', String(tahun)], '#2a2a5a', '#f2c94c', 10);
    this.spandukImg = scene.add.image(sp.x, sp.kaki + 1, key).setOrigin(0.5, 1).setDepth(kedalaman(sp.kaki)).setVisible(false);
    scene.events.on('update', this.detak, this);
  }

  atur(aktif: boolean) {
    this.nyala = aktif;
    this.spandukImg?.setVisible(aktif);
  }

  /** Untuk dites dari konsol: luncurkan satu roket di dekat kamera. */
  luncur() {
    const cam = this.scene.cameras.main.worldView;
    const x = Phaser.Math.Between(Math.round(cam.x + 30), Math.round(cam.right - 30));
    const dari = Math.min(cam.bottom - 10, 520);
    const ke = Phaser.Math.Between(Math.round(cam.y + 20), Math.round(cam.y + cam.height * 0.45));
    const roket = this.scene.add.rectangle(x, dari, 1, 3, 0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.above + 66);
    siulRoket(x, dari);
    this.scene.tweens.add({
      targets: roket,
      y: ke,
      x: x + Phaser.Math.Between(-8, 8),
      duration: Phaser.Math.Between(800, 1100),
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (Math.random() < 0.6) this.percikan(roket.x, roket.y + 2, 0xffc080, 0, Phaser.Math.FloatBetween(5, 15), 400);
      },
      onComplete: () => {
        roket.destroy();
        this.ledak(roket.x, roket.y);
      },
    });
  }

  private ledak(x: number, y: number) {
    dor(x, y);
    const [utama, terang] = Phaser.Utils.Array.GetRandom(WARNA_LEDAK);
    const n = Phaser.Math.Between(36, 52);
    const laju = Phaser.Math.Between(42, 64);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const v = laju * Phaser.Math.FloatBetween(0.75, 1);
      // cincin luar 2×2 berwarna, isian dalam 1×1 yang lebih pucat
      this.percikan(x, y, utama, Math.cos(a) * v, Math.sin(a) * v, Phaser.Math.Between(1300, 1800), 2);
      if (i % 2) this.percikan(x, y, terang, Math.cos(a) * v * 0.55, Math.sin(a) * v * 0.55, Phaser.Math.Between(900, 1300));
    }
    // kilat sesaat yang menerangi desa
    const kilat = this.scene.add
      .image(x, y, this.scene.textures.exists('lampu_nasgor') ? 'lampu_nasgor' : 'sorot_motor')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3)
      .setTint(utama)
      .setAlpha(0.5)
      .setDepth(DEPTH.above + 62);
    this.scene.tweens.add({ targets: kilat, alpha: 0, duration: 600, onComplete: () => kilat.destroy() });
  }

  private percikan(x: number, y: number, warna: number, vx: number, vy: number, lama: number, besar = 1) {
    if (this.percik.length > 320) return;
    const r = this.scene.add.rectangle(x, y, besar, besar, warna).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.above + 66);
    this.percik.push({ r, vx, vy, umur: 0, lama });
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    for (let i = this.percik.length - 1; i >= 0; i--) {
      const p = this.percik[i];
      p.umur += delta;
      p.vy += 22 * dt;
      p.vx *= 0.985;
      p.r.x += p.vx * dt;
      p.r.y += p.vy * dt;
      const sisa = 1 - p.umur / p.lama;
      // berkedip di ujung umurnya, seperti percikan yang padam
      p.r.setAlpha(sisa < 0.3 ? (Math.random() < 0.5 ? sisa * 2 : 0) : sisa);
      if (p.umur >= p.lama) {
        p.r.destroy();
        this.percik.splice(i, 1);
      }
    }
    if (!this.nyala) return;
    const d = new Date();
    // detik-detik pergantian tahun: hujan kembang api selama semenit
    const pergantian = d.getMonth() === 0 && d.getDate() === 1 && d.getHours() === 0 && d.getMinutes() < 1;
    if (pergantian && !this.tengahMalam) {
      this.tengahMalam = true;
      this.scene.game.events.emit('mapporto:matsbot-ucap', `Happy New Year ${d.getFullYear()}!`);
    }
    // siang hari 1 Januari cukup spanduk; kembang api saat gelap atau saat ?acara=
    if (this.gelap() < 0.3 && !pergantian && !paksaan().has('tahunbaru')) return;
    if (t > this.lagi) {
      this.lagi = t + (pergantian ? Phaser.Math.Between(250, 500) : Phaser.Math.Between(1800, 5000));
      this.luncur();
    }
  }
}
