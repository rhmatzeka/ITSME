import Phaser from 'phaser';
import { ABOUT, DEPTH, kedalaman } from '../config';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';

/** Frame lembar `anjing` 28×19, hadap kanan (hadap kiri = dicerminkan). */
const F = { ekorA: 0, ekorB: 1, gonggong: 2, duduk: 3, tidurA: 4, tidurB: 5 } as const;

/** Jarak kaki pemain ke anjing yang membangunkannya, dan yang membuatnya tidur lagi, px. */
const DEKAT = 34;
const JAUH = 52;

const GUK = ['Woof!', 'Arf arf!', '*wags tail happily*', 'Woof woof!'];

type Keadaan = 'tidur' | 'bangun' | 'duduk';

/**
 * Anjing penjaga rumah About, tidur di keset di sebelah kanan pintu, dengan
 * mangkuk makannya di sebelahnya. Cokelat berdada putih, telinga terlipat
 * menggantung, moncong panjang berhidung hitam, dan kalung merah bermedali —
 * ciri-ciri yang membuatnya terbaca sebagai anjing, bukan kucing.
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
      .setScale(1.9, 1.2)
      .setAlpha(BAYANGAN_KAKI)
      .setDepth(kedalaman(kaki) - 0.5);
    scene.add.image(x + 14, kaki + 8, 'mangkuk_anjing').setOrigin(0.5, 1).setDepth(kedalaman(kaki + 8));
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
    // digambar di scratchpad anjing2.py: bentuk dasar elips + garis tepi otomatis, lalu
    // telinga terlipat, moncong dan dada putih, kalung merah bermedali
    spritesheetTeks(
      s,
      'anjing',
      [
        // berdiri, ekor naik, lidah menjulur
        [
          '............................',
          '..................kkkkk.....',
          '.................kDDoook....',
          '...k............kDDDooook...',
          '..kwk..........koDDDooeook..',
          '.kok...........koDDoooeookk.',
          '.kok....kkkkkkkkooDoooowwonn',
          '.kok.kkkOOOOOOOOrooooowwwwwk',
          '..kokooooooooooorwwooowwwwk.',
          '...koooooooooooorrwwokkkpk..',
          '...koooooooooooowywwok.kpk..',
          '...koooooooooooowwwwk...k...',
          '....kOOooooooooOOwwwk.......',
          '....kOOkoooooooOOwwok.......',
          '....kOOkookkkkkOOkook.......',
          '....kOOkook...kOOkook.......',
          '....kWWkook...kWWkook.......',
          '.....kkkwwk....kkkwwk.......',
          '........kk........kk........',
        ],
        // ekor turun (kibasan)
        [
          '............................',
          '..................kkkkk.....',
          '.................kDDoook....',
          '................kDDDooook...',
          '...............koDDDooeook..',
          'k..............koDDoooeookk.',
          'wk......kkkkkkkkooDoooowwonn',
          'okk..kkkOOOOOOOOrooooowwwwwk',
          'kookkooooooooooorwwooowwwwk.',
          '.kkooooooooooooorrwwokkkpk..',
          '...koooooooooooowywwok.kpk..',
          '...koooooooooooowwwwk...k...',
          '....kOOooooooooOOwwwk.......',
          '....kOOkoooooooOOwwok.......',
          '....kOOkookkkkkOOkook.......',
          '....kOOkook...kOOkook.......',
          '....kWWkook...kWWkook.......',
          '.....kkkwwk....kkkwwk.......',
          '........kk........kk........',
        ],
        // menggonggong
        [
          '............................',
          '..................kkkkk.....',
          '.................kDDoook....',
          '...k............kDDDooook...',
          '..kwk..........koDDDooeook..',
          '.kok...........koDDoooeookk.',
          '.kok....kkkkkkkkooDoooowwonn',
          '.kok.kkkOOOOOOOOrooooowwwwwk',
          '..kokooooooooooorwwooowmmmm.',
          '...koooooooooooorrwwokkkwwk.',
          '...koooooooooooowywwok......',
          '...koooooooooooowwwwk.......',
          '....kOOooooooooOOwwwk.......',
          '....kOOkoooooooOOwwok.......',
          '....kOOkookkkkkOOkook.......',
          '....kOOkook...kOOkook.......',
          '....kWWkook...kWWkook.......',
          '.....kkkwwk....kkkwwk.......',
          '........kk........kk........',
        ],
        // duduk
        [
          '.................kkkkk......',
          '................kDDoook.....',
          '...............kDDDooook....',
          '..............koDDDooeook...',
          '..............koDDoooeookk..',
          '..............kooDoooowwonn.',
          '..............krooooowwwwwk.',
          '.............korowooowwwwk..',
          '.........kkkkoorrwwokkkpk...',
          '........koooooowywwok.kpk...',
          '.......kooooooowwwwok..k....',
          '......koooooooowwwwok.......',
          '......kooooooooowwwk........',
          '..k...kooooooooOOwok........',
          '.kwkk.kooooooooOOook........',
          '..kookkkoooooooOOook........',
          '...kkookoooooooOOook........',
          '.....kkkwwooookkkwwk........',
          '........kkkkkk...kk.........',
        ],
        // tidur melingkar, dua tarikan napas
        [
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '......kkkkkkkkkk............',
          '.....kooooooooook.kk........',
          '....kOOOOOOOOOOookookk......',
          '...kooooooooooooDDooook.....',
          '..koooooooooooorDDDooook....',
          '..koooooooooooorDDDokkokk...',
          '...koooooooooooroDDooowwonn.',
          '...kooooooooooorooooowwwwok.',
          '...Okkoooooooooyooooowwwwk..',
          '....OOOOOOOwookkkooowwwwwk..',
          '........kkkkkk...kkkkkkkk...',
        ],
        [
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '............................',
          '.......kkkkkkkk.............',
          '.....kkooooooookk...........',
          '....kOOOOOOOOOOookkk........',
          '...kooooooooooooooookk......',
          '...kooooooooooooDDooook.....',
          '..koooooooooooorDDDooook....',
          '..koooooooooooorDDDokkokk...',
          '...koooooooooooroDDooowwonn.',
          '....koooooooooorooooowwwwok.',
          '...O.koooooooooyooooowwwwk..',
          '....OOOOOOOwookkkooowwwwwk..',
          '........kkkkkk...kkkkkkkk...',
        ],
      ],
      {
        k: '#3a2418', o: '#c07a3c', O: '#94582a', D: '#6e3e1e', w: '#f7eedf', W: '#dccab0', n: '#1b1512',
        e: '#1b1512', r: '#d8322c', R: '#a02420', y: '#f2c94c', p: '#ef7a8a', m: '#5a1f1f',
      }
    );
    // keset kotak-kotak merah di depan pintu
    spritesheetTeks(
      s,
      'keset',
      [['.kkkkkkkkkkkkkkkkkkkkkkkkk.', 'krRrRrRrRrRrRrRrRrRrRrRrRrk', 'kRrRrRrRrRrRrRrRrRrRrRrRrRk', '.kkkkkkkkkkkkkkkkkkkkkkkkk.']],
      { k: '#5a2a22', r: '#c65a3a', R: '#e0a060' }
    );
    // mangkuk makan merah berisi kibble
    spritesheetTeks(
      s,
      'mangkuk_anjing',
      [['.kkkkkkk.', 'kbBbbBbbk', 'krrrrrrrk', '.kRRRRRk.', '..kkkkk..']],
      { k: '#3a2418', b: '#b07840', B: '#7a4a24', r: '#d8322c', R: '#a02420' }
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
      .image(this.s.x + (kanan ? 9 : -9), this.s.y - 12, 'zz')
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
