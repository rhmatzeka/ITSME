import Phaser from 'phaser';
import { ABOUT, DEPTH, kedalaman } from '../config';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';

/** Frame lembar `anjing` 22×14, hadap kanan (hadap kiri = dicerminkan). */
const F = { ekorA: 0, ekorB: 1, gonggong: 2, duduk: 3, tidurA: 4, tidurB: 5 } as const;

/** Jarak kaki pemain ke anjing yang membangunkannya, dan yang membuatnya tidur lagi, px. */
const DEKAT = 34;
const JAUH = 52;

const GUK = ['Woof!', 'Arf arf!', '*wags tail happily*', 'Woof woof!'];

type Keadaan = 'tidur' | 'bangun' | 'duduk';

/**
 * Anjing kampung penjaga rumah About, tidur di keset di sebelah kanan pintu.
 *
 * Tidurnya bernapas (punggung naik-turun satu piksel) dengan "z" kecil yang
 * melayang. Pemain yang mendekat membangunkannya: ia berdiri, menggonggong
 * sekali, lalu menggoyang ekornya sambil menatap pemain selama masih di
 * dekatnya. Ditinggal pergi, ia duduk sebentar lalu tidur lagi. Kurir yang
 * datang mengantar surat juga disambut dengan cara yang sama.
 *
 * Beda dengan kucing oren di utara yang berkeliaran sendiri: anjing ini
 * tidak pernah meninggalkan kesetnya — ia penjaga rumahnya.
 */
