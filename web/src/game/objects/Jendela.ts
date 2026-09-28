import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Sama dengan lampu jalan: di atas tirai malam. */
const KEDALAMAN_CAHAYA = DEPTH.above + 60;

/**
 * Kaca tiap jendela di semua rumah, dibaca dari map_full.png: pojok kiri atas
 * kacanya lalu polanya — `f` kilau putih, `g` biru muda, `i` biru tua, titik =
 * kusen atau dinding. Cahayanya digambar persis di piksel kaca saja, jadi
 * kusen dan palang jendela tetap gelap.
 *
 * Kios Tech Stack tidak ada di sini: ia tenda, tanpa jendela.
 */
const KACA: { x: number; y: number; pola: string[] }[] = [
  // About: dua jendela berdaun dua di kiri-kanan pintu
  { x: 164, y: 251, pola: ['fgg...iifi', '......ifii', 'ifi...fggf', 'fgf...ggfg', '......gfgg', 'fgg...fggf'] },
  { x: 200, y: 251, pola: ['iifi...fgg', 'ifii......', 'fggf...ifi', 'ggfg...fgf', 'gfgg......', 'fggf...fgg'] },
  // Projects: jendela loteng di atas pintu
  { x: 468, y: 66, pola: ['ifiif', 'fiifi', 'iifii', 'gfggf', 'fggfg'] },
  { x: 477, y: 66, pola: ['ifiif', 'fiifi', 'iifii', 'gfggf', 'fggfg'] },
  // CV: dua jendela berdaun di kiri-kanan pintu, dua jendela kecil di tiap sayap
  { x: 414, y: 308, pola: ['if', 'if', 'fg', '..', 'fg'] },
  { x: 438, y: 308, pola: ['if', 'if', 'fg', '..', 'fg'] },
  { x: 405, y: 304, pola: ['if', '..', 'fg'] },
  { x: 405, y: 311, pola: ['if', 'fg'] },
  { x: 447, y: 304, pola: ['if', '..', 'fg'] },
  { x: 447, y: 311, pola: ['if', 'fg'] },
  // Contact: dua jendela lebar berdaun dua
  { x: 271, y: 442, pola: ['..ii', 'fiif', 'iifi', 'gfgg', 'fggf'] },
  { x: 279, y: 442, pola: ['fi..', 'iiif', 'iifi', 'gfgg', 'fggf'] },
  { x: 315, y: 442, pola: ['..ii', 'fiif', 'iifi', 'gfgg', 'fggf'] },
  { x: 323, y: 442, pola: ['fi..', 'iiif', 'iifi', 'gfgg', 'fggf'] },
];

/**
 * Genangan cahaya di tanah di bawah jendela yang dekat tanah: tengah
 * jendelanya dan dasar dinding rumahnya. Jendela loteng Projects tidak
 * punya — tanah di bawahnya jauh dan tertutup pintu.
 */
const GENANGAN = [
  { x: 169, y: 263 },
  { x: 205, y: 263 },
  { x: 415, y: 320 },
  { x: 439, y: 320 },
  { x: 279, y: 458 },
  { x: 323, y: 458 },
];

/**
 * Jendela tempat orang menonton TV: jendela kiri rumah Contact (dua daun,
 * nomor 10-11 di KACA) dan genangan di bawahnya (nomor 4 di GENANGAN).
 * Lampu ruangannya redup; yang menerangi kaca cahaya biru TV yang berkedip.
 */
const TV = { kaca: [10, 11] as number[], genangan: 4 };

/** Warna layar TV yang bergantian — adegan terang, biru, hijau lapangan bola. */
const WARNA_TV = [0x6f9cff, 0x8fb8ff, 0xb8d4ff, 0x9fe0b0, 0xffffff, 0x7f8cff];

/** Siluet orang di balik kaca: kepala lalu bahu, 4 piksel lebar. */
const SILUET = ['.xx.', '.xx.', 'xxxx', 'xxxx', 'xxxx', 'xxxx'];

