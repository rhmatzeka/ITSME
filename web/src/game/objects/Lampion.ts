import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spritesheetTeks } from './piksel';

/** Pita air yang sama dengan Arus.ts: sungai mendatar mengalir ke timur, sungai tegak ke selatan. */
const PITA = [
  { x0: 0, x1: 624, y0: 382, y1: 399, tegak: false },
  // tegak: di kiri dermaga mancing (x 25-48), supaya tidak hanyut menembus papannya
  { x0: 15, x1: 20, y0: 0, y1: 368, tegak: true },
] as const;

/** Paling banyak sekian lampion hanyut bersamaan. */
const JUMLAH = 6;

/** Kertas lampion: merah, jingga, kuning. */
const KERTAS = [
  { b: '#d8403a', c: '#ff9a6a' },
  { b: '#e8822a', c: '#ffc070' },
  { b: '#e8c03a', c: '#fff0a0' },
];

/** Sama dengan lampu jalan dan jendela: cahaya ADD di atas tirai malam. */
const CAHAYA = DEPTH.above + 60;

interface Satu {
  s: Phaser.GameObjects.Sprite;
  nyala: Phaser.GameObjects.Sprite;
  pendar: Phaser.GameObjects.Image;
  pantul: Phaser.GameObjects.Image;
  tegak: boolean;
  x: number;
  y: number;
  laju: number;
  fase: number;
  hidup: boolean;
  muncul: number;
}

/**
 * Lampion air: lentera kertas berlilin yang dilepas warga ke sungai di malam
 * hari, hanyut pelan searah arus sambil bergoyang, cahayanya memantul
 * memanjang di air. Lewat di bawah jembatan (lapisan lantai menutupinya) dan
 * cahayanya ikut padam di situ, lalu muncul lagi di seberang.
 *
 * Seperti jendela rumah: gambar lampionnya ada di bawah tirai malam (supaya
 * jembatan dan teratai menutupinya), salinan ADD-nya di atas tirai yang
 * membuatnya benar-benar menyala.
 */
