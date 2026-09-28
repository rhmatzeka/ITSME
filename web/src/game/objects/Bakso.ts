import Phaser from 'phaser';
import { DEPTH, UTARA, kedalaman } from '../config';
import { gumam, ting } from '../bunyi';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import type { Senter } from './Senter';
import { bisaDiajak, tanganTerangkat } from './Warga';

/** Di atas tirai malam, bersama cahaya lampu jalan dan lentera — lihat Senter.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/**
 * Gerobak bakso di pojok lapangan Projects.
 *
 * Abangnya berdiri DI BELAKANG gerobak, seperti abang bakso sungguhan:
 * gerobaknya digambar dengan proporsi orang — meja setinggi pinggang,
 * etalase kaca yang rendah, tenda jauh di atas kepala — jadi ia kelihatan
 * dari dada ke atas di antara tenda dan etalase. Sebentar-sebentar ia
 * mengetuk mangkok: tangannya terangkat
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
      const r = scene.add.rectangle(x, kaki - 4, 32, 8);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }

    // abang di belakang etalase: kakinya 10 px di balik garis pijak gerobak,
    // jadi gerobak menutupinya dari pinggang ke bawah. Tidak lebih ke kanan
    // dari x + 2 — tangannya yang terangkat (5-9 px di kanan badan) akan
    // tertutup tiang tenda kanan di x + 12.
    const ax = x + 2;
    const ak = kaki - 10;
    this.abang = scene.add.sprite(ax, ak, 'abang', 0).setOrigin(0.5, 1).setDepth(kedalaman(ak));
    this.abang.play('abang_idle_down');
    bisaDiajak(scene, this.abang, 'Bakso seller', [
      'Bakso, bro? Rahmat is a regular here — extra chili, every time.',
      'He says bugs get fixed faster on a full stomach. Hard to argue with that.',
    ]);

    this.pasangLampu(x, kaki);
    // mulut dandang di (9, 12) lembar gerobak 36×41
    this.uap(x - 8, kaki - 29);
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
    // digambar di scratchpad art2.py: tenda, dandang, etalase kaca tembus pandang, panel, roda
    spritesheetTeks(
      s,
      'gerobak_bakso',
      [
        [
          '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
          '.kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWk.',
          '.kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWk.',
          '.kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWk.',
          '.kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWk.',
          '.krrrrwwwwrrrrwwwwrrrrwwwwrrrrwwwwk.',
          '.krrkkwwkkrrkkwwkkrrkkwwkkrrkkwwkkr.',
          '..kkbkkk..kk..kk..kk..kk..kk..kbk.k.',
          '...kbk........................kbk...',
          '...kbk........................kbk...',
          '...kbk........................kbk...',
          '...kbk........................kbk...',
          '...kbk...kk...................kbk...',
          '...kbk.kkkkkk.................kbk...',
          '...kbkkmhhmmmk................kbk...',
          '...kbkkkkkkkkkk...............kbk...',
          '...kbkmhmmmmMMk...............kbk...',
          '...kbkmhmmmmMMk...............kbk...',
          '...kkkmhmmmmMMkk..............kbk...',
          '...kbkmhmmmmMMk...............kbk...',
          '...kbkMMMMMMMMk...............kbk...',
          '...kbkmhmmmmMMk...............kbk...',
          '...kbkmhmmmmMMk.kkkkkkkkkkkkkkkkk...',
          '...kbkmhmmmmMMk.knnnnnnnnnnnnnnkk...',
          '...kbkmhmmmmMMk.kgGggggMGggggxgkk...',
          '...kbkmhmmmmMMk.kggxxxgMgvgvgxskk...',
          '...kbkmhmmmmMMk.kgxxxxxMgyYygxskk...',
          '...kbkkkkkkkkkk.kgoooooMgyyygxskk...',
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '.LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.',
          '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
          '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
          '..kppppppuupppuppupuppuuppuppppppk..',
          '..kppppppuPupupupuPuPupPPupupppppk..',
          '..kkkkpppuupPuuuPuupPpuppuPuPpkkkk..',
          '..kaaakppuPupuPuPuPupppupuPuPkaaak..',
          '.kaeAeakpuupPuPuPuPuPuupPpupkaeAeak.',
          '.kaAnAakPPPPPPPPPPPPPPPPPPPPkaAnAak.',
          '.kaeAeakkkkkkkkkkkkkkkkkkkkkkaeAeak.',
          '..kaaak......................kaaak..',
          '...kkk........................kkk...',
        ],
      ],
      { A: '#6e6e78', G: 'rgba(240,250,255,0.85)', L: '#c89060', M: '#a9afbb', P: '#24558f', R: '#d8403a', W: '#fbf6e6', Y: '#d9a52a', a: '#4a4a52', b: '#a8703a', e: '#9a9aa4', g: 'rgba(196,232,255,0.45)', h: '#ffffff', k: '#3a2418', m: '#dfe3ea', n: '#7b818e', o: '#f4efe4', p: '#2f6fc0', r: '#a82c2a', s: '#3a2a22', u: '#ffe38a', v: '#5cb85c', w: '#d9d2c2', x: '#e0463a', y: '#f2c94c' }
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
    // bola lampu menggantung di tengah tepi tenda
    const ly = kaki - 33;
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
    ting(a.x, a.y);
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
      // memesan: "Bang, baksonya satu!"
      gumam(p.x, p.y, 'pria', 4, 0.8);
      s.time.delayedCall(900, () => gumam(this.abang.x, this.abang.y, 'bapak', 2, 0.7));
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