/**
 * Jendela semua rumah yang menyala saat malam.
 *
 * Cahayanya ADD di atas tirai malam — cara yang sama dengan lampu jalan —
 * bukan kaca kuning yang ditempel. Kaca pekat di atas tirai akan menutupi
 * kepala siapa pun yang berdiri di depan jendela; cahaya ADD cuma
 * menerangi yang ada di baliknya.
 *
 * Sesekali siluet orang lewat di balik kaca, dari satu sisi ke sisi lain,
 * dan tanah di depan tiap jendela ikut kena cahaya hangatnya.
 */
export class Jendela {
  private kaca: Phaser.GameObjects.Sprite[] = [];
  private genangan: Phaser.GameObjects.Image[] = [];
  /**
   * Pendar tipis di sekeliling tiap jendela. Kaca jendela CV cuma selebar dua
   * piksel — tanpa pendar, jendela yang menyala nyaris tak terlihat dari jauh.
   */
  private pendar: Phaser.GameObjects.Image[] = [];
  private jedaSiluet = 6000;
  private lewat = false;
  /** Lapisan cahaya TV di atas kaca jendela ruang tengah — lihat TV. */
  private tv: Phaser.GameObjects.Sprite[] = [];
  private tvPendar: Phaser.GameObjects.Image;
  private tvTerang = 0.6;
  private tvTujuan = 0.6;
  private jedaTv = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    KACA.forEach(({ x, y, pola }, i) => {
      const w = pola[0].length;
      const h = pola.length;
      this.pendar.push(
        scene.add
          .image(x + w / 2, y + h / 2, 'jendela_pendar')
          .setScale((w + 10) / 64, (h + 10) / 64)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setAlpha(0)
      );
      this.kaca.push(
        scene.add
          .sprite(x, y, `jendela_${i}`, 0)
          .setOrigin(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setAlpha(0)
      );
    });
    for (const i of TV.kaca) {
      const k = this.kaca[i];
      this.tv.push(
        scene.add
          .sprite(k.x, k.y, k.texture.key, 0)
          .setOrigin(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA + 0.1)
          .setAlpha(0)
      );
    }
    {
      const a = KACA[TV.kaca[0]];
      const b = KACA[TV.kaca[TV.kaca.length - 1]];
      const w = b.x + b.pola[0].length - a.x;
      this.tvPendar = scene.add
        .image(a.x + w / 2, a.y + a.pola.length / 2, 'jendela_pendar')
        .setScale((w + 16) / 64, (a.pola.length + 14) / 64)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(KEDALAMAN_CAHAYA)
        .setAlpha(0);
    }
    for (const { x, y } of GENANGAN) {
      this.genangan.push(
        scene.add
          .image(x, y + 6, 'jendela_genangan')
          .setScale(1 / 4)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setAlpha(0)
      );
    }
    scene.events.on('update', this.detak, this);
  }

  /**
   * Frame 0 kaca menyala polos; frame berikutnya siluet yang bergeser satu
   * piksel per frame dari luar kiri sampai luar kanan kaca.
   */
  private buatTekstur() {
    KACA.forEach(({ pola }, i) => {
      const key = `jendela_${i}`;
      const lebar = pola[0].length;
      const geser = Array.from({ length: lebar + SILUET[0].length + 1 }, (_, n) => n - SILUET[0].length);
      const frame = [null, ...geser].map((o) =>
        pola.map((baris, y) =>
          [...baris]
            .map((c, x) => {
              if (c === '.' || o === null) return c;
              const sx = x - o;
              return SILUET[y]?.[sx] === 'x' ? 's' : c;
            })
            .join('')
        )
      );
      // warna yang DITAMBAHKAN ke kaca yang sudah digelapkan tirai malam
      spritesheetTeks(this.scene, key, frame, { f: '#ffe9a8', g: '#f5c46a', i: '#d9983f', s: '#4a2c12' });
    });
    const tx = this.scene.textures;
    if (!tx.exists('jendela_pendar')) {
      const k = tx.createCanvas('jendela_pendar', 64, 64)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255, 200, 110, 0.5)');
      g.addColorStop(0.5, 'rgba(255, 180, 90, 0.18)');
      g.addColorStop(1, 'rgba(255, 170, 80, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      k.refresh();
    }
    if (!tx.exists('jendela_genangan')) {
      const w = 26 * 4;
      const h = 12 * 4;
      const k = tx.createCanvas('jendela_genangan', w, h)!;
      const ctx = k.getContext();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      g.addColorStop(0, 'rgba(255, 200, 120, 0.55)');
      g.addColorStop(0.5, 'rgba(255, 180, 100, 0.2)');
      g.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      k.refresh();
    }
  }

