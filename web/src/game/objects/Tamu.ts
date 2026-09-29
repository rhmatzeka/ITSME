import Phaser from 'phaser';
import { gumam } from '../bunyi';
import { DEPTH, LAPANGAN, PLAYER, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { Kerlip } from './Kerlip';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatJongkok, buatRupa } from './Rupa';
import { bisaDiajak } from './Warga';
import { arahKePemain, sisiPemain } from './toleh';
import { UapKopi } from './UapKopi';

/**
 * Pos ronda di malam hari, lebih ramai: lampu kelap-kelip di tepi atapnya,
 * seorang tetangga yang mampir — jongkok di kiri pos dengan segelas kopi,
 * mengobrol dengan bapak ronda — dan motor bebeknya yang diparkir di
 * rumput di bawah pos. Siang hari pos itu kosong; lampunya mati.
 */
export class TamuRonda {
  private tamu: Phaser.GameObjects.Sprite;
  private kopi: Phaser.GameObjects.Image;
  private motor: Phaser.GameObjects.Image;
  private bayang: Phaser.GameObjects.Sprite[] = [];
  private balon?: Phaser.GameObjects.Image;
  private jeda = 3000;
  private hadir = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    const { x, kaki } = LAPANGAN.ronda;
    // kabel di bawah lis atap rumbia (baris 10-11 gambar pos: y kaki-34)
    new Kerlip(
      scene,
      [
        { x: x - 20, y: kaki - 33 },
        { x: x, y: kaki - 32 },
        { x: x + 20, y: kaki - 33 },
      ],
      2,
      kedalaman(kaki) + 0.5,
      gelap
    );

    const t = LAPANGAN.tamu;
    this.tamu = scene.add.sprite(t.x, t.kaki, 'tamu_jongkok', 0).setOrigin(0.5, 1).setDepth(kedalaman(t.kaki));
    this.kopi = scene.add.image(t.x + 7, t.kaki - 1, 'kopi').setOrigin(0.5, 1).setDepth(kedalaman(t.kaki) + 0.1);
    new UapKopi(scene, () => (this.hadir > 0.5 ? { x: this.kopi.x, y: this.kopi.y - 5 } : null), gelap);
    this.bayang.push(scene.add.sprite(t.x, t.kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(t.kaki) - 0.5));
    bisaDiajak(scene, this.tamu, 'Neighbor', [
      'Just keeping Pak Ronda company. The coffee here is free!',
      'My motorbike is parked right there. Nobody steals anything with him on watch.',
    ]);

    const m = LAPANGAN.motor;
    this.motor = scene.add.image(m.x, m.kaki, 'motor_bebek').setOrigin(0.5, 1).setDepth(kedalaman(m.kaki));
    this.bayang.push(scene.add.sprite(m.x, m.kaki - 1, bayanganKaki(scene)).setScale(2, 1).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(m.kaki) - 0.5));
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    // tetangga: rambut hitam, kaos biru dongker, sarung cokelat kotak
    buatRupa(s, 'player', 'tamu', {
      tukar: {
        '#f79617': '#2d2a33',
        '#fb6b1d': '#1b1920',
        '#f9c22b': '#4d4857',
        '#fdcbb0': '#d9a07a',
        '#fca790': '#b98260',
        '#e83b3b': '#2b3f6b',
        '#ae2334': '#1d2b4d',
        '#ffffff': '#c9d4ea',
        '#cd683d': '#8a5a36',
        '#9e4539': '#5e3a1f',
      },
    });
    buatJongkok(s, 'tamu', 'tamu_jongkok', ['#8a5a36', '#5e3a1f']);
    spritesheetTeks(s, 'kopi', [['kkkkk', 'kccck', 'kcsck', 'kIcIk', 'kIIIk', '.kkk.']], {
      I: '#d9d4c8',
      c: '#8a3a20',
      k: '#3a2418',
      s: '#3a2a22',
    });
    // motor bebek merah tampak samping, menghadap kiri: spakbor di atas kedua
    // roda, bodi samping berkilau, jok hitam — digambar di scratchpad art2/benda3.py
    // dan dibandingkan dengan aset karakter supaya skalanya pas
    spritesheetTeks(
      s,
      'motor_bebek',
      [
        [
          '..kk....................',
          '.kMMk...................',
          '..kMk.......kkkkkkkk....',
          '.kkMkk.....kSSSSSSSSk...',
          'kyrrrrk...ksssssssssk...',
          'kyrLrrrk.kkRRRRRRRRRRk..',
          '.krrrrrrkrrrrrLLLrrrrlk.',
          '.krrrrrrrrrrrrrrrrrrrRk.',
          '..krRRkkkkkkMMMMkkRRRk..',
          'kRRRRRk..kMMmMMMkkRRRRRk',
          '.ktttk............ktttk.',
          'ktkwktk..........ktkwktk',
          'ktwmwtk..........ktwmwtk',
          'ktkwktk..........ktkwktk',
          '.ktttk............ktttk.',
          '..kkk..............kkk..',
        ],
      ],
      { k: '#3b2630', M: '#8a9098', m: '#dfe3ea', s: '#3a3640', S: '#5c5664', r: '#d8433a', R: '#962a26', L: '#f47a68', y: '#fff2b0', l: '#ff6a4a', t: '#26222a', w: '#9aa0aa' }
    );
  }

  private detak(_t: number, delta: number) {
    // datang setelah gelap, sama dengan bapak ronda; gerimis membuatnya pulang
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.5) / 0.2, 0, 1) * (1 - Phaser.Math.Clamp(cuaca.hujan * 2, 0, 1));
    const ada = this.hadir > 0;
    for (const o of [this.tamu, this.kopi, this.motor]) o.setVisible(ada).setAlpha(this.hadir);
    for (const b of this.bayang) b.setVisible(ada).setAlpha(this.hadir * BAYANGAN_KAKI);
    if (this.tamu.input) this.tamu.input.enabled = this.hadir > 0.5;
    // menghadap bapak ronda (kanan); pemain yang lewat di kirinya ditoleh
    this.tamu.setFlipX(sisiPemain(this.tamu.x, this.tamu.y) < 0);
    if (this.hadir < 1) return;
    if ((this.jeda -= delta) > 0) return;
    this.jeda = Phaser.Math.Between(3500, 7000);
    // mengobrol: mengangguk-angguk sambil bergumam, kadang balon kecil di atas kepalanya
    let n = 0;
    this.scene.time.addEvent({ delay: 220, repeat: 5, callback: () => this.tamu.setFrame(++n % 2) });
    gumam(this.tamu.x, this.tamu.y - 8, 'pria', Phaser.Math.Between(2, 4), 0.6);
    if (this.scene.textures.exists('obrolan') && Math.random() < 0.5) {
      this.balon ??= this.scene.add.image(0, 0, 'obrolan', 0).setOrigin(0.5, 1).setDepth(DEPTH.above + 63).setVisible(false);
      const b = this.balon;
      this.scene.tweens.killTweensOf(b);
      b.setFrame(Phaser.Math.RND.pick([0, 0, 2, 3, 4]))
        .setPosition(this.tamu.x + 3, this.tamu.y - 16)
        .setVisible(true)
        .setAlpha(1)
        .setScale(0.4);
      this.scene.tweens.add({ targets: b, scale: 1, duration: 180, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: b, alpha: 0, delay: 1500, duration: 250, onComplete: () => b.setVisible(false) });
    }
  }
}

