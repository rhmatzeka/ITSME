import Phaser from 'phaser';
import { AWAN, DEPTH, LAMPU, TILE, WAKTU } from '../config';

export type ModeWaktu = 'otomatis' | 'siang' | 'senja' | 'malam';

const KEDALAMAN = {
  awan: DEPTH.above + 40,
  tirai: DEPTH.above + 50,
  cahaya: DEPTH.above + 60,
} as const;

/**
 * Suasana desa: bayangan awan yang lewat, siang-malam, dan lampu jalan.
 *
 * Ketiganya satu kelas karena saling bergantung: bayangan awan memudar saat
 * malam (tidak ada matahari yang membuatnya), dan lampu menyala persis
 * sebanyak langitnya gelap. Semuanya digambar di atas dunia tapi di bawah
 * efek petir, jadi petir tetap menyilaukan di malam hari.
 */
export class Suasana {
  private tirai: Phaser.GameObjects.Rectangle;
  private awan: Phaser.GameObjects.Image[] = [];
  private lampu: { pendar: Phaser.GameObjects.Image; inti: Phaser.GameObjects.Image }[] = [];
  private mode: ModeWaktu = 'otomatis';
  /** Warna tirai yang sedang tampil, 0..255 per kanal. */
  private warna = { r: 255, g: 255, b: 255 };
  private peralihan?: Phaser.Tweens.Tween;
  private malam = 0;

