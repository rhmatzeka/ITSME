import Phaser from 'phaser';
import { COW, kedalaman } from '../config';

type Arah = keyof typeof COW.baris;

/**
 * Sapi yang merumput di kandang: jalan pelan ke satu titik acak di dalam
 * jatahnya, berhenti sebentar, lalu memilih titik berikutnya.
 *
 * Sengaja bukan sprite fisika. Kandangnya tertutup rapat, jadi tidak ada yang
 * perlu ditabrak — dan satu badan statis lagi cuma menambah kerja tiap frame
 * tanpa mengubah apa pun yang kelihatan.
 */
export class Cow extends Phaser.GameObjects.Sprite {
  private tujuan = new Phaser.Math.Vector2();
  private diamSampai = 0;
  private arah: Arah = 'bawah';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: string,
    /** Batas jelajah, diukur pada titik kaki. */
    private area: Phaser.Geom.Rectangle
  ) {
    super(scene, x, y, key, COW.baris.bawah);
    scene.add.existing(this);

    /*
     * Titik acuan di kaki, bukan di tengah frame.
     *
     * Gambar sapinya menempel ke dasar frame 32px (badannya cuma mengisi 21px
     * paling bawah). Dengan origin tengah, `y` menunjuk ke udara di atas
     * punggungnya — dan pembatasan area kandang jadi meleset sejauh 16px.
     */
    this.setOrigin(0.5, 1);

    this.tujuan.set(x, y);
    this.merumput(scene.time.now);
  }

  static registerAnimations(scene: Phaser.Scene, key: string) {
    const buat = (nama: string, baris: number, rate: number) => {
      const k = `${key}_${nama}`;
      if (scene.anims.exists(k)) return;
      scene.anims.create({
        key: k,
        frames: scene.anims.generateFrameNumbers(key, { start: baris, end: baris + 3 }),
        frameRate: rate,
        repeat: -1,
      });
    };
    for (const [nama, baris] of Object.entries(COW.baris)) {
      buat(`jalan_${nama}`, baris, 7);
      // siklus yang sama, jauh lebih lambat: sapi diam masih bergoyang, tidak membeku
      buat(`diam_${nama}`, baris, 2);
    }
  }

  /** Berhenti sejenak, lalu pilih tujuan berikutnya. */
  private merumput(time: number) {
    this.diamSampai = time + Phaser.Math.Between(COW.jeda.min, COW.jeda.max);
    this.play(`${this.texture.key}_diam_${this.arah}`, true);
    this.tujuan.set(
      Phaser.Math.Between(this.area.left, this.area.right),
      Phaser.Math.Between(this.area.top, this.area.bottom)
    );
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    // origin sudah di kaki, jadi y-nya sendiri sudah garis pijaknya
    this.setDepth(kedalaman(this.y));
    if (time < this.diamSampai) return;

    const dx = this.tujuan.x - this.x;
    const dy = this.tujuan.y - this.y;
    const jarak = Math.hypot(dx, dy);
    if (jarak < 1.5) {
      this.merumput(time);
      return;
    }

    const langkah = Math.min((COW.speed * delta) / 1000, jarak);
    this.x += (dx / jarak) * langkah;
    this.y += (dy / jarak) * langkah;

    // sumbu dominan yang menentukan arah hadap, sama seperti pemain
    this.arah = Math.abs(dx) > Math.abs(dy) ? 'samping' : dy < 0 ? 'atas' : 'bawah';
    this.setFlipX(this.arah === 'samping' && dx > 0);
    this.play(`${this.texture.key}_jalan_${this.arah}`, true);
  }
}
