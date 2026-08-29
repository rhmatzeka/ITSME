import Phaser from 'phaser';
import { kedalaman, skalaGambar, type ArahHadap, type AturanPenghuni } from '../config';

/**
 * Penghuni dunia yang berkeliaran sendiri: sapi di kandang, ayam dan warga di
 * halaman depan rumah.
 *
 * Ketiganya berperilaku sama — jalan pelan ke satu titik acak di dalam
 * jatahnya, berhenti sebentar, lalu memilih titik berikutnya. Yang berbeda
 * cuma spritesheet dan angkanya, jadi semuanya satu kelas dengan satu berkas
 * aturan alih-alih tiga kelas yang isinya nyaris sama.
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

    /*
     * Titik acuan di kaki, bukan di tengah frame. Gambarnya menempel ke dasar
     * frame, jadi `y` menunjuk ke tempat ia berpijak — yang sekaligus jadi
     * kunci urutan gambar terhadap dunia.
     */
    this.setOrigin(0.5, 1);
    this.setScale(skalaGambar(aturan, scene.cameras.main.zoom));
    if (aturan.bayangan && scene.textures.exists(aturan.bayangan)) {
      this.bayangan = scene.add.sprite(x, y, aturan.bayangan, 0).setOrigin(0.5, 1);
    }

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
    this.play(`${this.texture.key}_${gerak}_${this.arah}`, true);
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.setDepth(kedalaman(this.y));
    if (this.bayangan) {
      this.bayangan
        .setPosition(this.x, this.y)
        .setFrame(this.frame.name)
        .setFlipX(this.flipX)
        .setDepth(this.depth - 0.5)
        .setAlpha(0.55);
    }

    if (time < this.diamSampai) return;

    const dx = this.tujuan.x - this.x;
    const dy = this.tujuan.y - this.y;
    const jarak = Math.hypot(dx, dy);
    if (jarak < 1.5) {
      this.istirahat(time);
      return;
    }

    const langkah = Math.min((this.aturan.speed * delta) / 1000, jarak);
    this.x += (dx / jarak) * langkah;
    this.y += (dy / jarak) * langkah;

    // sumbu dominan yang menentukan arah hadap, sama seperti pemain
    this.arah = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'kiri' : 'kanan') : dy < 0 ? 'atas' : 'bawah';
    this.mainkan('jalan');
  }
}
