import Phaser from 'phaser';
import { kedalaman, skalaGambar, type ArahHadap, type AturanPenghuni } from '../config';
import { BAYANGAN_KAKI, bayanganKaki } from './piksel';

/**
 * Cara seekor penghuni tidur di malam hari — lihat `Penghuni.aturTidur()`.
 */
export interface AturanTidur {
  /** 0 siang .. 1 malam. */
  gelap: () => number;
  /** Tekstur pose tidurnya (dua frame: diam dan tarik napas) — lihat buatTidur(). */
  tekstur: string;
  /** Tempat tidurnya (titik kaki). Tanpa ini ia rebah di tempat ia berada. */
  tempat?: { x: number; y: number };
  /** Tinggi tenggeran: sesampainya di tempat, ia melompat naik setinggi ini. */
  naik?: number;
  /** Menghadap ke kanan saat tidur (gambar aslinya menghadap kiri). */
  kanan?: boolean;
  /** Huruf z yang melayang sesekali — untuk hewan besar yang dengkurnya kelihatan. */
  dengkur?: boolean;
  /** Dipanggil saat bangun di pagi hari: ayam jago berkokok. */
  bangun?: (p: Penghuni) => void;
}

/**
 * Penghuni dunia yang berkeliaran sendiri: sapi di kandang, ayam dan warga di
 * halaman depan rumah.
 *
 * Ketiganya berperilaku sama — jalan pelan ke satu titik acak di dalam
 * jatahnya, berhenti sebentar, lalu memilih titik berikutnya. Yang berbeda
 * cuma spritesheet dan angkanya, jadi semuanya satu kelas dengan satu berkas
 * aturan alih-alih tiga kelas yang isinya nyaris sama.
 *
 * Tambahannya bisa dipasang per ekor: menoleh ke pemain yang lewat
 * (aturToleh), kabur kalau dikejar (aturKabur — ayam), dan pulang ke rumah
 * menjelang magrib (aturPulang — warga).
 *
 * Sengaja tanpa badan fisika. Sapi terkurung pagar sehingga memang tidak ada
 * yang bisa menabraknya. Ayam dan warga bisa ditembus pemain — itu pertukaran
 * yang dipilih sadar: badan yang bergerak sendiri berpeluang menjepit pemain
 * ke dinding, dan pemain yang tersangkut jauh lebih buruk daripada penghuni
 * yang bisa dilewati.
 */
