import Phaser from 'phaser';
import { KUPU, kedalaman } from '../config';

/**
 * Kupu-kupu yang beterbangan di taman.
 *
 * Tiga hal yang membedakannya dari Penghuni, dan itulah alasan ia jadi kelas
 * sendiri alih-alih satu entri lagi di tabel PENGHUNI:
 *
 * 1. Ia melayang. Titik pijaknya ada di tanah — itu yang menentukan urutan
 *    gambar terhadap pagar dan tanggul — tapi badannya digambar beberapa
 *    piksel di atasnya, dan jaraknya naik-turun sendiri.
 * 2. Jalannya meliuk, bukan lurus dari titik ke titik. Kupu-kupu yang
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
  /** Sedang menempuh perjalanan, bukan sedang hinggap. */
  private melaju = false;
  /** Fase goyang, diacak per ekor supaya tidak ada dua yang seirama. */
  private fase = Math.random() * Math.PI * 2;
  private bayangan: Phaser.GameObjects.Sprite;

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
    const skala = Math.max(1, Math.round(zoom * KUPU.kecilkan)) / zoom;
    this.setOrigin(0.5, 0.5).setScale(skala);

    /*
     * Bayangan kecil di tanah, tepat di titik pijaknya.
     *
     * Tanpa ini tidak ada yang memberi tahu mata seberapa tinggi ia melayang:
     * pada kamera tampak-atas, kupu-kupu yang naik 10 px terlihat persis sama
     * dengan kupu-kupu yang bergeser 10 px ke utara. Bayangannya tinggal di
     * tanah sementara badannya naik, dan jarak antar keduanya itulah yang
     * terbaca sebagai ketinggian.
     */
    this.bayangan = scene.add.sprite(x, y, 'kupu_kupu', KUPU.barisBayangan * 4).setOrigin(0.5, 0.5).setScale(skala);

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
    this.melaju = false;
    this.pilihTujuan();
    // Sebagian jedanya dipakai turun sampai menyentuh tanah, bukan
    // menggantung di udara. Kupu-kupu yang tidak pernah benar-benar hinggap
    // terbaca seperti benda yang terapung, bukan hewan yang sedang istirahat.
    this.tinggiTujuan =
      Math.random() < KUPU.peluangHinggap
        ? KUPU.hinggapTinggi
        : Phaser.Math.Between(KUPU.terbang.min, KUPU.terbang.max);
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
      return;
    }
    // Kalau ada yang bikin kaget, ia menghambur MENJAUHI dia — bukan ke titik
    // acak yang kebetulan malah mendekat.
    const sudut = Math.atan2(this.dasar - dariY, this.x - dariX) + Phaser.Math.FloatBetween(-0.6, 0.6);
    this.tujuan.set(
      Phaser.Math.Clamp(this.x + Math.cos(sudut) * KUPU.hambur, this.area.left, this.area.right),
      Phaser.Math.Clamp(this.dasar + Math.sin(sudut) * KUPU.hambur, this.area.top, this.area.bottom)
    );
  }

  /** Dipanggil scene waktu pemain lewat dekat. */
  kaget(px: number, py: number) {
    if (Math.hypot(px - this.x, py - this.dasar) > KUPU.kaget) return;
    this.diamSampai = 0;
    this.melaju = false; // supaya tingginya dipilih ulang: yang kaget naik dulu
    this.laju = KUPU.laju.kabur;
    this.pilihTujuan(px, py);
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    const dt = delta / 1000;

    if (time >= this.diamSampai) {
      if (!this.melaju) {
        this.melaju = true;
        this.tinggiTujuan = Phaser.Math.Between(KUPU.terbang.min, KUPU.terbang.max);
      }
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
        /*
         * Langkahnya dipatok ulang ke jatahnya.
         *
         * Panjang langkah memang tidak pernah melebihi jarak ke tujuan, tapi
         * ARAHNYA meleset sampai 0,55 radian karena meliuk — jadi langkah
         * terakhir bisa mendarat di samping tujuan, beberapa piksel di luar
         * kotaknya. Kecil, tapi jatah inilah satu-satunya yang menjamin titik
         * pijaknya tidak pernah masuk ke baris tanggul.
         */
        this.x = Phaser.Math.Clamp(this.x, this.area.left, this.area.right);
        this.dasar = Phaser.Math.Clamp(this.dasar, this.area.top, this.area.bottom);
        // Gambarnya simetris, jadi tidak ada arah hadap yang perlu diurus —
        // yang membedakan terbang dari hinggap cuma kecepatan kepakannya.
        this.play(`kupu_${this.ragam}_terbang`, true);
        this.laju = Math.max(KUPU.laju.santai, this.laju - 34 * dt); // ngebutnya mereda
      }
    }

    // Melayang: mendekati tinggi tujuan pelan-pelan, ditambah goyangan halus.
    // Waktu benar-benar hinggap goyangannya dimatikan — yang sudah menempel
    // di tanah tidak boleh terlihat naik-turun.
    this.tinggi += (this.tinggiTujuan - this.tinggi) * Math.min(1, dt * 2);
    this.fase += dt * 6;
    const goyang = this.tinggi > KUPU.hinggapTinggi + 0.6 ? Math.sin(this.fase) * 1.5 : 0;
    this.y = Math.round(this.dasar - this.tinggi + goyang);

    /*
     * Urutan gambar mengikuti titik pijak — ditambah ketinggiannya.
     *
     * Tile padat memakai patokan yang sama: kedalamannya tepi BAWAH tile.
     * Titik pijak saja sudah cukup untuk yang berjalan, dan itu yang dipakai
     * ayam dan sapi. Untuk yang terbang tidak cukup: kupu-kupu yang melintas
     * di atas tugu setinggi kepala akan tergambar di belakang tugu itu hanya
     * karena kakinya "berdiri" beberapa piksel di utaranya — padahal jelas
     * terlihat melayang di atasnya.
     *
     * Menambahkan ketinggiannya menyelesaikan keduanya sekaligus: yang
     * terbang tinggi melewati benda pendek di sekitarnya (selisihnya paling
     * banyak 11 px, kurang dari satu tile, jadi ia tidak akan pernah
     * mendahului benda yang benar-benar ada di depannya), sementara yang
     * sedang hinggap tetap masuk ke belakang benda yang menaunginya.
     */
    this.setDepth(kedalaman(this.dasar + this.tinggi));

    // Bayangan mengecil dan memudar seiring naiknya.
    const jauh = Phaser.Math.Clamp((this.tinggi - KUPU.hinggapTinggi) / KUPU.terbang.max, 0, 1);
    this.bayangan
      .setPosition(Math.round(this.x), Math.round(this.dasar))
      .setFrame(KUPU.barisBayangan * 4 + (Number(this.frame.name) - this.ragam * 4))
      .setAlpha(KUPU.bayangan * (1 - jauh * 0.55))
      .setScale(this.scale * (1 - jauh * 0.25))
      .setDepth(this.depth - 0.5);
  }

  override destroy(fromScene?: boolean) {
    this.bayangan?.destroy(fromScene);
    super.destroy(fromScene);
  }
}