  constructor(
    private scene: Phaser.Scene,
    private lebar: number,
    private tinggi: number
  ) {
    this.buatTekstur();

    /*
     * Tirai MULTIPLY selebar peta. Putih tidak mengubah apa pun, biru gelap
     * menggelapkan sambil mendinginkan warnanya — lebih mirip malam daripada
     * lapisan hitam transparan yang cuma membuat semuanya kusam.
     */
    this.tirai = scene.add
      .rectangle(0, 0, lebar, tinggi, 0xffffff)
      .setOrigin(0)
      .setDepth(KEDALAMAN.tirai)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.pasangAwan();
    this.pasangLampu();

    scene.events.on('update', this.detak, this);
    // jam asli terus berjalan: dicek ulang tiap setengah menit
    const jam = scene.time.addEvent({ delay: 30_000, loop: true, callback: () => this.terapkan(false) });
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.detak, this);
      jam.remove();
    });
  }

  /** Ganti pilihan waktu dari panel Setelan. */
  setMode(mode: ModeWaktu, langsung = false) {
    this.mode = mode;
    this.terapkan(!langsung);
  }

  /* ---------------- tekstur, digambar sekali ---------------- */

  private buatTekstur() {
    const tx = this.scene.textures;

    /*
     * Bayangan awan: gabungan beberapa lingkaran, digambar per piksel dan
     * tanpa tepi halus. Di zoom 3 tiap piksel dunia jadi 3 piksel layar,
     * jadi tepinya berundak seperti semua benda lain di peta — bukan gumpalan
     * buram yang terlihat seperti tempelan dari gaya lain.
     */
    for (let v = 0; v < 3; v++) {
      const key = `awan_${v}`;
      if (tx.exists(key)) continue;
      const w = 96 + v * 18;
      const h = 44 + v * 6;
      const kanvas = tx.createCanvas(key, w, h)!;
      const ctx = kanvas.getContext();
      const acak = new Phaser.Math.RandomDataGenerator([`awan${v}`]);
      const bulat: [number, number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const r = acak.between(12, 20);
        bulat.push([acak.between(r, w - r), acak.between(Math.min(r, h - r), Math.max(r, h - r)), r]);
      }
      const data = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (bulat.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)) {
            // hijau sangat gelap, bukan hitam: bayangan di rumput tetap hijau
            const i = (y * w + x) * 4;
            data.data[i] = 11;
            data.data[i + 1] = 22;
            data.data[i + 2] = 6;
            data.data[i + 3] = 255;
          }
        }
      }
      ctx.putImageData(data, 0, 0);
      kanvas.refresh();
    }

    /*
     * Cahaya lampu: pendar lebar di tanah dan inti kecil di lenteranya.
     * Gradien disusun berundak (beberapa cincin rata), bukan gradien halus,
     * supaya pendarnya ikut terbaca sebagai pixel art.
     */
    const cahaya = (key: string, r: number, pusat: number) => {
      if (tx.exists(key)) return;
      const kanvas = tx.createCanvas(key, r * 2, r * 2)!;
      const ctx = kanvas.getContext();
      const cincin = 6;
      for (let i = cincin; i >= 1; i--) {
        const f = i / cincin;
        ctx.fillStyle = `rgba(255, 196, 110, ${pusat * (1 - f) ** 1.4 + 0.02})`;
        ctx.beginPath();
        ctx.arc(r, r, r * f, 0, Math.PI * 2);
        ctx.fill();
      }
      kanvas.refresh();
    };
    cahaya('lampu_pendar', LAMPU.pendar, 0.3);
    cahaya('lampu_inti', 7, 0.9);
  }

  /* ---------------- awan ---------------- */

  private pasangAwan() {
    for (let i = 0; i < AWAN.jumlah; i++) {
      const a = this.scene.add
        .image(0, 0, `awan_${i % 3}`)
        .setDepth(KEDALAMAN.awan)
        .setAlpha(AWAN.pekat);
      // disebar di seluruh peta sejak awal, bukan antre dari tepi kiri
      a.setPosition(
        Phaser.Math.Between(0, this.lebar),
        Phaser.Math.Between(0, this.tinggi)
      );
      this.awan.push(a);
    }
  }

  private detak(_t: number, delta: number) {
    const dt = delta / 1000;
    for (const a of this.awan) {
      a.x += AWAN.laju * dt;
      a.y += AWAN.laju * AWAN.miring * dt;
      // keluar di kanan/bawah → masuk lagi dari kiri di ketinggian acak
      if (a.x - a.width / 2 > this.lebar || a.y - a.height / 2 > this.tinggi) {
        a.x = -a.width / 2 - Phaser.Math.Between(0, 60);
        a.y = Phaser.Math.Between(-a.height / 2, this.tinggi - a.height);
      }
    }
  }

  /* ---------------- lampu ---------------- */

  private pasangLampu() {
    for (const [tx, ty] of LAMPU.tiang) {
      const x = tx * TILE + LAMPU.lentera.x;
      const y = ty * TILE + LAMPU.lentera.y;
      const pendar = this.scene.add
        .image(x, y + 10, 'lampu_pendar')
        .setDepth(KEDALAMAN.cahaya)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      const inti = this.scene.add
        .image(x, y, 'lampu_inti')
        .setDepth(KEDALAMAN.cahaya + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.lampu.push({ pendar, inti });
    }
    // kedip halus, tiap lampu sendiri-sendiri, hanya kalau sedang menyala
    this.scene.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        if (this.malam <= 0.02) return;
        for (const l of this.lampu) {
          const k = 0.9 + Math.random() * 0.1;
          l.pendar.setAlpha(this.malam * k);
          l.inti.setAlpha(this.malam * (0.85 + Math.random() * 0.15));
        }
      },
    });
  }

  /* ---------------- siang-malam ---------------- */

  private jamSekarang() {
    if (this.mode !== 'otomatis') return WAKTU.preset[this.mode];
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  private warnaUntuk(jam: number) {
    const t = WAKTU.titik;
    for (let i = 0; i < t.length - 1; i++) {
      const [j0, c0] = t[i];
      const [j1, c1] = t[i + 1];
      if (jam >= j0 && jam <= j1) {
        const f = j1 === j0 ? 0 : (jam - j0) / (j1 - j0);
        const a = Phaser.Display.Color.IntegerToRGB(c0);
        const b = Phaser.Display.Color.IntegerToRGB(c1);
        return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f };
      }
    }
    return { r: 255, g: 255, b: 255 };
  }

  /** Seberapa "malam" sebuah warna: 0 siang, 1 semalam-malamnya. */
  private kegelapan(w: { r: number; g: number; b: number }) {
    const lum = (c: { r: number; g: number; b: number }) => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    const malam = Phaser.Display.Color.IntegerToRGB(WAKTU.titik[0][1]);
    return Phaser.Math.Clamp((1 - lum(w)) / (1 - lum(malam)), 0, 1);
  }

  private terapkan(beralih: boolean) {
    const tujuan = this.warnaUntuk(this.jamSekarang());
    this.peralihan?.stop();
    if (!beralih) {
      this.warna = tujuan;
      this.pakaiWarna();
      return;
    }
    const dari = { ...this.warna };
    this.peralihan = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: WAKTU.peralihan,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 1;
        this.warna = {
          r: dari.r + (tujuan.r - dari.r) * f,
          g: dari.g + (tujuan.g - dari.g) * f,
          b: dari.b + (tujuan.b - dari.b) * f,
        };
        this.pakaiWarna();
      },
    });
  }

  private pakaiWarna() {
    const { r, g, b } = this.warna;
    this.tirai.setFillStyle(Phaser.Display.Color.GetColor(Math.round(r), Math.round(g), Math.round(b)));
    this.malam = this.kegelapan(this.warna);
    // bayangan awan butuh matahari: memudar seiring gelapnya langit
    for (const a of this.awan) a.setAlpha(AWAN.pekat * (1 - this.malam * 0.85));
    for (const l of this.lampu) {
      l.pendar.setAlpha(this.malam);
      l.inti.setAlpha(this.malam);
    }
  }
}