export class Penghuni extends Phaser.GameObjects.Sprite {
  private tujuan = new Phaser.Math.Vector2();
  private diamSampai = 0;
  private arah: ArahHadap = 'bawah';
  private bayangan?: Phaser.GameObjects.Sprite;
  /** Tekstur aslinya — `texture.key` berganti selama ia tidur. */
  private readonly kunci: string;
  private tidur?: AturanTidur;
  private malam: 'bebas' | 'pulang' | 'tidur' = 'bebas';
  /** Garis tanah saat bertengger: gambarnya naik, urutan gambar dan bayangannya tidak. */
  private tanah?: number;
  private suara?: { bunyi: (x: number, y: number) => void; min: number; max: number; berikut: number };
  /** Pemain yang ditatap selagi berhenti — lihat aturToleh(). */
  private ditatap?: () => Phaser.GameObjects.Sprite | undefined;
  /** Kabur dari pemain yang mendekat — lihat aturKabur(). */
  private kabur?: { pemain: () => Phaser.GameObjects.Sprite | undefined; bunyi?: (x: number, y: number) => void; sampai: number; bunyiLagi: number };
  /** Pulang ke rumah menjelang malam — lihat aturPulang(). */
  private pulang?: { gelap: () => number; pintu: { x: number; y: number }; keadaan: 'luar' | 'jalan' | 'dalam' };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: string,
    private aturan: AturanPenghuni,
    /** Batas jelajah, diukur pada titik kaki. */
    private area: Phaser.Geom.Rectangle
  ) {
    super(scene, x, y, key, aturan.arah.bawah.diam);
    scene.add.existing(this);
    this.kunci = key;

    /*
     * Titik acuan di kaki, bukan di tengah frame. Gambarnya menempel ke dasar
     * frame, jadi `y` menunjuk ke tempat ia berpijak — yang sekaligus jadi
     * kunci urutan gambar terhadap dunia.
     */
    this.setOrigin(0.5, 1);
    this.setScale(skalaGambar(aturan, scene.cameras.main.zoom));
    if (aturan.bayangan) this.bayangan = scene.add.sprite(x, y, bayanganKaki(scene)).setScale(this.scaleX);

    this.tujuan.set(x, y);
    this.istirahat(scene.time.now);
  }

  static registerAnimations(scene: Phaser.Scene, key: string, aturan: AturanPenghuni) {
    for (const [nama, a] of Object.entries(aturan.arah)) {
      for (const [gerak, awal] of [
        ['jalan', a.jalan],
        ['diam', a.diam],
      ] as const) {
        const k = `${key}_${gerak}_${nama}`;
        if (scene.anims.exists(k)) continue;
        scene.anims.create({
          key: k,
          frames: scene.anims.generateFrameNumbers(key, { start: awal, end: awal + 3 }),
          frameRate: aturan.rate[gerak],
          repeat: -1,
        });
      }
    }
  }

  /** Berhenti sejenak, lalu pilih tujuan berikutnya. */
  private istirahat(time: number) {
    this.diamSampai = time + Phaser.Math.Between(this.aturan.jeda.min, this.aturan.jeda.max);
    this.mainkan('diam');
    this.tujuan.set(
      Phaser.Math.Between(this.area.left, this.area.right),
      Phaser.Math.Between(this.area.top, this.area.bottom)
    );
  }

  private mainkan(gerak: 'jalan' | 'diam') {
    this.setFlipX(!!this.aturan.arah[this.arah].flip);
    this.play(`${this.kunci}_${gerak}_${this.arah}`, true);
  }

  /**
   * Malam hari berhenti berkeliaran: pulang ke tempat tidurnya (kalau ada),
   * naik ke tenggeran, lalu tidur sampai pagi.
   */
  aturTidur(t: AturanTidur) {
    this.tidur = t;
    const k = `${t.tekstur}_napas`;
    if (!this.scene.anims.exists(k)) {
      this.scene.anims.create({
        key: k,
        frames: this.scene.anims.generateFrameNumbers(t.tekstur, { start: 0, end: 1 }),
        frameRate: 1.1,
        repeat: -1,
      });
    }
  }

  /** Bunyi sesekali selagi bangun: kotek, ciap, lenguh. Terdengar hanya di dekatnya. */
  aturSuara(bunyi: (x: number, y: number) => void, min: number, max: number) {
    this.suara = { bunyi, min, max, berikut: this.scene.time.now + Phaser.Math.Between(min, max) };
  }

  /** Diklik: bersuara dan melonjak kecil — kecuali sedang tidur, yang cuma menggeliat. */
  bisaDiklik(bunyi: (x: number, y: number) => void) {
    this.setInteractive({ useHandCursor: true });
    this.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      if (this.malam === 'tidur') {
        this.scene.tweens.add({ targets: this, scaleX: this.scaleX * 1.08, duration: 120, yoyo: true });
        return;
      }
      bunyi(this.x, this.y);
      this.scene.tweens.add({ targets: this, y: this.y - 3, duration: 110, yoyo: true, ease: 'Sine.easeOut' });
    });
  }

  get sedangTidur() {
    return this.malam === 'tidur';
  }

  /** Selagi berhenti, menoleh ke pemain yang lewat dekat — warga yang memperhatikan tamunya. */
  aturToleh(pemain: () => Phaser.GameObjects.Sprite | undefined) {
    this.ditatap = pemain;
  }

  /**
   * Kabur dari pemain yang datang mendekat sambil berjalan: berlari tiga kali
   * lebih cepat ke arah menjauh, masih di dalam jatahnya, sambil berkotek.
   */
  aturKabur(pemain: () => Phaser.GameObjects.Sprite | undefined, bunyi?: (x: number, y: number) => void) {
    this.kabur = { pemain, bunyi, sampai: 0, bunyiLagi: 0 };
  }

  /**
   * Menjelang magrib berjalan ke pintu rumahnya dan masuk (memudar); saat
   * pagi keluar lagi dari pintu yang sama.
   */
  aturPulang(gelap: () => number, pintu: { x: number; y: number }) {
    this.pulang = { gelap, pintu, keadaan: 'luar' };
  }

  /** Berlari menjauhi pemain yang terlalu dekat. Mengembalikan true selama kabur. */
  private cekKabur(time: number) {
    const k = this.kabur;
    if (!k || this.malam !== 'bebas') return false;
    if (time < k.sampai) return true;
    const p = k.pemain();
    const body = p?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!p || !body) return false;
    const kx = p.x;
    const ky = p.y + 15;
    const dx = this.x - kx;
    const dy = this.y - ky;
    const jarak = Math.hypot(dx, dy);
    if (jarak > 22 || Math.hypot(body.velocity.x, body.velocity.y) < 20) return false;
    // lari ke arah berlawanan, sejauh 30 px, dijaga tetap di dalam jatahnya
    const a = jarak < 0.5 ? new Phaser.Math.Vector2(1, 0) : new Phaser.Math.Vector2(dx / jarak, dy / jarak);
    this.tujuan.set(
      Phaser.Math.Clamp(this.x + a.x * 30 + Phaser.Math.Between(-6, 6), this.area.left, this.area.right),
      Phaser.Math.Clamp(this.y + a.y * 30 + Phaser.Math.Between(-6, 6), this.area.top, this.area.bottom)
    );
    k.sampai = time + 900;
    this.diamSampai = 0;
    if (k.bunyi && time > k.bunyiLagi) {
      k.bunyiLagi = time + 1500;
      k.bunyi(this.x, this.y);
    }
    return true;
  }

  /** Menatap pemain yang berdiri dekat selagi berhenti. */
  private toleh() {
    const p = this.ditatap?.();
    if (!p) return;
    const dx = p.x - this.x;
    const dy = p.y + 15 - this.y;
    if (Math.abs(dx) > 44 || Math.abs(dy) > 34) return;
    const arah: ArahHadap = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'kiri' : 'kanan') : dy < 0 ? 'atas' : 'bawah';
    if (arah === this.arah) return;
    this.arah = arah;
    this.mainkan('diam');
  }

  /** Pulang dan keluar rumah mengikuti gelap. Mengembalikan true selama tidak berkeliaran. */
  private cekPulang(time: number) {
    const u = this.pulang;
    if (!u) return false;
    const g = u.gelap();
    if (u.keadaan === 'luar') {
      if (g < 0.4) return false;
      u.keadaan = 'jalan';
      this.tujuan.set(u.pintu.x, u.pintu.y);
      this.diamSampai = time + Phaser.Math.Between(0, 1500);
      return false;
    }
    if (u.keadaan === 'dalam') {
      if (g > 0.3) return true;
      // pagi: keluar dari pintu, lalu kembali berkeliaran
      u.keadaan = 'luar';
      this.scene.tweens.killTweensOf(this);
      this.setPosition(u.pintu.x, u.pintu.y).setVisible(true).setAlpha(0);
      this.bayangan?.setVisible(true);
      this.scene.tweens.add({ targets: this, alpha: 1, duration: 600 });
      this.istirahat(time);
      this.diamSampai = time + 600;
      return true;
    }
    // sedang berjalan pulang: sampai di pintu, masuk (memudar)
    if (Math.hypot(this.tujuan.x - this.x, this.tujuan.y - this.y) < 1.5 && time >= this.diamSampai) {
      u.keadaan = 'dalam';
      this.arah = 'atas';
      this.mainkan('diam');
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.setVisible(false);
          this.bayangan?.setVisible(false);
        },
      });
      return true;
    }
    return false;
  }

  private rebah() {
    const t = this.tidur!;
    this.malam = 'tidur';
    this.tanah = this.y;
    this.anims.stop();
    this.setTexture(t.tekstur, 0).setFlipX(!!t.kanan);
    this.play(`${t.tekstur}_napas`);
    if (t.naik) {
      // lompat ke palang: naik melengkung, sayap tidak perlu digambar
      const dari = this.y;
      this.scene.tweens.add({
        targets: this,
        y: dari - t.naik,
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
  }

  private bangunkan(time: number) {
    const t = this.tidur!;
    const turun = this.malam === 'tidur' && t.naik ? t.naik : 0;
    this.malam = 'bebas';
    this.anims.stop();
    this.setTexture(this.kunci, this.aturan.arah.bawah.diam);
    if (turun) this.scene.tweens.add({ targets: this, y: this.tanah ?? this.y + turun, duration: 220, ease: 'Quad.easeIn' });
    this.tanah = undefined;
    this.istirahat(time + 400);
    t.bangun?.(this);
  }

  private dengkurPada = 0;

  private zz(time: number) {
    if (time < this.dengkurPada || !this.scene.textures.exists('zz')) return;
    this.dengkurPada = time + Phaser.Math.Between(2400, 3400);
    const kanan = !!this.tidur?.kanan;
    const z = this.scene.add
      .image(this.x + (kanan ? 6 : -6), this.y - this.displayHeight * 0.55, 'zz')
      .setScale(0.5)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: z,
      y: z.y - 10,
      x: z.x + (kanan ? 3 : -3),
      alpha: 0,
      scale: 0.8,
      duration: 1800,
      onComplete: () => z.destroy(),
    });
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    const pijak = this.tanah ?? this.y;
    // yang bertengger di atas palang digambar di depan palangnya
    this.setDepth(kedalaman(pijak) + (this.tanah !== undefined ? 0.3 : 0));
    if (this.bayangan) {
      this.bayangan
        .setPosition(this.x, pijak - this.scaleY)
        .setDepth(kedalaman(pijak) - 0.5)
        .setAlpha(BAYANGAN_KAKI);
    }

    if (this.tidur) {
      const g = this.tidur.gelap();
      if (this.malam === 'bebas' && g > 0.62) {
        this.malam = 'pulang';
        // yang tidak punya tempat tidur rebah di tempatnya berdiri
        if (!this.tidur.tempat) this.rebah();
        else {
          this.tujuan.set(this.tidur.tempat.x, this.tidur.tempat.y);
          // berangkat bergiliran, tidak serentak seperti barisan
          this.diamSampai = time + Phaser.Math.Between(0, 1800);
        }
      } else if (this.malam !== 'bebas' && g < 0.4) {
        this.bangunkan(time);
      }
      if (this.malam === 'tidur') {
        if (this.tidur.dengkur) this.zz(time);
        return;
      }
    }

    if (this.cekPulang(time)) return;

    if (this.suara && this.malam === 'bebas' && time > this.suara.berikut) {
      this.suara.berikut = time + Phaser.Math.Between(this.suara.min, this.suara.max);
      this.suara.bunyi(this.x, this.y);
    }

    const lari = this.cekKabur(time);
    if (time < this.diamSampai) {
      this.toleh();
      return;
    }

    const dx = this.tujuan.x - this.x;
    const dy = this.tujuan.y - this.y;
    const jarak = Math.hypot(dx, dy);
    if (jarak < 1.5) {
      if (this.malam === 'pulang' || this.pulang?.keadaan === 'jalan') {
        // sampai di tenggeran (rebah) atau di pintu rumah (cekPulang yang memasukkannya)
        this.setPosition(this.tujuan.x, this.tujuan.y);
        if (this.malam === 'pulang') this.rebah();
        return;
      }
      this.istirahat(time);
      return;
    }

    const langkah = Math.min((this.aturan.speed * (lari ? 3 : 1) * delta) / 1000, jarak);
    this.x += (dx / jarak) * langkah;
    this.y += (dy / jarak) * langkah;

    // sumbu dominan yang menentukan arah hadap, sama seperti pemain
    this.arah = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'kiri' : 'kanan') : dy < 0 ? 'atas' : 'bawah';
    this.mainkan('jalan');
  }
}