  private detak(_t: number, delta: number) {
    // lampu rumah menyala setelah senja, sedikit lebih lambat dari lampu jalan
    const nyala = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.5, 0, 1);
    this.kaca.forEach((k, i) => k.setAlpha(TV.kaca.includes(i) ? nyala * 0.2 : nyala));
    this.pendar.forEach((p, i) => p.setAlpha(TV.kaca.includes(i) ? nyala * 0.15 : nyala));
    this.genangan.forEach((g, i) => g.setAlpha(i === TV.genangan ? nyala * 0.3 : nyala));
    this.kedipTv(delta, nyala);
    if (nyala < 0.5 || this.lewat) return;
    if ((this.jedaSiluet -= delta) > 0) return;
    // semua jendela berbagi satu giliran siluet, jadi jedanya pendek
    this.jedaSiluet = Phaser.Math.Between(4000, 9000);
    // jendela TV tidak ikut: lapisan cahayanya tidak bisa berganti frame bersama kacanya
    this.siluet(Phaser.Utils.Array.GetRandom(this.kaca.filter((_, i) => !TV.kaca.includes(i))));
  }

  /**
   * Cahaya TV: kerasnya melompat-lompat tidak beraturan (gambar yang
   * berganti), sesekali adegannya ganti — warnanya berubah dan terangnya
   * menyentak — dan genangan di tanah depan jendelanya ikut membiru.
   */
  private kedipTv(delta: number, nyala: number) {
    if ((this.jedaTv -= delta) <= 0) {
      this.jedaTv = Phaser.Math.Between(70, 260);
      if (Math.random() < 0.12) {
        // ganti adegan
        const w = Phaser.Utils.Array.GetRandom(WARNA_TV);
        for (const t of this.tv) t.setTint(w);
        this.tvPendar.setTint(w);
        this.genangan[TV.genangan].setTint(w);
        this.tvTujuan = Phaser.Math.FloatBetween(0.3, 1);
        this.tvTerang = this.tvTujuan;
      } else {
        this.tvTujuan = Phaser.Math.Clamp(this.tvTujuan + Phaser.Math.FloatBetween(-0.25, 0.25), 0.35, 1);
      }
    }
    this.tvTerang += (this.tvTujuan - this.tvTerang) * Math.min(1, delta / 60);
    const a = nyala * this.tvTerang;
    for (const t of this.tv) t.setAlpha(a);
    this.tvPendar.setAlpha(a * 0.8);
    this.genangan[TV.genangan].setAlpha(nyala * (0.25 + 0.5 * this.tvTerang));
  }

  /** Satu orang lewat di balik satu jendela, ke kiri atau ke kanan. */
  private siluet(kaca: Phaser.GameObjects.Sprite) {
    const n = kaca.texture.frameTotal - 1; // tanpa frame __BASE
    const urut = Array.from({ length: n - 1 }, (_, i) => i + 1);
    if (Math.random() < 0.5) urut.reverse();
    this.lewat = true;
    let i = 0;
    this.scene.time.addEvent({
      delay: 150,
      repeat: urut.length,
      callback: () => {
        if (i < urut.length) kaca.setFrame(urut[i++]);
        else {
          kaca.setFrame(0);
          this.lewat = false;
        }
      },
    });
  }
}
