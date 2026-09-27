import Phaser from 'phaser';
import { DEPTH, UTARA, kedalaman } from '../config';
import { ting } from '../suara';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import type { Senter } from './Senter';
import { bisaDiajak, tanganTerangkat } from './Warga';

/** Di atas tirai malam, bersama cahaya lampu jalan dan lentera — lihat Senter.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/** Seberapa jauh denting mangkoknya masih terdengar, px dunia. */
const JANGKAU_TING = 170;

/**
 * Gerobak bakso di pojok lapangan Projects.
 *
 * Abangnya berdiri di samping kanan gerobak, di sisi etalase mangkoknya —
 * seperti penjaga kios Tech Stack, bukan di baliknya, karena di balik
 * gerobak ia tertutup tenda sampai ke dagu. Sisi kiri gerobak terlalu dekat
 * pintu rumah Projects. Sebentar-sebentar ia mengetuk mangkok: tangannya terangkat
 * dua kali, ada kilau kecil di sendoknya, dan kalau pemain cukup dekat
 * terdengar "ting-ting" yang makin pelan makin jauh. Uap naik terus dari
 * panci; malam hari lampu kecil di bawah tendanya menyala.
 *
 * Sesekali seorang pembeli datang lewat jalan dari arah barat, berdiri di
 * depan gerobak menunggu pesanannya, lalu pergi lagi ke arah datangnya.
 */