/**
 * Pembeli yang melihat-lihat di depan kios Tech Stack, dan lampu kelap-kelip
 * di tepi tenda birunya. Ia berdiri di samping lingkaran pintu — bukan di
 * atasnya — membelakangi kita, sesekali menoleh ke kiri dan kanan seperti
 * sedang memilih.
 */
export class PembeliKios {
  readonly s: Phaser.GameObjects.Sprite;
  private jeda = 2000;

  constructor(
    private scene: Phaser.Scene,
    gelap: () => number
  ) {
    // lis bawah tenda biru-putih: x 150-187, y 441 — tenda di layer `di atas map 1`
    new Kerlip(
      scene,
      [
        { x: 150, y: 441 },
        { x: 168, y: 442 },
        { x: 187, y: 441 },
      ],
      2,
      DEPTH.above + 2,
      gelap
    );
    // pembeli: topi hijau, kaos abu-abu, celana jins
    buatRupa(scene, 'player', 'pembeli_kios', {
      topi: ['#3f8a5a', '#2c6644'],
      tukar: {
        '#f79617': '#2d2a33',
        '#fb6b1d': '#1b1920',
        '#f9c22b': '#4d4857',
        '#fdcbb0': '#e8b48a',
        '#fca790': '#c98f6a',
        '#e83b3b': '#8a8f9c',
        '#ae2334': '#5d616c',
        '#ffffff': '#c9ced6',
        '#cd683d': '#3b5a8a',
        '#9e4539': '#2a3f66',
      },
    });
    Player.registerAnimations(scene, 'pembeli_kios');
    const kaki = 471;
    this.s = scene.add.sprite(185, kaki - PLAYER.baseY, 'pembeli_kios', 12).setDepth(kedalaman(kaki));
    scene.add.sprite(185, kaki - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setDepth(kedalaman(kaki) - 0.5);
    this.s.play('pembeli_kios_idle_up');
    bisaDiajak(scene, this.s, 'Customer', [
      'Just browsing. This stall has a bit of everything — web, mobile, even smart contracts.',
      'I came for Kotlin and ended up reading about Solidity.',
    ]);
    scene.events.on('update', this.detak, this);
  }

  private detak(_t: number, delta: number) {
    // pemain lewat: berhenti memilih dan menatapnya
    const a = arahKePemain(this.s.x, this.s.y + PLAYER.baseY);
    if (a) {
      this.s.play(`pembeli_kios_idle_${a}`, true);
      this.jeda = 1200;
      return;
    }
    if ((this.jeda -= delta) > 0) return;
    // kebanyakan memandangi dagangan; sesekali menoleh sebentar
    const toleh = Math.random() < 0.35;
    this.jeda = toleh ? Phaser.Math.Between(900, 1600) : Phaser.Math.Between(3000, 6500);
    this.s.play(`pembeli_kios_idle_${toleh ? Phaser.Math.RND.pick(['left', 'right']) : 'up'}`, true);
  }
}
