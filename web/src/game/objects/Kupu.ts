import Phaser from 'phaser';
import { KUPU, kedalaman } from '../config';

/**
 * Kupu-kupu yang beterbangan di taman.
 *
 * Tiga hal yang membedakannya dari Penghuni, dan itulah alasan ia jadi kelas
 * sendiri alih-alih satu entri lagi di tabel PENGHUNI:
 *
 * 1. Ia melayang. Titik pijaknya ada di tanah — itu yang menentukan urutan
 *    gambar terhadap pagar dan pohon — tapi badannya digambar beberapa piksel
 *    di atasnya, dan jaraknya naik-turun sendiri.
 * 2. Jalannya melengkung, bukan lurus dari titik ke titik. Kupu-kupu yang
 *    bergerak lurus terbaca seperti serangga mekanik.
 * 3. Ia kabur kalau didekati. Penghuni tidak peduli pada pemain sama sekali.
 */
export class Kupu extends Phaser.GameObjects.Sprite {
  /** Titik pijak di tanah: y gambar = dasar − tinggi melayang. */
  private dasar: number;
  private tujuan = new Phaser.Math.Vector2();
  private diamSampai = 0;
  private laju: number = KUPU.laju.santai;
  private tinggi: number;
  private tinggiTujuan: number;
  /** Fase goyang, diacak per ekor supaya tidak ada dua yang seirama. */
  private fase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    /** Baris warna di spritesheet, 0..KUPU.ragam-1. */
    private ragam: number,
    /** Batas jelajah, diukur pada titik pijak. */
    private area: Phaser.Geom.Rectangle
  ) {
    super(scene, x, y, 'kupu_kupu', ragam * 4);
    scene.add.existing(this);

    this.dasar = y;
    this.tinggi = Phaser.Math.Between(KUPU.terbang.min, KUPU.terbang.max);
    this.tinggiTujuan = this.tinggi;
    this.tujuan.set(x, y);

    // Skala dibulatkan ke kelipatan piksel kamera, sama seperti penghuni:
    // 2/3 pada zoom 3. Skala pecahan sembarang bikin garis tepinya putus.
    const zoom = scene.cameras.main.zoom;
    this.setOrigin(0.5, 0.5).setScale(Math.max(1, Math.round(zoom * KUPU.kecilkan)) / zoom);

    Kupu.daftarkanAnimasi(scene, ragam);
    this.hinggap(0);
  }

  /** Satu animasi per warna, dipakai bersama semua kupu-kupu warna itu. */
  static daftarkanAnimasi(scene: Phaser.Scene, ragam: number) {
    for (const [nama, rate] of [
      ['hinggap', KUPU.kepak.hinggap],
      ['terbang', KUPU.kepak.terbang],
    ] as const) {
      const key = `kupu_${ragam}_${nama}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers('kupu_kupu', { start: ragam * 4, end: ragam * 4 + 3 }),
        frameRate: rate,
        repeat: -1,
      });
    }
  }

  /**
   * Hinggap sebentar — sekaligus menentukan tujuan penerbangan berikutnya.
   *
   * Keduanya harus di satu tempat. Pernah dipisah, dan akibatnya kupu-kupu
   * tidak pernah pergi ke mana-mana seumur hidupnya: tujuannya masih titik
   * tempat ia dibuat, jaraknya nol, jadi ia dianggap sudah sampai dan
   * hinggap lagi — selamanya. Sayapnya tetap mengepak dan badannya tetap
   * naik-turun, sehingga dari luar ia terlihat hidup padahal mematung.
   */
  private hinggap(time: number) {
    this.diamSampai = time + Phaser.Math.Between(KUPU.jeda.min, KUPU.jeda.max);
    this.laju = KUPU.laju.santai;
    this.pilihTujuan();
    this.play(`kupu_${this.ragam}_hinggap`, true);
  }

  /**
   * Tujuan berikutnya: titik mana pun di dalam jatahnya, seperti ayam memilih
   * tujuannya.
   *
   * Dulu titiknya diambil dalam radius kecil di sekitar posisinya sendiri.
   * Hasilnya kupu-kupu yang tidak pernah ke mana-mana: ia mengambang di petak
   * yang sama sepanjang waktu, dan yang berubah cuma beberapa piksel. Jatah
   * jelajahnya sudah dibatasi kotak `area`; membatasinya sekali lagi lewat
   * radius cuma membuatnya mematung.
   */
  private pilihTujuan(dariX?: number, dariY?: number) {
    if (dariX === undefined || dariY === undefined) {
      this.tujuan.set(
        Phaser.Math.Between(this.area.left, this.area.right),
        Phaser.Math.Between(this.area.top, this.area.bottom)
      );
    } else {
      // Kalau ada yang bikin kaget, ia menghambur MENJAUHI dia — bukan ke
      // titik acak yang kebetulan malah mendekat.
      const sudut = Math.atan2(this.dasar - dariY, this.x - dariX) + Phaser.Math.FloatBetween(-0.6, 0.6);
      this.tujuan.set(
        Phaser.Math.Clamp(this.x + Math.cos(sudut) * KUPU.hambur, this.area.left, this.area.right),
        Phaser.Math.Clamp(this.dasar + Math.sin(sudut) * KUPU.hambur, this.area.top, this.area.bottom)
      );
    }
    this.tinggiTujuan = Phaser.Math.Between(KUPU.terbang.min, KUPU.terbang.max);
  }

  /** Dipanggil scene waktu pemain lewat dekat. */
  kaget(px: number, py: number, time: number) {
    if (Math.hypot(px - this.x, py - this.dasar) > KUPU.kaget) return;
    this.diamSampai = 0;
    this.laju = KUPU.laju.kabur;
    this.pilihTujuan(px, py);
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    const dt = delta / 1000;

    if (time >= this.diamSampai) {
      const dx = this.tujuan.x - this.x;
      const dy = this.tujuan.y - this.dasar;
      const jarak = Math.hypot(dx, dy);
      // Ambang datangnya longgar: arah terbangnya sengaja meliuk, jadi kalau
      // ambangnya seketat penghuni yang jalan lurus, ia akan berputar-putar
      // di sekitar tujuannya tanpa pernah dianggap sampai.
      if (jarak < 4) {
        this.hinggap(time);
      } else {
        // Meliuk: arahnya digoyang bolak-balik di sekitar garis ke tujuan.
        const arah = Math.atan2(dy, dx) + Math.sin(this.fase * 1.7) * KUPU.liuk;
        const langkah = Math.min(this.laju * dt, jarak);
        this.x += Math.cos(arah) * langkah;
        this.dasar += Math.sin(arah) * langkah;
        this.play(`kupu_${this.ragam}_terbang`, true);
        // Gambarnya simetris, jadi tidak ada arah hadap yang perlu diurus —
        // yang membedakan terbang dari hinggap cuma kecepatan kepakannya.
        this.laju = Math.max(KUPU.laju.santai, this.laju - 34 * dt); // ngebutnya mereda
      }
    }

    // Melayang: mendekati tinggi tujuan pelan-pelan, ditambah goyangan halus.
    // Goyangan inilah yang bikin lintasannya melengkung tanpa perlu kurva.
    this.tinggi += (this.tinggiTujuan - this.tinggi) * Math.min(1, dt * 2);
    this.fase += dt * 6;
    this.y = Math.round(this.dasar - this.tinggi + Math.sin(this.fase) * 1.5);

    // Urutan gambar mengikuti titik pijak, bukan titik gambarnya: kupu-kupu
    // yang melayang di depan pagar harus tetap tergambar di depan pagar.
    this.setDepth(kedalaman(this.dasar));
  }
}