export class Bakso {
  private abang: Phaser.GameObjects.Sprite;
  private pembeli?: Phaser.GameObjects.Sprite;
  private bayangPembeli?: Phaser.GameObjects.Sprite;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Phaser.GameObjects.Sprite | undefined,
    blocked?: Phaser.Physics.Arcade.StaticGroup,
    senter?: Senter
  ) {
    this.buatTekstur();
    const { x, kaki } = UTARA.gerobak;
    scene.add.image(x, kaki, 'gerobak_bakso').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 4, 30, 8);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }

    // abang di samping kanan gerobak, di sisi etalase mangkok
    const ax = x + 22;
    const ak = kaki - 2;
    this.abang = scene.add.sprite(ax, ak, 'abang', 0).setOrigin(0.5, 1).setDepth(kedalaman(ak));
    scene.add.sprite(ax, ak - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(this.abang.depth - 0.5);
    this.abang.play('abang_idle_down');
    bisaDiajak(scene, this.abang, 'Bakso seller', [
      'Bakso, bro? Rahmat is a regular here — extra chili, every time.',
      'He says bugs get fixed faster on a full stomach. Hard to argue with that.',
    ]);

    this.pasangLampu(x, kaki);
    this.uap(x - 5, kaki - 20);
    this.jadwalTing();
    if (scene.textures.exists('pembeli')) {
      this.pembeli = scene.add.sprite(0, 0, 'pembeli', 0).setOrigin(0.5, 1).setVisible(false);
      this.bayangPembeli = scene.add.sprite(0, 0, bayanganKaki(scene)).setVisible(false);
      senter?.pegang(this.pembeli);
      scene.time.delayedCall(Phaser.Math.Between(6000, 12000), () => this.datang());
    }
  }

  private buatTekstur() {
    const s = this.scene;
    tanganTerangkat(s, 'abang', 'abang_ketuk', '#c68b5e', '#f4f1ea');
    Player.registerAnimations(s, 'abang');
    Player.registerAnimations(s, 'pembeli');
    spritesheetTeks(
      s,
      'gerobak_bakso',
      [
      [
        '................................',
        '...kkkkkkkkkkkkkkkkkkkkkkkkkk...',
        '..kccccccccccccccccccccccccccck.',
        '..kCCCCCCCCCCCCCCCCCCCCCCCCCCCk.',
        '...kkbkkkkkkkkkkkkkkkkkkkkkbkk..',
        '.....b....................b.....',
        '.....b..kkkkkk............b.....',
        '.....b.kmmmmmmk.kkkkkkkkkkbk....',
        '.....bkmsmmmmmMkkvvvvvvvvvvvk...',
        '....kkkMMMMMMMMkkvsvVvsvVvsvk...',
        '....kmmmmmmmmmmmkvvvvvvvvvvvk...',
        '....kmmmmmmmmmmMkVVVVVVVVVVVk...',
        '...kkkkkkkkkkkkkkkkkkkkkkkkkkk..',
        '...ksssrrsssrssrsrssrrssrsssssk.',
        '...ksssrsrsrsrsrsrsrsssrsrssssk.',
        '...ksssrrssrrrsrrsssrssrsrssssk.',
        '...ksssrsrsrsrsrsrsssrsrsrssssk.',
        '...ksssrrssrsrsrsrsrrsssrsssssk.',
        '...kssssssssssssssssssssssssssk.',
        '...kSSSSSSSSSSSSSSSSSSSSSSSSSSk.',
        '...kkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
        '....kCk..kkk..........kkk..kCk..',
        '....kCk.kMaMk........kMaMk.kCk..',
        '....kkk.kaMak........kaMak.kkk..',
        '........kMaMk........kMaMk......',
        '.........kkk..........kkk.......',
      ],
      ],
      {
        k: '#3a2418', b: '#8a5a2a', c: '#3f7fd6', C: '#2a5aa0', v: '#dff3ff', V: '#a8d8f0',
        m: '#c9ccd6', M: '#8a8f9c', a: '#5a5550', s: '#f4f1ea', S: '#cfc9bd', r: '#e0463a',
      }
    );
    // kilau sendok di mangkok: bintang kecil 5×5
    spritesheetTeks(s, 'kilau_ting', [['..y..', '..Y..', 'yYWYy', '..Y..', '..y..']], {
      y: '#ffd35a',
      Y: '#fff2b0',
      W: '#ffffff',
    });
    if (!s.textures.exists('lampu_gerobak')) {
      const k = s.textures.createCanvas('lampu_gerobak', 64, 64)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,236,170,0.95)');
      g.addColorStop(0.35, 'rgba(255,214,120,0.4)');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      k.refresh();
    }
  }

  /** Bola lampu di bawah tenda: menyala saat langit gelap. */
  private pasangLampu(x: number, kaki: number) {
    const s = this.scene;
    const ly = kaki - 21;
    const bola = s.add.rectangle(x, ly, 2, 2, 0xfff2b0).setDepth(kedalaman(kaki) + 0.5).setVisible(false);
    const cahaya = s.add
      .image(x, ly + 2, 'lampu_gerobak')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setVisible(false);
    s.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        const g = this.gelap();
        const nyala = g > 0.2;
        bola.setVisible(nyala);
        cahaya.setVisible(nyala).setAlpha(Math.min(1, g) * 0.7);
      },
    });
  }

  /** Uap dari panci: gumpalan putih yang naik berkelok lalu hilang. */
  private uap(x: number, y: number) {
    const s = this.scene;
    s.time.addEvent({
      delay: 380,
      loop: true,
      callback: () => {
        const k = s.add
          .rectangle(x + Phaser.Math.Between(-3, 3), y, 2, 2, 0xffffff, 0.75)
          .setDepth(DEPTH.above + 20);
        s.tweens.add({
          targets: k,
          y: y - Phaser.Math.Between(9, 14),
          x: k.x + Phaser.Math.Between(-4, 4),
          scale: 2.2,
          alpha: 0,
          duration: Phaser.Math.Between(1300, 1800),
          ease: 'Sine.easeOut',
          onComplete: () => k.destroy(),
        });
      },
    });
  }

  /* ---------------- ting-ting ---------------- */

  private jadwalTing() {
    this.scene.time.delayedCall(Phaser.Math.Between(6000, 11000), () => {
      this.ketuk(2);
      this.jadwalTing();
    });
  }

  /** Mengetuk mangkok `kali` kali: tangan naik, turun, denting. */
  private ketuk(kali: number) {
    const s = this.scene;
    const a = this.abang;
    a.anims.stop();
    const satu = (n: number) => {
      a.setTexture('abang_ketuk', 0);
      s.time.delayedCall(170, () => {
        a.setTexture('abang_ketuk', 1);
        this.denting();
        s.time.delayedCall(170, () => {
          if (n > 1) satu(n - 1);
          else a.play('abang_idle_down');
        });
      });
    };
    satu(kali);
  }

  private denting() {
    const s = this.scene;
    const a = this.abang;
    // genggaman di frame abang_ketuk: sekitar (25, 19) dari pojok frame 32×32
    const hx = a.x + 9;
    const hy = a.y - 13;
    const k = s.add.image(hx, hy, 'kilau_ting').setDepth(KEDALAMAN_CAHAYA + 2).setScale(0.5);
    s.tweens.add({ targets: k, scale: 1, y: hy - 3, duration: 140, ease: 'Back.easeOut' });
    s.tweens.add({ targets: k, alpha: 0, delay: 200, duration: 220, onComplete: () => k.destroy() });
    const p = this.pemain();
    if (!p) return;
    const jarak = Phaser.Math.Distance.Between(p.x, p.y, a.x, a.y);
    ting(1 - jarak / JANGKAU_TING);
  }

  /* ---------------- pembeli ---------------- */

  /**
   * Pembeli datang menyusuri jalur bawah jalan atas, lurus ke depan gerobak.
   * Lapangan kecil ini tertutup pagar tanaman di selatan dan timur; satu-satunya
   * jalan masuk memang dari barat, dan jalur itu lurus tanpa rintangan.
   */
  private datang() {
    const p = this.pembeli;
    if (!p) return;
    const s = this.scene;
    const { x, kaki } = UTARA.gerobak;
    const dari = { x: x - 120, y: kaki + 14 };
    const ke = { x: x - 3, y: kaki + 14 };
    p.setPosition(dari.x, dari.y).setDepth(kedalaman(dari.y)).setAlpha(0).setVisible(true).play('pembeli_walk_right');
    s.tweens.add({ targets: p, alpha: 1, duration: 400 });
    this.jalan(p, ke, () => {
      p.play('pembeli_idle_up');
      // menunggu bakso diracik — abangnya mengetuk mangkok tanda siap
      s.time.delayedCall(2500, () => this.ketuk(1));
      s.time.delayedCall(Phaser.Math.Between(5000, 7000), () => {
        p.play('pembeli_walk_left');
        this.jalan(p, dari, () => {
          s.tweens.add({
            targets: p,
            alpha: 0,
            duration: 400,
            onComplete: () => {
              p.setVisible(false);
              this.bayangPembeli?.setVisible(false);
              s.time.delayedCall(Phaser.Math.Between(22000, 40000), () => this.datang());
            },
          });
        });
      });
    });
  }

  private jalan(p: Phaser.GameObjects.Sprite, ke: { x: number; y: number }, sampai: () => void) {
    const jarak = Phaser.Math.Distance.Between(p.x, p.y, ke.x, ke.y);
    this.scene.tweens.add({
      targets: p,
      x: ke.x,
      y: ke.y,
      duration: (jarak / 30) * 1000,
      onUpdate: () => {
        p.setDepth(kedalaman(p.y));
        this.bayangPembeli?.setPosition(p.x, p.y - 1).setDepth(p.depth - 0.5).setAlpha(p.alpha * BAYANGAN_KAKI).setVisible(p.visible);
      },
      onComplete: sampai,
    });
  }
}
