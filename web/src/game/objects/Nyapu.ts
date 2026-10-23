import Phaser from 'phaser';
import { srek } from '../bunyi';
import { NYAPU, PLAYER, ROW, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatRupa } from './Rupa';
import { bisaDiajak } from './Warga';
import { arahKePemain } from './toleh';

/** Jam menyapu: pagi dan sore, menurut jam desa. */
const JAM = [
  [5.5, 10.5],
  [15, 17.5],
];

/** Maju sambil menyapu, px/detik — pelan. */
const LAJU = 5;

/** Satu ayunan sapu, ms. */
const AYUN = 300;

/**
 * Nenek yang menyapu halaman tanah di timur rumah Projects dengan sapu
 * lidi, pagi dan sore — kebiasaan di desa sebelum tamu datang dan sebelum
 * magrib. Ia maju pelan menyusuri halaman sambil membungkuk, kedua
 * tangannya menggenggam gagang sapu dan ikatan lidinya mengibas tanah di
 * depan kakinya; debu dan daun kering terdorong ke tumpukan di ujung, lalu
 * ia berbalik. Diajak bicara: sapunya ditegakkan di samping badan. Di luar
 * jam itu (dan saat gerimis) ia di dalam rumah.
 *
 * Dulu ia memakai animasi jalan biasa (tangan berayun) dengan sapu sebagai
 * gambar terpisah yang mengambang di depan kakinya — tidak dipegang siapa
 * pun. Sekarang pose menyapunya satu gambar (`nenek_nyapu`, lihat
 * buatPoseNyapu) supaya tangan dan gagangnya selalu bertemu.
 */
export class Nyapu {
  private s: Phaser.GameObjects.Sprite;
  private sapu: Phaser.GameObjects.Image;
  private bayang: Phaser.GameObjects.Sprite;
  private tumpukan: Phaser.GameObjects.Image;
  private debu: Phaser.GameObjects.Rectangle[] = [];
  private arah = 1;
  private hadir = 0;
  private berhenti = 0;
  private jedaAyun = 0;
  private ayun = 0;

