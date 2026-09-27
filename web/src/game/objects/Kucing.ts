import Phaser from 'phaser';
import { DEPTH, UTARA, kedalaman } from '../config';
import type { Kupu } from './Kupu';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';

/** Frame lembar `kucing` (hadap kanan; hadap kiri = dicerminkan). */
const F = { tidurA: 0, tidurB: 1, duduk: 2, jalanA: 3, jalanB: 4, mendekam: 5, lompat: 6 } as const;

/** Kucing sedikit lebih kecil dari orang: 2/3 di zoom 3, 1/2 di zoom 2. */
const KECIL = 0.75;

const LAJU = { jalan: 30, kejar: 46 };

const EONG = ['Meow.', 'Mrrp?', 'Purrr...', 'Meow!', '...'];

type Keadaan = 'tidur' | 'duduk' | 'kejar' | 'pulang';

/**
 * Kucing oren yang tidur melingkar di rumput strip utara.
 *
 * Tidurnya bernapas (punggungnya naik-turun satu piksel) dan sesekali "z"
 * kecil melayang dari kepalanya. Setelah beberapa lama ia bangun, duduk,
 * lalu kalau ada kupu-kupu di dekatnya ia mengendap mengejarnya — mendekam,
 * menerkam — kupu-kupunya kabur, dan kucingnya pulang ke tempat tidurnya
 * lagi. Pemain yang lewat terlalu dekat membangunkannya; diklik, ia mengeong.
 */
