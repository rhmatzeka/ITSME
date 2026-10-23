import Phaser from 'phaser';
import { gumam, tawa, type JenisSuara } from '../bunyi';
import { DEPTH, LAYAR, PLAYER, kedalaman } from '../config';
import type { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { bisaDiajak } from './Warga';

/** Cahaya film: di atas tirai malam, seperti lampu jalan dan jendela. */
const CAHAYA = DEPTH.above + 60;

/** Gambar layar 52×40: tiang bambu bertoa, kain berbingkai hitam; film di bidang putihnya. */
const LAYAR_W = 52;
const LAYAR_H = 40;
const FILM = { x: 8, y: 5, w: 36, h: 22 };

/** Judul film malam ini, berganti tiap kali layarnya diketuk. */
const JUDUL = ['Si Kancil Strikes Back', 'The Legend of the Greasy Pole', 'Love at the Friday Market', 'Silat Under the Full Moon'];

const SUARA: Record<string, JenisSuara> = { kakek: 'kakek', nenek: 'wanita', woman: 'wanita', pembeli: 'pria', pakde: 'bapak', tamu: 'pria', anak: 'anak', anak_engklek: 'anak' };

/** Huruf 4×6 untuk "TAMAT" di akhir film (sama dengan huruf spanduk di Acara.ts). */
const HURUF_TAMAT: Record<string, string> = {
  T: '111001000100010001000100',
  A: '011010011001111110011001',
  M: '100111111111100110011001',
};

type Adegan = 'kejar' | 'silat' | 'senja' | 'tamat';
interface Potong {
  frame: number;
  lama: number;
  adegan: Adegan;
  /** Saat frame ini tampil, penonton bereaksi. */
  reaksi?: string;
}

/**
 * Layar tancap: tiap Sabtu malam warga menggelar tikar di lapangan rumah CV
 * dan menonton film yang diputar di layar kain bertiang bambu — tontonan
 * desa sebelum ada TV di tiap rumah.
 *
 * Filmnya pendek dan berulang: kejar-kejaran mobil di jalan pegunungan,
 * adu silat dua bayangan di senja ungu (dengan kilat putih saat tendangan
 * mengenai), dua sejoli di pantai saat matahari terbenam, lalu TAMAT.
 * Penonton bereaksi mengikuti adegan — bersorak, kaget, menggoda "Cieee!" —
 * dan bertepuk saat tamat.
 *
 * Gambar filmnya digambar sekali ke satu kanvas berbingkai banyak. Di malam
 * hari salinan ADD-nya di atas tirai yang membuatnya menyala, cahayanya
 * jatuh ke tanah di depan layar, dan sorot proyektor berupa kerucut cahaya
 * berlapis yang berkedip di atas kepala penonton dengan debu berkilau
 * melayang di dalamnya. Bapak operator berdiri di samping proyektornya. Diketuk: judul film malam ini; menonton sebentar di dekat layar
 * memberi prestasi "Movie night".
 */
export class LayarTancap {
  buka = false;
  private semua: Phaser.GameObjects.GameObject[] = [];
  private film: Phaser.GameObjects.Sprite;
  private filmNyala: Phaser.GameObjects.Sprite;
  private pendar: Phaser.GameObjects.Image;
  private sorot: Phaser.GameObjects.Graphics;
  private lensa: Phaser.GameObjects.Image;
  /** Sorot proyektor, digambar per piksel dunia (lihat buatSinar). */
  private sinar: Phaser.GameObjects.Image;
  private genangan: Phaser.GameObjects.Image;
  /** Debu yang berkilau di dalam sorot proyektor: posisi sepanjang sorot (0..1) dan ke samping (-1..1). */
  private debu = Array.from({ length: 10 }, () => ({ t: Math.random(), s: Math.random() * 2 - 1, laju: 0.03 + Math.random() * 0.05, fase: Math.random() * 6 }));
  private penonton: Phaser.GameObjects.Sprite[] = [];
  private urutan: Potong[] = [];
  private ke = 0;
  private sampai = 0;
  private judulKe = 0;
  private nonton = 0;
  private sudahJejak = false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Player | undefined
  ) {
    this.buatTekstur();
    const { layar, proyektor, tikar, penonton } = LAYAR;
    const atas = layar.kaki - LAYAR_H + 1;
    const kiri = layar.x - LAYAR_W / 2;

    for (const t of tikar) this.semua.push(scene.add.image(t.x, t.y, 'tikar').setDepth(DEPTH.below + 1));
    const kain = scene.add.image(layar.x, layar.kaki + 1, 'layar_tancap').setOrigin(0.5, 1).setDepth(kedalaman(layar.kaki));
    this.film = scene.add.sprite(kiri + FILM.x, atas + FILM.y, 'film', 0).setOrigin(0).setDepth(kedalaman(layar.kaki) + 0.05);
    this.filmNyala = scene.add.sprite(kiri + FILM.x, atas + FILM.y, 'film', 0).setOrigin(0).setDepth(CAHAYA + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.pendar = scene.add
      .image(kiri + FILM.x + FILM.w / 2, atas + FILM.y + FILM.h / 2, 'layar_pendar')
      .setDepth(CAHAYA)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.sorot = scene.add.graphics().setDepth(CAHAYA - 1).setBlendMode(Phaser.BlendModes.ADD);
    const proy = scene.add.image(proyektor.x, proyektor.kaki + 1, 'proyektor').setOrigin(0.5, 1).setDepth(kedalaman(proyektor.kaki));
    // lensa yang menyala dan cahaya film yang jatuh ke tanah di depan layar
    this.lensa = scene.add.image(proyektor.x + 6, proyektor.kaki - 11, 'layar_pendar').setScale(0.22).setDepth(CAHAYA + 2).setBlendMode(Phaser.BlendModes.ADD);
    {
      const lensa = { x: proyektor.x + 6, y: proyektor.kaki - 11 };
      const s = buatSinar(scene, lensa, { x0: kiri + FILM.x, x1: kiri + FILM.x + FILM.w - 1, y: atas + FILM.y + FILM.h - 1 });
      this.sinar = scene.add.image(s.x, s.y, s.key).setOrigin(0).setDepth(CAHAYA - 1).setBlendMode(Phaser.BlendModes.ADD);
    }
    this.genangan = scene.add
      .image(layar.x, layar.kaki + 6, 'layar_pendar')
      .setScale(1.1, 0.35)
      .setDepth(CAHAYA)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.semua.push(kain, this.film, this.filmNyala, this.pendar, this.sorot, proy, this.lensa, this.sinar, this.genangan);
    // operator proyektor: Bapak berdiri di samping mesinnya, menghadap layar
    if (scene.textures.exists('bapak')) {
      const ox = proyektor.x - 11;
      const op = scene.add.sprite(ox, proyektor.kaki - PLAYER.baseY, 'bapak', 12).setDepth(kedalaman(proyektor.kaki));
      const ob = scene.add.image(ox, proyektor.kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(proyektor.kaki) - 0.5);
      bisaDiajak(scene, op, 'Projectionist', ['I bring the projector every Saturday. The reels are older than me!', 'Sit down, sit down, the good part is coming.']);
      this.semua.push(op, ob);
    }

    kain.setInteractive({ useHandCursor: true });
    kain.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', {
        msg: `Tonight's film: "${JUDUL[this.judulKe++ % JUDUL.length]}". Every Saturday night the whole village brings a mat to the CV field.`,
        siapa: kain,
        nama: 'Layar tancap',
      });
      this.jejak();
    });

    for (const p of penonton) {
      if (!scene.textures.exists(p.rupa)) continue;
      const key = buatDudukBelakang(scene, p.rupa);
      const sk = 'kecil' in p && p.kecil ? Math.max(1, Math.round(scene.cameras.main.zoom * 0.67)) / scene.cameras.main.zoom : 1;
      const s = scene.add.sprite(p.x, p.kaki, key).setOrigin(0.5, 1).setScale(sk).setDepth(kedalaman(p.kaki));
      const b = scene.add
        .image(p.x, p.kaki - 1, bayanganKaki(scene))
        .setScale(sk * 1.2, sk)
        .setAlpha(BAYANGAN_KAKI)
        .setDepth(kedalaman(p.kaki) - 0.5);
      s.setData('rupa', p.rupa).setData('y0', p.kaki);
      bisaDiajak(scene, s, 'Neighbour', ['Shh, the film is on! Sit with us.', 'I come every Saturday. The silat part is the best.']);
      this.penonton.push(s);
      this.semua.push(s, b);
    }

    this.atur(false);
    scene.events.on('update', this.detak, this);
  }

  atur(buka: boolean) {
    this.buka = buka;
    for (const o of this.semua) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(buka);
    if (buka) {
      this.ke = 0;
      this.sampai = 0;
    }
  }

  private jejak() {
    if (this.sudahJejak) return;
    this.sudahJejak = true;
    this.scene.game.events.emit('mapporto:jejak', 'layar');
  }

  private detak(t: number, delta: number) {
    if (!this.buka) return;
    // putar film: tiap potongan tampil selama `lama`, lalu yang berikutnya
    if (t > this.sampai) {
      const p = this.urutan[this.ke % this.urutan.length];
      this.ke++;
      this.sampai = t + p.lama;
      this.film.setFrame(p.frame);
      this.filmNyala.setFrame(p.frame);
      if (p.reaksi) this.reaksi(p.reaksi, p.adegan);
    }
    // malam: film dan sorotnya menyala, berkedip halus seperti proyektor tua
    const g = this.gelap();
    const kedip = 0.92 + Math.sin(t / 37) * 0.04 + (Math.random() < 0.02 ? -0.15 : 0);
    this.filmNyala.setAlpha(g * 0.85 * kedip);
    this.pendar.setAlpha(g * 0.55 * kedip);
    const { layar, proyektor } = LAYAR;
    const atas = layar.kaki - LAYAR_H + 1;
    const kiri = layar.x - LAYAR_W / 2;
    const lensa = { x: proyektor.x + 6, y: proyektor.kaki - 11 };
    this.lensa.setAlpha((0.4 + g * 0.6) * kedip);
    this.genangan.setAlpha(g * 0.35 * kedip);
    // sorot proyektor: gambar berpiksel yang hanya tampak saat gelap
    const bawah = atas + FILM.y + FILM.h;
    const kiriF = kiri + FILM.x;
    const kananF = kiri + FILM.x + FILM.w;
    this.sinar.setAlpha(g * 0.55 * kedip);
    const s0 = this.sorot.clear();
    // debu berkilau melayang di dalam sorot
    for (const d of this.debu) {
      d.t = (d.t + d.laju * (delta / 1000)) % 1;
      const ujungX = Phaser.Math.Linear(kiriF, kananF, 0.5 + d.s * 0.45);
      const x = Phaser.Math.Linear(lensa.x, ujungX, d.t);
      const y = Phaser.Math.Linear(lensa.y, bawah, d.t);
      const kelip = 0.5 + Math.sin(t / 300 + d.fase) * 0.5;
      s0.fillStyle(0xffffff, g * 0.5 * kelip * Math.sin(d.t * Math.PI)).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // penonton sesekali bergeser duduk
    this.penonton.forEach((s, i) => {
      const geser = Math.floor(t / 2300 + i * 1.7) % 7 === 0 ? 1 : 0;
      s.setY(s.getData('y0') - geser);
    });
    // menonton sebentar di dekat layar atau di antara penonton
    const p = this.pemain();
    if (p?.visible && Phaser.Math.Distance.Between(p.x, p.y + PLAYER.baseY, layar.x, layar.kaki + 22) < 50) {
      this.nonton += delta;
      if (this.nonton > 5000) this.jejak();
    } else this.nonton = 0;
  }

  private reaksi(kata: string, adegan: Adegan) {
    const s = Phaser.Utils.Array.GetRandom(this.penonton);
    if (!s) return;
    const suara = SUARA[s.getData('rupa')] ?? 'pria';
    if (adegan === 'senja' || adegan === 'tamat') tawa(s.x, s.y - 10, suara === 'anak' ? 'anak' : 'bapak');
    else gumam(s.x, s.y - 10, suara, 3, 1, 'seru');
    this.scene.game.events.emit('mapporto:ucap', { msg: kata, siapa: s, nama: 'Neighbour', lama: 1800 });
  }

  /* ---------------- gambar ---------------- */

  private buatTekstur() {
    const tx = this.scene.textures;
    // layar digambar di skrip pratinjau Python: tiang bambu beruas, toa corong di
    // pucuk tiang, kain berbingkai hitam bercincin kuningan, tali pengikat di
    // pojok kain dan tali pancang ke patok di kaki tiang
    spritesheetTeks(
      this.scene,
      'layar_tancap',
      [
        [
          'ab...............................................bca',
          'acb.............................................bcca',
          'acabb..........................................bcaca',
          'accddbebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbebdccca',
          'acbddbbffgfffgfffgfffgfffgfffgfffgfffgfffgfffbbddcca',
          'ab.bbhefiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifejbbbca',
          'ab.bjhefiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifejhb.ba',
          'b..bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb..b',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bhhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbhhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bhhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbhhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bhhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbhhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiifbjhb...',
          '...bjhbfkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfbjhb...',
          '...bjheffffffffffffffffffffffffffffffffffffffejhb...',
          '...bhheflflflflflflflflflflflflflflflflflflffehhb...',
          '...bjhbffffffffffffffffffffffffffffffffffffffbjhb...',
          '...bjhbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbjhb...',
          '...bjhb......................................bjhb...',
          '...bjhb......................................bjhb...',
          '..ebjhb......................................bjhbe..',
          '..ebhhb......................................bhhbe..',
          '..ebjhb......................................bjhbe..',
          '.e.bjhb......................................bjhb.e.',
          '.e.bjhb......................................bjhb.e.',
          'm..bjhb......................................bjhb..m',
          'm..bjhb......................................bjhb..m',
        ],
      ],
      { a: '#e8eaf0', b: '#2a1c14', c: '#9aa0ac', d: '#6a6676', e: '#a8804a', f: '#2d2a33', g: '#e0b850', h: '#9a7a38', i: '#f4f1ea', j: '#e8c878', k: '#d9d2c2', l: '#4d4857', m: '#6e4a24' }
    );
    if (!tx.exists('layar_pendar')) {
      const k = tx.createCanvas('layar_pendar', 64, 48)!;
      const c = k.getContext();
      const g = c.createRadialGradient(32, 24, 4, 32, 24, 30);
      g.addColorStop(0, 'rgba(210,225,255,0.55)');
      g.addColorStop(0.6, 'rgba(180,200,255,0.18)');
      g.addColorStop(1, 'rgba(160,180,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 48);
      k.refresh();
    }
    if (!tx.exists('proyektor')) {
      // proyektor film tua di atas bangku kayu: badan kelabu bergaris, dua
      // gulungan film besar di atas, lensa di depan, kabel menjuntai
      const k = tx.createCanvas('proyektor', 18, 20)!;
      const c = k.getContext();
      const kotak = (x: number, y: number, w: number, h: number, warna: string) => {
        c.fillStyle = warna;
        c.fillRect(x, y, w, h);
      };
      const TINTA = '#2a1c14';
      kotak(1, 12, 15, 3, TINTA); kotak(2, 13, 13, 1, '#b07a40');            // dudukan bangku
      kotak(2, 15, 2, 5, TINTA); kotak(13, 15, 2, 5, TINTA);                // kaki bangku
      kotak(3, 15, 1, 4, '#8a5a30'); kotak(13, 15, 1, 4, '#8a5a30');
      kotak(2, 6, 12, 7, TINTA); kotak(3, 7, 10, 5, '#4d4857'); kotak(3, 7, 10, 1, '#6a6676');   // badan
      kotak(4, 9, 7, 1, '#3a3640'); kotak(11, 8, 1, 3, '#c8a050');           // garis & tuas kuning
      kotak(13, 7, 4, 4, TINTA); kotak(14, 8, 2, 2, '#9aa0ac'); kotak(15, 8, 1, 1, '#ffffff');   // lensa
      for (const [x, r] of [[2, 3], [9, 3]] as const) {                     // gulungan film
        kotak(x, 0, r * 2, r * 2, TINTA);
        kotak(x + 1, 1, r * 2 - 2, r * 2 - 2, '#3a3640');
        kotak(x + r - 1, r - 1, 2, 2, '#9aa0ac');
        kotak(x + 1, 1, 1, 1, '#6a6676');
      }
      kotak(2, 13, 1, 4, '#2d2a33');                                        // kabel
      k.refresh();
    }
    if (!tx.exists('tikar')) {
      // tikar pandan anyaman dua warna
      const k = tx.createCanvas('tikar', 28, 9)!;
      const c = k.getContext();
      c.fillStyle = '#6e4a24';
      c.fillRect(0, 0, 28, 9);
      for (let y = 1; y < 8; y++) {
        for (let x = 1; x < 27; x++) {
          c.fillStyle = (Math.floor(x / 2) + y) % 2 ? '#d8b878' : '#c09a58';
          c.fillRect(x, y, 1, 1);
        }
      }
      c.fillStyle = '#e04a3a';
      c.fillRect(1, 2, 26, 1);
      c.fillRect(1, 6, 26, 1);
      k.refresh();
    }
    this.buatFilm();
  }

  /** Semua bingkai film di satu kanvas, lalu urutan putarnya. */
  private buatFilm() {
    const tx = this.scene.textures;
    const { w, h } = FILM;
    const bingkai: ((c: CanvasRenderingContext2D) => void)[] = [];
    const urutan: Potong[] = [];
    const tambah = (lama: number, adegan: Adegan, gambar: (c: CanvasRenderingContext2D) => void, reaksi?: string) => {
      urutan.push({ frame: bingkai.length, lama, adegan, reaksi });
      bingkai.push(gambar);
    };
    const kotak = (c: CanvasRenderingContext2D, x: number, y: number, lw: number, lh: number, warna: string) => {
      c.fillStyle = warna;
      c.fillRect(x, y, lw, lh);
    };
    // bayangan orang: kepala 3×3, badan 3×5, kaki
    const orang = (c: CanvasRenderingContext2D, x: number, y: number, warna = '#141018') => {
      kotak(c, x, y, 3, 3, warna);
      kotak(c, x, y + 3, 3, 4, warna);
      kotak(c, x, y + 7, 1, 2, warna);
      kotak(c, x + 2, y + 7, 1, 2, warna);
    };

    // 1. kejar-kejaran: mobil merah melaju di jalan pegunungan
    for (let i = 0; i < 9; i++) {
      tambah(140, 'kejar', (c) => {
        for (let y = 0; y < 12; y++) kotak(c, 0, y, w, 1, y < 4 ? '#6fb0f0' : y < 8 ? '#8fc4f8' : '#b8dcff');
        kotak(c, 28, 2, 4, 4, '#ffe070');
        for (const [mx, mh] of [[3, 6], [12, 9], [22, 7], [32, 8]]) {
          const geser = (mx - i * 1 + 40) % 40 - 4;
          for (let y = 0; y < mh; y++) kotak(c, geser - y, 15 - y, y * 2 + 1, 1, '#3f7a4a');
        }
        kotak(c, 0, 15, w, 7, '#6a6676');
        for (let x = (i * 3) % 6; x < w; x += 6) kotak(c, w - x - 3, 18, 3, 1, '#f4f1ea');
        const mx = -8 + i * 5;
        kotak(c, mx, 15, 9, 2, '#d8403a');
        kotak(c, mx + 2, 13, 5, 2, '#d8403a');
        kotak(c, mx + 3, 13, 3, 1, '#bfe6ff');
        kotak(c, mx + 1, 17, 2, 2, '#141018');
        kotak(c, mx + 6, 17, 2, 2, '#141018');
        if (i % 2) kotak(c, mx - 3, 16, 2, 1, '#c9c3b6');
      }, i === 4 ? 'Faster, faster!' : undefined);
    }
    // 2. adu silat dua bayangan di senja ungu, kilat saat tendangan kena
    const latarSilat = (c: CanvasRenderingContext2D) => {
      for (let y = 0; y < 16; y++) kotak(c, 0, y, w, 1, y < 6 ? '#3a2a5a' : y < 11 ? '#5a3a6a' : '#8a4a6a');
      kotak(c, 26, 3, 3, 3, '#f4f1ea');
      kotak(c, 0, 16, w, 6, '#4a3020');
    };
    for (let i = 0; i < 5; i++) {
      tambah(260, 'silat', (c) => {
        latarSilat(c);
        orang(c, 5 + i * 2, 7);
        orang(c, 28 - i * 2, 7);
        if (i % 2) kotak(c, 8 + i * 2, 10, 2, 1, '#141018');
      }, i === 0 ? 'Ooh, silat!' : undefined);
    }
    tambah(260, 'silat', (c) => {
      latarSilat(c);
      orang(c, 15, 3);
      kotak(c, 18, 9, 3, 1, '#141018');
      orang(c, 21, 7);
    });
    tambah(90, 'silat', (c) => kotak(c, 0, 0, w, h, '#ffffff'), 'Whoa!');
    tambah(900, 'silat', (c) => {
      latarSilat(c);
      orang(c, 14, 7);
      kotak(c, 21, 14, 9, 3, '#141018');
      kotak(c, 30, 14, 2, 2, '#141018');
    });
    // 3. senja di pantai: dua sejoli, hati merah melayang
    for (let i = 0; i < 4; i++) {
      tambah(480, 'senja', (c) => {
        for (let y = 0; y < 14; y++) kotak(c, 0, y, w, 1, y < 4 ? '#e8743a' : y < 9 ? '#f0a050' : '#f8c870');
        for (let x = -4; x <= 4; x++) {
          const t = Math.round(Math.sqrt(16 - x * x));
          kotak(c, 18 + x, 14 - t, 1, t, '#ffe070');
        }
        kotak(c, 0, 14, w, 8, '#3a5a8a');
        for (let x = 2; x < w; x += 5) kotak(c, x + (i % 2), 16 + (x % 3), 2, 1, '#f8c870');
        orang(c, 12, 6, '#2a1c24');
        orang(c, 21, 6, '#2a1c24');
        const hy = 5 - i;
        kotak(c, 16, hy, 1, 1, '#e0463a'); kotak(c, 18, hy, 1, 1, '#e0463a');
        kotak(c, 16, hy + 1, 3, 1, '#e0463a'); kotak(c, 17, hy + 2, 1, 1, '#e0463a');
      }, i === 1 ? 'Cieee!' : undefined);
    }
    // 4. TAMAT
    tambah(2600, 'tamat', (c) => {
      kotak(c, 0, 0, w, h, '#141018');
      [...'TAMAT'].forEach((ch, n) => {
        const pola = HURUF_TAMAT[ch];
        for (let p = 0; p < 24; p++) if (pola[p] === '1') kotak(c, 6 + n * 5 + (p % 4), 8 + Math.floor(p / 4), 1, 1, '#f4f1ea');
      });
    }, 'Yaah, it is over already?');

    if (!tx.exists('film')) {
      const k = tx.createCanvas('film', w * bingkai.length, h)!;
      const c = k.getContext();
      bingkai.forEach((gambar, n) => {
        c.save();
        c.translate(n * w, 0);
        c.beginPath();
        c.rect(0, 0, w, h);
        c.clip();
        gambar(c);
        c.restore();
        k.add(n, 0, n * w, 0, w, h);
      });
      k.refresh();
    }
    this.urutan = urutan;
  }
}

/**
 * Pose duduk membelakangi kamera dari frame diam-menghadap-atas sebuah rupa
 * (frame 12): kakinya dipotong di pinggang, jadi badannya langsung duduk di
 * tikar — dari belakang, kaki yang bersila memang tersembunyi.
 */
function buatDudukBelakang(scene: Phaser.Scene, rupa: string) {
  const key = `${rupa}_nonton`;
  const tx = scene.textures;
  if (tx.exists(key)) return key;
  const src = tx.get(rupa).getSourceImage() as HTMLCanvasElement;
  const k = tx.createCanvas(key, 32, 29)!;
  const c = k.getContext();
  c.drawImage(src, 0, 3 * 32, 32, 28, 0, 0, 32, 28);
  // tepi bawah pinggang ditutup garis tinta
  const d = c.getImageData(0, 0, 32, 29);
  for (let x = 0; x < 32; x++) {
    const i = (27 * 32 + x) * 4;
    if (d.data[i + 3]) {
      const j = (28 * 32 + x) * 4;
      d.data[j] = 0x45;
      d.data[j + 1] = 0x29;
      d.data[j + 2] = 0x3f;
      d.data[j + 3] = 255;
    }
  }
  c.putImageData(d, 0, 0);
  k.refresh();
  return key;
}

/**
 * Sorot proyektor sebagai gambar per piksel dunia: kerucut dari lensa ke tepi
 * bawah bidang film. Tiap piksel diberi satu dari tiga tingkat terang menurut
 * jaraknya ke poros sorot (tengah paling terang), dan tingkat paling redup
 * berselang-seling seperti kotak catur — tepinya lembut tapi tetap piksel,
 * bukan segitiga mulus dari renderer.
 */
function buatSinar(scene: Phaser.Scene, lensa: { x: number; y: number }, ujung: { x0: number; x1: number; y: number }) {
  const key = 'sorot_layar';
  const x0 = Math.floor(Math.min(lensa.x, ujung.x0));
  const x1 = Math.ceil(Math.max(lensa.x, ujung.x1));
  const y0 = Math.floor(Math.min(lensa.y, ujung.y));
  const y1 = Math.ceil(Math.max(lensa.y, ujung.y));
  const tx = scene.textures;
  if (!tx.exists(key)) {
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const k = tx.createCanvas(key, w, h)!;
    const c = k.getContext();
    const tengahUjung = (ujung.x0 + ujung.x1) / 2;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = x0 + px + 0.5;
        const y = y0 + py + 0.5;
        // posisi sepanjang sorot (0 di lensa, 1 di layar) dan ke samping (-1..1)
        const t = (y - lensa.y) / (ujung.y - lensa.y);
        if (t <= 0.04 || t > 1) continue;
        const kiriT = lensa.x + (ujung.x0 - lensa.x) * t;
        const kananT = lensa.x + (ujung.x1 - lensa.x) * t;
        if (x < kiriT || x > kananT) continue;
        const poros = lensa.x + (tengahUjung - lensa.x) * t;
        const s = Math.abs(x - poros) / ((kananT - kiriT) / 2 || 1);
        let a = 0;
        if (s < 0.35) a = 0.42;
        else if (s < 0.7) a = 0.26;
        else if ((px + py) % 2 === 0) a = 0.16;
        if (!a) continue;
        c.fillStyle = `rgba(214,228,255,${a * (0.55 + 0.45 * t)})`;
        c.fillRect(px, py, 1, 1);
      }
    }
    k.refresh();
  }
  return { key, x: x0, y: y0 };
}