  constructor(
    private scene: Phaser.Scene,
    private jam: () => number,
    private gelap: () => number
  ) {
    this.buatTekstur();
    const { x0, kaki } = NYAPU;
    this.s = scene.add.sprite(x0, kaki - PLAYER.baseY, 'nenek_nyapu', 0).setDepth(kedalaman(kaki));
    this.bayang = scene.add.sprite(x0, kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(kaki) - 0.5);
    // sapu tegak di samping badan, hanya saat ia menoleh ke atas/bawah ke pemain
    this.sapu = scene.add.image(x0, kaki, 'sapu_tegak').setOrigin(0.5, 1).setDepth(kedalaman(kaki) + 0.1).setVisible(false);
    this.tumpukan = scene.add.image(NYAPU.x1 + 9, kaki, 'tumpukan_daun').setOrigin(0.5, 1).setDepth(kedalaman(kaki) - 1);
    for (let i = 0; i < 6; i++) this.debu.push(scene.add.rectangle(0, 0, 1, 1, 0xd9b27a).setVisible(false));
    bisaDiajak(scene, this.s, 'Grandma', [
      'Good morning, dear! A clean yard is a welcoming yard.',
      'The leaves fall every day, so I sweep every day. That is village life.',
    ]);
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    // nenek: rambut putih disanggul, kebaya hijau, kain batik cokelat
    buatRupa(s, 'player', 'nenek', {
      tukar: {
        '#f79617': '#e6e6ea',
        '#fb6b1d': '#b9b9c2',
        '#f9c22b': '#f7f7fa',
        '#fdcbb0': '#d9a07a',
        '#fca790': '#b98260',
        '#e83b3b': '#4f8a5a',
        '#ae2334': '#356644',
        '#ffffff': '#e8e0c8',
        '#cd683d': '#8a5a36',
        '#9e4539': '#5e3a1f',
      },
    });
    Player.registerAnimations(s, 'nenek');
    buatPoseNyapu(s);
    spritesheetTeks(
      s,
      'sapu_tegak',
      [['..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '.rrr.', '.yYy.', 'yYyYy', 'YyYyY', 'y.y.y']],
      { k: '#7a4a24', r: '#c8322a', y: '#d9b870', Y: '#a8844a' }
    );
    spritesheetTeks(s, 'tumpukan_daun', [['...cy.g..', '.cyCgyc..', 'cCygcCyc.', 'CcyCgcCyc']], {
      c: '#b8743a',
      C: '#7a4a24',
      y: '#e8c24a',
      g: '#7ac04a',
    });
  }

  private jamMenyapu() {
    const j = this.jam();
    return JAM.some(([a, b]) => j >= a && j < b) && this.gelap() < 0.3 && cuaca.hujan < 0.2;
  }

  private detak(t: number, delta: number) {
    this.hadir = Phaser.Math.Clamp(this.hadir + (this.jamMenyapu() ? 1 : -1) * (delta / 800), 0, 1);
    const ada = this.hadir > 0;
    this.s.setVisible(ada).setAlpha(this.hadir);
    this.sapu.setVisible(ada).setAlpha(this.hadir);
    this.bayang.setVisible(ada).setAlpha(this.hadir * BAYANGAN_KAKI);
    if (this.s.input) this.s.input.enabled = this.hadir > 0.5;
    if (!ada) return;

    const kaki = NYAPU.kaki;
    // pemain datang: berhenti menyapu, sapu ditegakkan, menatapnya
    const tatap = arahKePemain(this.s.x, kaki);
    if (tatap) {
      this.s.anims.stop();
      if (tatap === 'left' || tatap === 'right') {
        this.arah = tatap === 'right' ? 1 : -1;
        this.pose(2, kaki);
      } else {
        this.s.setTexture('nenek', ROW.idle[tatap] * 4).setFlipX(false);
        this.sapu.setVisible(true).setPosition(this.s.x + 6, kaki + 1);
        this.bayang.setPosition(this.s.x, kaki - 1);
      }
      return;
    }
    if (t < this.berhenti) {
      this.pose(2, kaki);
      return;
    }
    // maju pelan; di ujung halaman berhenti sebentar lalu berbalik
    this.s.x += this.arah * LAJU * (Math.min(delta, 50) / 1000);
    if (this.s.x > NYAPU.x1 || this.s.x < NYAPU.x0) {
      this.s.x = Phaser.Math.Clamp(this.s.x, NYAPU.x0, NYAPU.x1);
      this.arah *= -1;
      this.berhenti = t + Phaser.Math.Between(1500, 3000);
    }
    if ((this.jedaAyun -= delta) <= 0) {
      this.jedaAyun = AYUN;
      this.ayun ^= 1;
      if (this.ayun && this.hadir > 0.9) {
        srek(this.s.x + this.arah * 12, kaki);
        this.kepul(this.s.x + this.arah * 15, kaki);
      }
    }
    this.pose(this.ayun, kaki);
  }

  /** Frame pose menyapu (0-1 mengibas, 2 sapu ditegakkan), menghadap arah jalannya. */
  private pose(f: number, kaki: number) {
    if (this.s.texture.key !== 'nenek_nyapu') this.s.setTexture('nenek_nyapu', f);
    else this.s.setFrame(f);
    this.s.setFlipX(this.arah < 0);
    this.sapu.setVisible(false);
    this.bayang.setPosition(this.s.x, kaki - 1);
  }

  /** Debu tanah yang tersapu ke depan. */
  private kepul(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const d = this.debu.find((r) => !r.visible);
      if (!d) return;
      d.setPosition(x + Phaser.Math.Between(-2, 2), y - 1).setVisible(true).setAlpha(0.7).setDepth(kedalaman(y) + 0.2);
      this.scene.tweens.add({
        targets: d,
        x: d.x + this.arah * Phaser.Math.Between(3, 7),
        y: d.y - Phaser.Math.Between(1, 3),
        alpha: 0,
        duration: 450,
        onComplete: () => d.setVisible(false),
      });
    }
  }
}

/**
 * Pose menyapu dari frame diam-menghadap-kanan si nenek (frame 8), digambar
 * di kanvas 48×32 dengan tokohnya di tengah (kolom 8-39) supaya sapunya
 * muat di depan dan pencerminan ke kiri tetap berporos di badannya.
 *
 * Koordinat rupa warga: kepala baris 12-23, lengan menggantung kolom 13-14
 * baris 24-27, badan kolom 15-19, kain baris 28-29. Kepala dan badan atas
 * condong sepiksel ke depan; lengan diganti dua tangan yang menggenggam
 * gagang di depan perut; gagangnya turun serong ke ikatan merah dan lidi
 * yang mengembang di tanah. Frame 0 dan 1: lidi dikibas ke depan dan ke
 * belakang. Frame 2: berdiri tegak, sapu ditegakkan di depannya.
 */
function buatPoseNyapu(scene: Phaser.Scene) {
  const tx = scene.textures;
  if (tx.exists('nenek_nyapu') || !tx.exists('nenek')) return;
  const src = tx.get('nenek').getSourceImage() as HTMLCanvasElement;
  const S = 32;
  const W = 48;
  const O = 8;
  const kanvas = tx.createCanvas('nenek_nyapu', W * 3, S)!;
  const ctx = kanvas.getContext();
  const TINTA = '#45293f';
  const KAYU = '#7a4a24';
  const IKAT = '#c8322a';
  const LIDI = '#d9b870';
  const LIDI2 = '#a8844a';
  const hex = (d: Uint8ClampedArray, i: number) =>
    d[i + 3] ? '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null;
  for (let f = 0; f < 3; f++) {
    const ox = f * W;
    ctx.drawImage(src, 0, 2 * S, S, S, ox + O, 0, S, S);
    const img = ctx.getImageData(ox, 0, W, S);
    const d = img.data;
    const i = (x: number, y: number) => (y * W + x) * 4;
    const ambil = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= S ? null : hex(d, i(x, y)));
    const taruh = (x: number, y: number, w: string | null) => {
      if (x < 0 || y < 0 || x >= W || y >= S) return;
      const j = i(x, y);
      if (!w) {
        d[j + 3] = 0;
        return;
      }
      const n = parseInt(w.slice(1), 16);
      d[j] = (n >> 16) & 255;
      d[j + 1] = (n >> 8) & 255;
      d[j + 2] = n & 255;
      d[j + 3] = 255;
    };
    const kulit = ambil(O + 14, 26) ?? '#d9a07a';
    const baju = ambil(O + 17, 25) ?? '#4f8a5a';
    // condong ke depan: kepala dan badan atas bergeser sepiksel ke kanan
    if (f < 2) {
      for (let y = 12; y <= 25; y++) {
        for (let x = W - 1; x > 0; x--) taruh(x, y, ambil(x - 1, y));
        taruh(0, y, null);
      }
    }
    // lengan menggantung dihapus, tepi badan ditutup
    for (let y = 24; y <= 27; y++) for (const x of [O + 13, O + 14]) taruh(x, y, null);
    for (let y = 25; y <= 27; y++) taruh(O + 15, y, TINTA);
    // sapu: [gagang dari, gagang ke, pusat ikatan lidi, arah kibas]
    const gagang =
      f === 0
        ? { a: [O + 20, 24], b: [O + 29, 28], kibas: 2 }
        : f === 1
          ? { a: [O + 21, 24], b: [O + 26, 28], kibas: -2 }
          : { a: [O + 22, 15], b: [O + 22, 27], kibas: 0 };
    const titik: [number, number, string][] = [];
    const [ax, ay] = gagang.a;
    const [bx, by] = gagang.b;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) titik.push([Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), KAYU]);
    // ikatan merah dan lidi mengembang sampai tanah (baris 31)
    titik.push([bx, by + 1, IKAT], [bx + 1, by + 1, IKAT]);
    for (let y = by + 2; y <= 31; y++) {
      const lebar = y - by + 1;
      for (let x = bx - lebar + 1 + gagang.kibas; x <= bx + lebar + gagang.kibas; x++) {
        if ((x + y) % 2 === 0 || y === 31) titik.push([x, y, (x + y) % 3 ? LIDI : LIDI2]);
      }
    }
    // tangan: lengan baju dari bahu, dua kepalan di gagang
    const tangan: [number, number, string][] =
      f === 2
        ? [[O + 19, 24, baju], [O + 20, 24, kulit], [O + 21, 24, kulit], [O + 21, 23, kulit]]
        : [[O + 19, 25, baju], [O + 20, 25, baju], [O + 21, 25, kulit], [O + 22, 26, kulit], [O + 23, 26, kulit]];
    const isi = new Set([...titik, ...tangan].map(([x, y]) => `${x},${y}`));
    for (const [x, y] of [...titik, ...tangan]) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isi.has(`${nx},${ny}`) && !ambil(nx, ny) && ny <= 31) taruh(nx, ny, TINTA);
      }
    }
    for (const [x, y, w] of titik) taruh(x, y, w);
    for (const [x, y, w] of tangan) taruh(x, y, w);
    ctx.putImageData(img, ox, 0);
    kanvas.add(f, 0, ox, 0, W, S);
  }
  kanvas.refresh();
}
