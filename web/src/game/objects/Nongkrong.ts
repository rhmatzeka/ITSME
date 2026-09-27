import Phaser from 'phaser';
import { DEPTH, UTARA, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';
import { buatDuduk } from './Rupa';
import { bisaDiajak } from './Warga';

/** Di atas tirai malam, bersama cahaya lampu jalan dan lentera — lihat Senter.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/** Isi balon obrolan, sesuai urutan frame tekstur `obrolan`. */
const ISI = { titik: 0, nada: 1, seru: 2, tanya: 3, tawa: 4, hati: 5 } as const;
type Isi = keyof typeof ISI;

/** Yang paling sering: obrolan biasa. Tawa punya giliran sendiri — lihat `giliran()`. */
const OBROLAN: Isi[] = ['titik', 'titik', 'titik', 'seru', 'tanya', 'nada', 'hati'];

interface Penduduk {
  s: Phaser.GameObjects.Sprite;
}

/**
 * Dua warga yang nongkrong di bangku utara: kakek berkacamata dan bapak
 * berpeci. Mereka bergantian bicara — yang bicara menoleh ke lawannya dan
 * mulutnya bergerak, balon kecil muncul di atas kepalanya (…, ♪, !, ?) —
 * sesekali tertawa bersama, sesekali diam memandangi jalan.
 *
 * Di depan ujung kiri bangku ada api unggun: siang cuma tumpukan kayu dengan
 * asap tipis, malam menyala bergoyang dengan cahaya yang berdenyut dan
 * percikan yang naik. Api unggun menghalangi langkah; bangkunya memang sudah.
 */
export class Nongkrong {
  private kakek: Penduduk;
  private bapak: Penduduk;
  private balon: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { kiri, kanan, kaki } = UTARA.bangku;
    this.kakek = this.dudukkan('kakek', kiri, kaki);
    this.bapak = this.dudukkan('bapak', kanan, kaki);
    bisaDiajak(scene, this.kakek.s, 'Grandpa', [
      'Back in my day, websites did not have villages in them.',
      'Rahmat? Good kid. Always building something on that laptop of his.',
    ]);
    bisaDiajak(scene, this.bapak.s, 'Uncle', [
      'Have you tried the bakso by the Projects house? Rahmat is a regular.',
      'We sit here every evening. The fire is nice once the sun goes down.',
    ]);
    this.balon = scene.add.image(0, 0, 'obrolan', 0).setOrigin(0.5, 1).setDepth(KEDALAMAN_CAHAYA + 2).setVisible(false);
    this.nyalakanUnggun(blocked);
    scene.time.delayedCall(1500, () => this.giliran(this.kakek));
  }

  private buatTekstur() {
    const s = this.scene;
    buatDuduk(s, 'kakek', 'kakek_duduk', { toleh: 1, kulit: '#d9a07a', celana: ['#3b3d48', '#262831'] });
    buatDuduk(s, 'bapak', 'bapak_duduk', { toleh: -1, kulit: '#c68b5e', celana: ['#7a3a4a', '#56283a'] });

    // balon obrolan 11×9: isi 9×5 di tengah, ekor di kiri bawah
    const balon = (isi: string[]) => [
      '.kkkkkkkkk.',
      ...isi.map((r) => `k${r.replace(/\./g, 'w')}k`),
      '.kkwwkkkkk.',
      '..kwk......',
      '..kk.......',
    ];
    spritesheetTeks(
      s,
      'obrolan',
      [
        balon(['.........', '.........', '.x..x..x.', '.........', '.........']),
        balon(['.....xx..', '.....x.x.', '.....x...', '...xxx...', '...xx....']),
        balon(['....x....', '....x....', '....x....', '.........', '....x....']),
        balon(['...xxx...', '.....x...', '....x....', '.........', '....x....']),
        balon(['.x.x..x..', '.x.x.x.x.', '.xxx.xxx.', '.x.x.x.x.', '.x.x.x.x.']),
        balon(['..rr.rr..', '.rrrrrrr.', '.rrrrrrr.', '..rrrrr..', '....r....']),
      ],
      { k: '#1b2416', w: '#fbf6e6', x: '#1b2416', r: '#e0463a' }
    );

    const bara = ['..nNnkbBBbknNn..', '.nNakbbkkbbkaNn.', '.NnaakkkkkkaaNn.', '..NNnnNNnnNNnN..'];
    spritesheetTeks(
      s,
      'unggun',
      [
        ['................', '................', '................', '................', '................', '................',
          '.......a........', '........a.......', '.......a........', '.....kbbbbk.....', ...bara],
        ['................', '.......r........', '......rFr.......', '......rFFr......', '.....rFfFr..r...', '..r..rFffFr.Fr..',
          '..Fr.rFfyfFrFr..', '..rFrFffyffFFr..', '...rFfffyfffr...', '....rFbbbbFr....', ...bara],
        ['........r.......', '.......rFr......', '.......rFr......', '..r...rFfFr.....', '..Fr..rFffr..r..', '..rFr.rFfFFr.Fr.',
          '...rFrFfyfFrFr..', '...rFFffyffFFr..', '...rFfffyfffr...', '....rFbbbbFr....', ...bara],
        ['......r.........', '......rF........', '.....rFFr.......', '.....rFfFr...r..', '..r..rFffFr.rF..', '.rF..rFfyfFrFr..',
          '.rFr.rFfyfFFr...', '..rFrFffyffFr...', '...rFfffyffFr...', '....rFbbbbFr....', ...bara],
      ],
      {
        k: '#3a2418', b: '#8a5a2a', B: '#5e3a1a', n: '#b9b3a6', N: '#7d776c', a: '#5a5550',
        f: '#ffd35a', F: '#ff8a2a', r: '#e0463a', y: '#fff2b0',
      }
    );
    if (!s.textures.exists('unggun_cahaya')) {
      const k = s.textures.createCanvas('unggun_cahaya', 96, 96)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, 'rgba(255,200,110,0.95)');
      g.addColorStop(0.3, 'rgba(255,160,70,0.4)');
      g.addColorStop(1, 'rgba(255,130,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 96, 96);
      k.refresh();
    }
  }

  private dudukkan(rupa: string, x: number, kaki: number): Penduduk {
    const s = this.scene.add
      .sprite(x, kaki, `${rupa}_duduk`, 0)
      .setOrigin(0.5, 1)
      // di atas sandaran bangku (layer `aset kedua` = DEPTH.above + 1), di bawah awan
      .setDepth(DEPTH.above + 2);
    return { s };
  }

  /* ---------------- obrolan ---------------- */

  /**
   * Satu giliran bicara, lalu menjadwalkan giliran berikutnya. Kebanyakan
   * bergantian; kadang yang sama bicara lagi, kadang keduanya tertawa, kadang
   * keduanya diam memandangi jalan sebentar.
   */
  private giliran(pembicara: Penduduk) {
    const pendengar = pembicara === this.kakek ? this.bapak : this.kakek;
    const acak = Math.random();

    if (acak < 0.14) {
      // diam sejenak, sama-sama memandang ke depan
      for (const p of [this.kakek, this.bapak]) p.s.setFrame(Math.random() < 0.5 ? 0 : 4);
      this.lanjut(pembicara, 2600, 4200);
      return;
    }
    if (acak < 0.3) {
      this.tertawa();
      this.lanjut(pendengar, 2200, 3200);
      return;
    }

    pendengar.s.setFrame(1);
    this.tampilkanBalon(pembicara, Phaser.Utils.Array.GetRandom(OBROLAN));
    // mulut bergerak: bergantian terbuka dan tertutup
    let n = 0;
    this.scene.time.addEvent({
      delay: 170,
      repeat: 8,
      callback: () => pembicara.s.setFrame(++n % 2 ? 2 : 1),
    });
    this.lanjut(Math.random() < 0.75 ? pendengar : pembicara, 2400, 3800);
  }

  private lanjut(berikut: Penduduk, min: number, maks: number) {
    this.scene.time.delayedCall(Phaser.Math.Between(min, maks), () => this.giliran(berikut));
  }

  private tertawa() {
    this.tampilkanBalon(Math.random() < 0.5 ? this.kakek : this.bapak, 'tawa');
    for (const p of [this.kakek, this.bapak]) {
      let n = 0;
      this.scene.time.addEvent({
        delay: 150,
        repeat: 7,
        callback: () => p.s.setFrame(++n % 2 ? 3 : 1),
      });
    }
  }

  private tampilkanBalon(siapa: Penduduk, isi: Isi) {
    const b = this.balon;
    this.scene.tweens.killTweensOf(b);
    b.setFrame(ISI[isi])
      .setPosition(siapa.s.x + 4, siapa.s.y - 19)
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.4);
    this.scene.tweens.add({ targets: b, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: b, alpha: 0, delay: 1500, duration: 250, onComplete: () => b.setVisible(false) });
  }

  /* ---------------- api unggun ---------------- */

  private nyalakanUnggun(blocked?: Phaser.Physics.Arcade.StaticGroup) {
    const s = this.scene;
    const { x, kaki } = UTARA.unggun;
    const api = s.add.sprite(x, kaki, 'unggun', 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    const cahaya = s.add
      .image(x, kaki - 6, 'unggun_cahaya')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setVisible(false);
    if (blocked) {
      const r = s.add.rectangle(x, kaki - 3, 12, 6);
      s.physics.add.existing(r, true);
      blocked.add(r);
    }

    let t = Math.random() * 10;
    let frame = 1;
    let jedaApi = 0;
    let jedaAsap = 0;
    s.events.on('update', (_w: number, delta: number) => {
      t += delta / 1000;
      const g = this.gelap();
      const nyala = g > 0.15;
      cahaya.setVisible(nyala);
      if (!nyala) {
        if (api.frame.name !== '0') api.setFrame(0);
        // siang: asap tipis dari bara yang tinggal
        if ((jedaAsap -= delta) <= 0) {
          jedaAsap = Phaser.Math.Between(900, 1600);
          this.kepul(x, kaki - 8, 0xd8d4cc, 0.5, 1800);
        }
        return;
      }
      if ((jedaApi -= delta) <= 0) {
        jedaApi = Phaser.Math.Between(90, 150);
        frame = frame === 3 ? 1 : frame + 1;
        api.setFrame(frame);
      }
      const denyut = 0.85 + Math.sin(t * 8.1) * 0.07 + Math.sin(t * 13.7) * 0.05;
      cahaya.setAlpha(Math.min(1, g) * 0.8 * denyut).setScale(0.95 + denyut * 0.12);
      if ((jedaAsap -= delta) <= 0) {
        jedaAsap = Phaser.Math.Between(260, 520);
        this.percik(x + Phaser.Math.Between(-3, 3), kaki - 10);
      }
    });
  }

  /** Kepulan asap: kotak kecil yang naik, melebar, dan memudar. */
  private kepul(x: number, y: number, warna: number, alpha: number, lama: number) {
    const k = this.scene.add.rectangle(x, y, 2, 2, warna, alpha).setDepth(DEPTH.above + 20);
    this.scene.tweens.add({
      targets: k,
      y: y - Phaser.Math.Between(10, 16),
      x: x + Phaser.Math.Between(-4, 4),
      scale: 2,
      alpha: 0,
      duration: lama,
      ease: 'Sine.easeOut',
      onComplete: () => k.destroy(),
    });
  }

  /** Percikan api: satu piksel terang yang naik berkelok lalu padam. */
  private percik(x: number, y: number) {
    const p = this.scene.add
      .rectangle(x, y, 1, 1, Math.random() < 0.5 ? 0xffd35a : 0xff8a2a)
      .setDepth(KEDALAMAN_CAHAYA + 1);
    this.scene.tweens.add({
      targets: p,
      y: y - Phaser.Math.Between(10, 20),
      x: x + Phaser.Math.Between(-5, 5),
      alpha: 0,
      duration: Phaser.Math.Between(700, 1100),
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}