export class Kucing {
  private s: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Sprite;
  private keadaan: Keadaan = 'tidur';
  private sampai = 0;
  /** 0 = boleh mengejar kupu-kupu; 1 = sudah menerkam atau menyerah, pulang lalu tidur. */
  private langkah = 0;
  private eong = 0;
  private readonly rumah: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    private kupu: () => Kupu | undefined,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    this.buatTekstur();
    const { x, kaki } = UTARA.kucing;
    this.rumah = { x, y: kaki };
    const z = scene.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    this.s = scene.add.sprite(x, kaki, 'kucing', F.tidurA).setOrigin(0.5, 1).setScale(sk).setDepth(kedalaman(kaki));
    this.bayang = scene.add
      .sprite(x, kaki - sk, bayanganKaki(scene))
      .setScale(sk * 1.2, sk)
      .setAlpha(BAYANGAN_KAKI)
      .setDepth(this.s.depth - 0.5);
    this.s.play('kucing_tidur');
    this.s.setInteractive({ useHandCursor: true });
    this.s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', { msg: EONG[this.eong++ % EONG.length], siapa: this.s, nama: 'Cat' });
      if (this.keadaan === 'tidur') this.bangun(scene.time.now);
    });
    this.sampai = scene.time.now + Phaser.Math.Between(15000, 26000);
    scene.events.on('update', this.detak, this);
    scene.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        if (this.keadaan === 'tidur') this.dengkur();
      },
    });
  }

  private buatTekstur() {
    const s = this.scene;
    spritesheetTeks(
      s,
      'kucing',
      [
      [
        '....................',
        '....................',
        '....................',
        '....................',
        '......kkkkkk........',
        '....kkooOooOkk......',
        '...kooOooOoookk.k...',
        '..koooooooOokokkok..',
        '..kOooooooookooook..',
        '..kkoooooookoeooek..',
        '.kwwkkoooookkwwpkk..',
        '..kkkkkkkkkkkkkk....',
      ],
      [
        '....................',
        '....................',
        '....................',
        '......kkkkkk........',
        '....kkooOooOkk......',
        '...kooOooOooookk.k..',
        '..koooooooOoookkok..',
        '..kOooooooooookook..',
        '..koooooooooookook..',
        '..kkoooooookoeooek..',
        '.kwwkkoooookkwwpkk..',
        '..kkkkkkkkkkkkkk....',
      ],
      [
        '............k...k...',
        '...........kok.kok..',
        '...........kooooook.',
        '...........koOoeok..',
        '...........koowwpk..',
        '......kkkkkkowwwk...',
        '.....kooOooOoowwk...',
        '....kooOooOoooowk...',
        'kk..koooooooooowk...',
        'kok.koOoooooOowwk...',
        '.kokkooooooowkwwk...',
        '..kkkkkkkkkkkkkkk...',
      ],
      [
        '....................',
        '..............k..k..',
        '.............kokkok.',
        'kk...........koooook',
        'kok..........koOoek.',
        '.kokkkkkkkkkkkoowpk.',
        '..koooOooOooooowwk..',
        '..kooOooOoooooowk...',
        '..kooooooooooowk....',
        '..kokkoookkkokkok...',
        '..kwk.kwk..kwk.kwk..',
        '..kk..kk....kk..kk..',
      ],
      [
        '....................',
        '..............k..k..',
        '.............kokkok.',
        '.kk..........koooook',
        '.kok.........koOoek.',
        '..kokkkkkkkkkkoowpk.',
        '..koooOooOooooowwk..',
        '..kooOooOoooooowk...',
        '..kooooooooooowk....',
        '...kokkoookokkok....',
        '...kwkkwk..kwkwk....',
        '...kk.kk....kkkk....',
      ],
      [
        '....................',
        '....................',
        '....................',
        '....................',
        '..............k..k..',
        'kkk..........kokkok.',
        '..kkkkkkkkkkkkoooook',
        '..koooOooOoooooOoek.',
        '..kooOooOoooooooowpk',
        '..koooooooooooooowk.',
        '..kwkkkkkkkkkkkkwwk.',
        '..kk............kk..',
      ],
      [
        '..............k..k..',
        '.............kokkok.',
        'kk...........koooook',
        '.kkk.........koOoek.',
        '...kkkkkkkkkkkoowpk.',
        '...koooOooOoooowwk..',
        '..kooOooOoooooowk...',
        '.kwkkkooooooookkwk..',
        'kwk...kkkkkkkk..kwk.',
        'kk...............kk.',
        '....................',
        '....................',
      ],
      ],
      { k: '#3a2418', o: '#f0973a', O: '#c8661f', w: '#fbf3e2', p: '#f29ba0', e: '#2a2a2a' }
    );
    if (!s.anims.exists('kucing_tidur')) {
      s.anims.create({ key: 'kucing_tidur', frames: s.anims.generateFrameNumbers('kucing', { frames: [F.tidurA, F.tidurA, F.tidurB] }), frameRate: 1.4, repeat: -1 });
      s.anims.create({ key: 'kucing_jalan', frames: s.anims.generateFrameNumbers('kucing', { frames: [F.jalanA, F.jalanB] }), frameRate: 7, repeat: -1 });
    }
  }

  /** "z" kecil yang melayang dari kepalanya. */
  private dengkur() {
    if (!this.scene.textures.exists('zz')) return;
    const kanan = !this.s.flipX;
    const z = this.scene.add
      .image(this.s.x + (kanan ? 5 : -5), this.s.y - 7, 'zz')
      .setScale(0.5)
      .setDepth(DEPTH.above + 20);
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

  private bangun(t: number) {
    this.keadaan = 'duduk';
    this.s.anims.stop();
    this.s.setFrame(F.duduk);
    this.sampai = t + Phaser.Math.Between(1400, 2200);
  }

  private tidur(t: number) {
    this.keadaan = 'tidur';
    this.s.play('kucing_tidur');
    this.sampai = t + Phaser.Math.Between(18000, 34000);
  }

  private detak(t: number, delta: number) {
    const s = this.s;
    const p = this.pemain();
    const dekat = p && Phaser.Math.Distance.Between(p.x, p.y + 15, s.x, s.y) < 26;

    if (this.keadaan === 'tidur') {
      if (dekat || t > this.sampai) this.bangun(t);
      return;
    }

    if (this.keadaan === 'duduk') {
      // menatap pemain yang berdiri di dekatnya
      if (dekat && p) s.setFlipX(p.x < s.x);
      if (t < this.sampai || dekat) return;
      const k = this.kupu();
      if (k && Phaser.Math.Distance.Between(k.x, k.y, this.rumah.x, this.rumah.y) < 120 && this.langkah === 0) {
        this.keadaan = 'kejar';
        this.sampai = t + 7000;
        s.play('kucing_jalan');
      } else if (Math.abs(s.x - this.rumah.x) > 2 || Math.abs(s.y - this.rumah.y) > 2) {
        this.keadaan = 'pulang';
        s.play('kucing_jalan');
      } else {
        this.langkah = 0;
        this.tidur(t);
      }
      return;
    }

    const k = this.kupu();
    const tuju = this.keadaan === 'kejar' && k ? { x: k.x, y: k.y + 8 } : this.rumah;
    const dx = tuju.x - s.x;
    const dy = tuju.y - s.y;
    const jarak = Math.hypot(dx, dy);

    if (this.keadaan === 'kejar') {
      if (!k || t > this.sampai) {
        this.langkah = 1;
        this.keadaan = 'pulang';
        return;
      }
      if (jarak < 16) {
        this.terkam(k, t);
        return;
      }
    } else if (jarak < 1.5) {
      // sampai di rumah: duduk sebentar lalu tidur, tidak mengejar lagi
      s.setPosition(this.rumah.x, this.rumah.y);
      this.bangun(t);
      this.sampai = t + 900;
      this.langkah = 1;
      return;
    }

    const laju = (this.keadaan === 'kejar' ? LAJU.kejar : LAJU.jalan) * (delta / 1000);
    s.x += (dx / jarak) * Math.min(laju, jarak);
    s.y += (dy / jarak) * Math.min(laju, jarak);
    if (Math.abs(dx) > 0.5) s.setFlipX(dx < 0);
    this.ikut();
  }

  /** Mendekam sebentar, lalu melompat ke arah kupu-kupu — yang kabur duluan. */
  private terkam(k: Kupu, t: number) {
    const s = this.s;
    this.keadaan = 'duduk';
    this.sampai = t + 99999;
    s.anims.stop();
    s.setFrame(F.mendekam);
    this.scene.time.delayedCall(450, () => {
      k.kaget(s.x, s.y);
      s.setFrame(F.lompat);
      const tx = s.x + (s.flipX ? -14 : 14);
      const ty = s.y;
      this.scene.tweens.add({
        targets: s,
        x: tx,
        duration: 360,
        onUpdate: (tw) => {
          s.y = ty - Math.sin(tw.progress * Math.PI) * 7;
          this.ikut(ty);
        },
        onComplete: () => {
          s.y = ty;
          s.setFrame(F.duduk);
          this.ikut();
          this.langkah = 1; // sekali terkam cukup; berikutnya pulang
          this.sampai = this.scene.time.now + 1500;
        },
      });
    });
  }

  /** Bayangan dan urutan gambar mengikuti kucingnya; `tanah` = pijakan saat melompat. */
  private ikut(tanah = this.s.y) {
    this.s.setDepth(kedalaman(tanah));
    this.bayang.setPosition(this.s.x, tanah - this.s.scaleY).setDepth(this.s.depth - 0.5);
  }
}
