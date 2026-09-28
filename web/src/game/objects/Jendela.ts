import Phaser from 'phaser';
import { ABOUT, DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Sama dengan lampu jalan: di atas tirai malam. */
const KEDALAMAN_CAHAYA = DEPTH.above + 60;

/**
 * Letak kaca tiap jendela, 10×6 piksel dari pojok kiri atas kaca, dibaca dari
 * map_full.png: `f` kilau putih, `g` biru muda, `i` biru tua, titik = kusen
 * atau dinding. Cahayanya digambar persis di piksel kaca saja, jadi kusen dan
 * palang jendela tetap gelap.
 */
const KACA = {
  kiri: ['fgg...iifi', '......ifii', 'ifi...fggf', 'fgf...ggfg', '......gfgg', 'fgg...fggf'],
  kanan: ['iifi...fgg', 'ifii......', 'fggf...ifi', 'ggfg...fgf', 'gfgg......', 'fggf...fgg'],
};

/** Siluet orang di balik kaca: kepala lalu bahu, 4 piksel lebar. */
const SILUET = ['.xx.', '.xx.', 'xxxx', 'xxxx', 'xxxx', 'xxxx'];

/**
 * Jendela rumah About yang menyala saat malam.
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
  private jedaSiluet = 6000;
  private lewat = false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    ABOUT.jendela.forEach(({ x, y }, i) => {
      const key = i === 0 ? 'jendela_kiri' : 'jendela_kanan';
      this.kaca.push(
        scene.add
          .sprite(x, y, key, 0)
          .setOrigin(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setAlpha(0)
      );
      this.genangan.push(
        scene.add
          .image(x + 5, ABOUT.dasarRumah + 6, 'jendela_genangan')
          .setScale(1 / 4)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setAlpha(0)
      );
    });
    scene.events.on('update', this.detak, this);
  }

  /**
   * Frame 0 kaca menyala polos; frame berikutnya siluet yang bergeser satu
   * piksel per frame dari luar kiri sampai luar kanan kaca.
   */
  private buatTekstur() {
    const geser = Array.from({ length: 10 + SILUET[0].length + 1 }, (_, i) => i - SILUET[0].length);
    for (const [key, pola] of [
      ['jendela_kiri', KACA.kiri],
      ['jendela_kanan', KACA.kanan],
    ] as const) {
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
    }
    const tx = this.scene.textures;
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
    for (const k of this.kaca) k.setAlpha(nyala);
    for (const g of this.genangan) g.setAlpha(nyala);
    if (nyala < 0.5 || this.lewat) return;
    if ((this.jedaSiluet -= delta) > 0) return;
    this.jedaSiluet = Phaser.Math.Between(7000, 15000);
    this.siluet(Phaser.Utils.Array.GetRandom(this.kaca));
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