export class Lampion {
  private semua: Satu[] = [];
  private jedaLahir = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    /** Titik ini bukan air terbuka (tepi, batu, petak jembatan) — lihat WorldScene.pembacaAir dan adaBenda. */
    private kering: (x: number, y: number) => boolean
  ) {
    this.buatTekstur();
    for (let i = 0; i < JUMLAH; i++) {
      const warna = i % KERTAS.length;
      const s = scene.add.sprite(0, 0, `lampion_${warna}`, 0).setDepth(DEPTH.ground + 0.6).setVisible(false);
      const nyala = scene.add.sprite(0, 0, `lampion_${warna}`, 0).setDepth(CAHAYA + 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const pendar = scene.add.image(0, 0, 'lampion_pendar').setDepth(CAHAYA).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const pantul = scene.add.image(0, 0, 'lampion_pantul').setDepth(CAHAYA).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.semua.push({ s, nyala, pendar, pantul, tegak: false, x: 0, y: 0, laju: 0, fase: 0, hidup: false, muncul: 0 });
    }
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.detak, this));
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    KERTAS.forEach(({ b, c }, i) => {
      // kotak kertas berbingkai bambu, lilin di dalamnya berkedip (dua frame)
      spritesheetTeks(
        this.scene,
        `lampion_${i}`,
        [
          ['.aaaaa.', 'abbbbba', 'abcccba', 'abcdcba', 'abcccba', 'abbbbba', '.aeeea.'],
          ['.aaaaa.', 'abbbbba', 'abcccba', 'abccdba', 'abcdcba', 'abbbbba', '.aeeea.'],
        ],
        { a: '#5a3a1e', b, c, d: '#fffbe0', e: '#8a5a30' }
      );
    });
    if (!tx.exists('lampion_pendar')) {
      const k = tx.createCanvas('lampion_pendar', 32, 32)!;
      const ctx = k.getContext();
      const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,200,120,0.85)');
      gr.addColorStop(0.35, 'rgba(255,170,90,0.35)');
      gr.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 32, 32);
      k.refresh();
    }
    if (!tx.exists('lampion_pantul')) {
      // pantulan memanjang di air, bergaris-garis seperti riak
      const k = tx.createCanvas('lampion_pantul', 6, 14)!;
      const ctx = k.getContext();
      for (let y = 0; y < 14; y += 2) {
        const a = 0.55 * (1 - y / 14);
        const w = y % 4 === 0 ? 4 : 2;
        ctx.fillStyle = `rgba(255,190,110,${a})`;
        ctx.fillRect(3 - w / 2, y, w, 1);
      }
      k.refresh();
    }
  }

  /** Lahir di titik air terbuka acak, sebisanya di dalam kamera supaya langsung terlihat. */
  private lahir(l: Satu) {
    const v = this.scene.cameras.main.worldView;
    let cadangan: { x: number; y: number; tegak: boolean } | null = null;
    for (let n = 0; n < 30; n++) {
      const p = Math.random() < 0.3 ? PITA[1] : PITA[0];
      const x = Phaser.Math.Between(p.x0, p.x1);
      const y = Phaser.Math.Between(p.y0, p.y1);
      if (this.kering(x, y) || this.kering(x - 3, y) || this.kering(x + 3, y)) continue;
      if (v.contains(x, y)) {
        cadangan = { x, y, tegak: p.tegak };
        break;
      }
      cadangan ??= { x, y, tegak: p.tegak };
    }
    if (!cadangan) return;
    Object.assign(l, cadangan, {
      laju: Phaser.Math.FloatBetween(3.5, 6.5),
      fase: Math.random() * Math.PI * 2,
      hidup: true,
      muncul: 0,
    });
  }

  private detak(t: number, delta: number) {
    const g = this.gelap();
    const dt = Math.min(delta, 100) / 1000;
    // dilepas mulai senja; menjelang pagi tidak ada yang baru
    if (g > 0.5 && (this.jedaLahir -= delta) <= 0) {
      this.jedaLahir = Phaser.Math.Between(4000, 9000);
      const kosong = this.semua.find((l) => !l.hidup);
      if (kosong) this.lahir(kosong);
    }
    const z = this.scene.cameras.main.zoom;
    const kunci = (v: number) => Math.round(v * z) / z;
    for (const l of this.semua) {
      if (!l.hidup) {
        if (l.s.visible) for (const o of [l.s, l.nyala, l.pendar, l.pantul]) o.setVisible(false);
        continue;
      }
      if (l.tegak) l.y += l.laju * dt;
      else l.x += l.laju * dt;
      // muncul pelan saat dilepas, padam pelan saat pagi datang
      l.muncul = Math.min(1, l.muncul + dt / 1.5);
      const habis = l.tegak ? l.y > PITA[1].y1 : l.x > PITA[0].x1 + 6;
      if (habis || g < 0.15) {
        l.hidup = false;
        continue;
      }
      const goyang = Math.sin(t / 700 + l.fase);
      const x = kunci(l.x + (l.tegak ? goyang * 0.8 : 0));
      const y = kunci(l.y + (l.tegak ? 0 : goyang * 0.6));
      // di bawah jembatan atau batu: gambarnya tertutup lapisan lantai, cahayanya padam
      const tertutup = this.kering(l.x, l.y);
      const a = l.muncul * Math.min(1, g * 1.4);
      const f = Math.floor(t / 180 + l.fase * 3) % 2;
      l.s.setVisible(true).setPosition(x, y).setFrame(f).setAlpha(l.muncul);
      const terang = tertutup ? 0 : a;
      // salinan ADD-nya tipis saja: cukup membuat kertasnya berpendar, warnanya tetap terbaca
      l.nyala.setVisible(terang > 0).setPosition(x, y).setFrame(f).setAlpha(terang * 0.35);
      l.pendar.setVisible(terang > 0).setPosition(x, y).setScale(0.75 + Math.sin(t / 160 + l.fase) * 0.04).setAlpha(terang * 0.6);
      l.pantul.setVisible(terang > 0).setPosition(x, y + 10).setAlpha(terang * (0.75 + goyang * 0.15));
    }
  }
}