export class Anjing {
  private s: Phaser.GameObjects.Sprite;
  private keadaan: Keadaan = 'tidur';
  /** Batas waktu keadaan sekarang: kapan duduk, kapan tidur lagi. */
  private sampai = 0;
  private guk = 0;

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    this.buatTekstur();
    const { x, kaki } = ABOUT.anjing;
    scene.add
      .image(x, kaki + 1, 'keset')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.below + 1);
    scene.add
      .sprite(x, kaki - 1, bayanganKaki(scene))
      .setScale(1.4, 1)
      .setAlpha(BAYANGAN_KAKI)
      .setDepth(kedalaman(kaki) - 0.5);
    // menghadap pintu
    this.s = scene.add.sprite(x, kaki, 'anjing', F.tidurA).setOrigin(0.5, 1).setFlipX(true).setDepth(kedalaman(kaki));
    this.s.play('anjing_tidur');
    this.s.setInteractive({ useHandCursor: true });
    this.s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.bangun(scene.time.now, 3000);
      this.gonggong();
      scene.game.events.emit('mapporto:ucap', { msg: GUK[this.guk++ % GUK.length], siapa: this.s, nama: 'Dog' });
    });
    scene.events.on('update', this.detak, this);
    scene.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => this.keadaan === 'tidur' && this.dengkur(),
    });
  }

  private buatTekstur() {
    const s = this.scene;
    // digambar di scratchpad anjing.py: anjing kampung cokelat muda, dada dan moncong krem
    spritesheetTeks(
      s,
      'anjing',
      [
        // ekor naik
        [
          '...............kk.....',
          '.kk...........kDDk....',
          'kOok..........kDoDk...',
          'kook.........koooook..',
          '.kok.........kooeooOkk',
          '.kOk.........kooooowwn',
          '..kOkkkkkkkkkoooowwwwk',
          '..kooOooOoooooowwkkkk.',
          '..koooooooooooowwk....',
          '..kooooooooooowwwk....',
          '..kOowkkkkkkkOowwk....',
          '..kOowk.....kOowk.....',
          '..kOwwk.....kOwwk.....',
          '...kkk.......kkk......',
        ],
        // ekor turun (kibasan)
        [
          '...............kk.....',
          '..............kDDk....',
          '..............kDoDk...',
          '.............koooook..',
          'kk...........kooeooOkk',
          'kOkk.........kooooowwn',
          '.kOOkkkkkkkkkoooowwwwk',
          '..kooOooOoooooowwkkkk.',
          '..koooooooooooowwk....',
          '..kooooooooooowwwk....',
          '..kOowkkkkkkkOowwk....',
          '..kOowk.....kOowk.....',
          '..kOwwk.....kOwwk.....',
          '...kkk.......kkk......',
        ],
        // menggonggong
        [
          '...............kk.....',
          '.kk...........kDDk....',
          'kOok..........kDoDk...',
          'kook.........koooook..',
          '.kok.........kooeooOkk',
          '.kOk.........kooooowwn',
          '..kOkkkkkkkkkoooowkkkk',
          '..kooOooOoooooowwkmmk.',
          '..koooooooooooowwkkkk.',
          '..kooooooooooowwwk....',
          '..kOowkkkkkkkOowwk....',
          '..kOowk.....kOowk.....',
          '..kOwwk.....kOwwk.....',
          '...kkk.......kkk......',
        ],
        // duduk
        [
          '......................',
          '...............kk.....',
          '..............kDDk....',
          '..............kDoDk...',
          '.............koooook..',
          '.............kooeooOkk',
          '.............kooooowwn',
          '........kkkkkoooowwwwk',
          '......kkoOooooowwkkkk.',
          '.....kOoooooooowwk....',
          '.kk.kOoooooooowwwk....',
          'kOOkkOooooookOowwk....',
          '.kOOOOOoooowkOwwk.....',
          '..kkkkkkkkkk.kkk......',
        ],
        // tidur, dua tarikan napas
        [
          '......................',
          '......................',
          '......................',
          '......................',
          '......................',
          '...............kk.....',
          '..............kDDk....',
          '....kkkkkkkkkkoDoDk...',
          '...kooOooOoookooooOk..',
          '..kooooooooookokkooOkk',
          '.kOoooooooooookooowwwn',
          'kOkoooooooookwwwwkkkk.',
          '.kOkkkkkkkkkwwwwwk....',
          '..k.........kkkkk.....',
        ],
        [
          '......................',
          '......................',
          '......................',
          '......................',
          '......................',
          '...............kk.....',
          '.....kkkkkkkkkkDDk....',
          '....kooOooOoookDoDk...',
          '...kooooooooookooooOk.',
          '..kooooooooookokkooOkk',
          '.kOoooooooooookooowwwn',
          'kOkoooooooookwwwwkkkk.',
          '.kOkkkkkkkkkwwwwwk....',
          '..k.........kkkkk.....',
        ],
      ],
      { k: '#3a2418', o: '#d9a066', O: '#b07a44', D: '#8a5a30', w: '#f6ead8', e: '#1b1512', n: '#1b1512', m: '#7a2a2a' }
    );
    // keset kotak-kotak merah di depan pintu
    spritesheetTeks(
      s,
      'keset',
      [['.kkkkkkkkkkkkkkkkkkkkk.', 'krRrRrRrRrRrRrRrRrRrRrk', 'kRrRrRrRrRrRrRrRrRrRrRk', '.kkkkkkkkkkkkkkkkkkkkk.']],
      { k: '#5a2a22', r: '#c65a3a', R: '#e0a060' }
    );
    if (!s.anims.exists('anjing_tidur')) {
      s.anims.create({
        key: 'anjing_tidur',
        frames: s.anims.generateFrameNumbers('anjing', { frames: [F.tidurA, F.tidurA, F.tidurB] }),
        frameRate: 1.4,
        repeat: -1,
      });
      s.anims.create({
        key: 'anjing_kibas',
        frames: s.anims.generateFrameNumbers('anjing', { frames: [F.ekorA, F.ekorB] }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  /** Kurir datang: bangun, menggonggong, dan menggoyang ekor ke arahnya. */
  sambut(dari: { x: number }) {
    this.bangun(this.scene.time.now, 4000);
    this.s.setFlipX(dari.x < this.s.x);
    this.gonggong();
  }

  /** Berdiri dan menggoyang ekor, paling tidak selama `lama` ms. */
  private bangun(t: number, lama: number) {
    if (this.keadaan !== 'bangun') {
      this.keadaan = 'bangun';
      this.s.play('anjing_kibas');
    }
    this.sampai = Math.max(this.sampai, t + lama);
  }

  /** Satu gonggongan: mulut terbuka sebentar, badan sedikit melonjak. */
  private gonggong() {
    this.s.anims.pause();
    this.s.setFrame(F.gonggong);
    this.scene.time.delayedCall(260, () => {
      if (this.keadaan === 'bangun') this.s.anims.resume();
    });
  }

  private dengkur() {
    if (!this.scene.textures.exists('zz')) return;
    const kanan = !this.s.flipX;
    const z = this.scene.add
      .image(this.s.x + (kanan ? 6 : -6), this.s.y - 9, 'zz')
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

  private detak(t: number) {
    const p = this.pemain();
    const jarak = p ? Phaser.Math.Distance.Between(p.x, p.y + 15, this.s.x, this.s.y) : Infinity;

    if (jarak < DEKAT) {
      if (this.keadaan !== 'bangun') {
        this.bangun(t, 2500);
        this.gonggong();
      }
      this.sampai = Math.max(this.sampai, t + 2500);
      if (p) this.s.setFlipX(p.x < this.s.x);
      return;
    }
    if (this.keadaan === 'bangun' && t > this.sampai && jarak > JAUH) {
      this.keadaan = 'duduk';
      this.s.anims.stop();
      this.s.setFrame(F.duduk);
      this.sampai = t + 2200;
    } else if (this.keadaan === 'duduk' && t > this.sampai) {
      this.keadaan = 'tidur';
      this.s.setFlipX(true);
      this.s.play('anjing_tidur');
    }
  }
}
