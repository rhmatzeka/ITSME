import Phaser from 'phaser';
import { desis, gumam, tek } from '../bunyi';
import { DEPTH, PLAYER, kedalaman } from '../config';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatRupa } from './Rupa';
import { bisaDiajak, tanganTerangkat } from './Warga';

/** Di atas tirai malam, bersama cahaya lampu jalan dan lentera — lihat Senter.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/**
 * Jalur gerobak, px dunia: jalan tanah utara (baris 6-7). Masuk dari
 * jembatan di tepi barat peta, berhenti memasak di dua tempat, lalu
 * berbalik pulang ke barat. Tidak sampai ke x 350 ke timur: di sana tajuk
 * pohon besar di depan rumah Projects menutupi atap gerobaknya, dan lebih
 * ke timur lagi sudah ada gerobak bakso.
 */
const JALUR = { kaki: 124, masuk: -40, singgah: [190, 300] } as const;

/** Kecepatan mendorong gerobak, px/detik: pelan, gerobaknya berat. */
const LAJU = 16;

/** Lebar gambar gerobak; kompor dan wajan di ujung belakang (kiri saat menghadap kanan). */
const LEBAR = 44;

/**
 * Penjual nasi goreng keliling — pasangan malam gerobak bakso.
 *
 * Hanya keluar setelah gelap: mendorong gerobaknya dari jembatan barat
 * menyusuri jalan utara, lampu petromaksnya menyala di bawah atap
 * bergaris, dan sesekali ia memukul wajannya "tek-tek-tek" supaya warga
 * tahu ia lewat. Di dua tempat ia berhenti memasak: api kompor menyala,
 * minyak mendesis, asap mengepul dari wajan, dan tek-tek-nya makin sering.
 * Lalu ia berbalik, pulang, dan beberapa saat kemudian lewat lagi.
 */
export class NasiGoreng {
  private gerobak: Phaser.GameObjects.Sprite;
  private abang: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Sprite;
  private cahaya: Phaser.GameObjects.Image;
  private genangan: Phaser.GameObjects.Image;
  private x: number = JALUR.masuk;
  private arah = 1;
  private keadaan: 'pulang' | 'jalan' | 'masak' = 'pulang';
  private tujuan = 0;
  private singgahKe = 0;
  private sampai = 0;
  private jedaTek = 4000;
  private jedaAsap = 0;
  private memukul = false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    this.buatTekstur();
    const y = JALUR.kaki;
    this.gerobak = scene.add.sprite(this.x, y, 'gerobak_nasgor', 0).setOrigin(0.5, 1).setVisible(false);
    this.abang = scene.add.sprite(this.x, y - PLAYER.baseY, 'nasgor', 0).setVisible(false);
    this.bayang = scene.add.sprite(this.x, y - 1, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setVisible(false);
    this.cahaya = scene.add
      .image(0, 0, 'lampu_nasgor')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(KEDALAMAN_CAHAYA)
      .setVisible(false);
    // genangan cahaya di tanah di bawah gerobak — tekstur yang sama dengan lampu jalan
    this.genangan = scene.add
      .image(0, 0, scene.textures.exists('lampu_genangan') ? 'lampu_genangan' : 'lampu_nasgor')
      .setScale(0.25 * 0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.above + 60)
      .setVisible(false);
    bisaDiajak(scene, this.abang, 'Nasi goreng seller', [
      'Nasi goreng! Tek-tek-tek! Rahmat always orders it extra spicy after a late night of coding.',
      'I only come out at night. The bakso guy has the day shift.',
    ]);
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    spritesheetTeks(
      s,
      'gerobak_nasgor',
      [
        [
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '.........kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWRk',
          '.........krrrrwwwwrrrrwwwwrrrrwwwwrrrrwwwwrk',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '..........kpk..ww.krr..ww..rr..ww..rr..wkpk.',
          '..........kpk.....k.....................kpk.',
          '..........kpk...klllk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...kYYYk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...klllk...................kpk.',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '........hkGGggggggggggggggggggggggggggggggk.',
          '........hkGgggggggggggggggggggggggggggggggk.',
          '.......h.kgeggggeggggeggggeggggeggggeggggek.',
          '......ss.kggoooggfffggcccggoooggfffggcccggk.',
          'kknNnNnkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          'kvvvvvvvvkwwwwwwwwttwwwtwwtttwtttwwwwwwwwwk.',
          '.kvvvvvvkkwwwwwwwwtwtwtwtwtwwwwtwwwwwwwwwwk.',
          '.kkkkkkkkkwwwwwwwwtwtwtttwtttwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwwwtwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwtttwtttwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.',
          '.kkkkkkSkkwyyyyyyyyyyyyyyyyyyyyyyyyyyyyyywk.',
          '.kkDDDkSkkwwwwtttwtttwttwwtttwttwwtttwwwwwk.',
          '.kkDDDkSkkwwwwtwwwtwtwtwtwtwwwtwtwtwwwwwwwk.',
          '.kkDDDkSkkwwwwtwtwtwtwttwwttwwtwtwtwtwwwwwk.',
          '.kkkkkkSkkwwwwtwtwtwtwtwtwtwwwtwtwtwtwwwwwk.',
          '.ksssssSkkwwwwtttwtttwtwtwtttwtwtwtttwwwwwk.',
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '.kBbbbbbBbbbbbkkkbbbBbbbbbBbbbbbBbkkkbBbbbk.',
          '.kkkkkkkkkkkkkaaakkkkkkkkkkkkkkkkkaaakkkkkk.',
          '............kaaeaak.............kaaeaak.....',
          '............kaeeeak.............kaeeeak.....',
          '............kaaeaak.............kaaeaak.....',
          '.............kaaak...............kaaak......',
          '..............kkk.................kkk.......',
        ],
        [
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '.........kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWRk',
          '.........krrrrwwwwrrrrwwwwrrrrwwwwrrrrwwwwrk',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '..........kpk..ww.krr..ww..rr..ww..rr..wkpk.',
          '..........kpk.....k.....................kpk.',
          '..........kpk...klllk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...kYYYk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...klllk...................kpk.',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '........hkGGggggggggggggggggggggggggggggggk.',
          '........hkGgggggggggggggggggggggggggggggggk.',
          '.......h.kgeggggeggggeggggeggggeggggeggggek.',
          '......ss.kggoooggfffggcccggoooggfffggcccggk.',
          'kknNnNnkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          'kvvvvvvvvkwwwwwwwwttwwwtwwtttwtttwwwwwwwwwk.',
          '.kvvvvvvkkwwwwwwwwtwtwtwtwtwwwwtwwwwwwwwwwk.',
          '.kkkkkkkkkwwwwwwwwtwtwtttwtttwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwwwtwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwtttwtttwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.',
          '.kkkkkkSkkwyyyyyyyyyyyyyyyyyyyyyyyyyyyyyywk.',
          '.kkDDFkSkkwwwwtttwtttwttwwtttwttwwtttwwwwwk.',
          '.kkFYDkSkkwwwwtwwwtwtwtwtwtwwwtwtwtwwwwwwwk.',
          '.kkFFFkSkkwwwwtwtwtwtwttwwttwwtwtwtwtwwwwwk.',
          '.kkkkkkSkkwwwwtwtwtwtwtwtwtwwwtwtwtwtwwwwwk.',
          '.ksssssSkkwwwwtttwtttwtwtwtttwtwtwtttwwwwwk.',
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '.kBbbbbbBbbbbbkkkbbbBbbbbbBbbbbbBbkkkbBbbbk.',
          '.kkkkkkkkkkkkkaaakkkkkkkkkkkkkkkkkaaakkkkkk.',
          '............kaaeaak.............kaaeaak.....',
          '............kaeeeak.............kaeeeak.....',
          '............kaaeaak.............kaaeaak.....',
          '.............kaaak...............kaaak......',
          '..............kkk.................kkk.......',
        ],
        [
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '.........kRRRRWWWWRRRRWWWWRRRRWWWWRRRRWWWWRk',
          '.........krrrrwwwwrrrrwwwwrrrrwwwwrrrrwwwwrk',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          '..........kpk..ww.krr..ww..rr..ww..rr..wkpk.',
          '..........kpk.....k.....................kpk.',
          '..........kpk...klllk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...kYYYk...................kpk.',
          '..........kpk...kLLLk...................kpk.',
          '..........kpk...klllk...................kpk.',
          '.........kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '........hkGGggggggggggggggggggggggggggggggk.',
          '........hkGgggggggggggggggggggggggggggggggk.',
          '.......h.kgeggggeggggeggggeggggeggggeggggek.',
          '......ss.kggoooggfffggcccggoooggfffggcccggk.',
          'kknNnNnkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          'kvvvvvvvvkwwwwwwwwttwwwtwwtttwtttwwwwwwwwwk.',
          '.kvvvvvvkkwwwwwwwwtwtwtwtwtwwwwtwwwwwwwwwwk.',
          '.kkkkkkkkkwwwwwwwwtwtwtttwtttwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwwwtwwtwwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwtwtwtwtwtttwtttwwwwwwwwwk.',
          '.ksssssSkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.',
          '.kkkkkkSkkwyyyyyyyyyyyyyyyyyyyyyyyyyyyyyywk.',
          '.kkDFDkSkkwwwwtttwtttwttwwtttwttwwtttwwwwwk.',
          '.kkFDFkSkkwwwwtwwwtwtwtwtwtwwwtwtwtwwwwwwwk.',
          '.kkFYFkSkkwwwwtwtwtwtwttwwttwwtwtwtwtwwwwwk.',
          '.kkkkkkSkkwwwwtwtwtwtwtwtwtwwwtwtwtwtwwwwwk.',
          '.ksssssSkkwwwwtttwtttwtwtwtttwtwtwtttwwwwwk.',
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '.kBbbbbbBbbbbbkkkbbbBbbbbbBbbbbbBbkkkbBbbbk.',
          '.kkkkkkkkkkkkkaaakkkkkkkkkkkkkkkkkaaakkkkkk.',
          '............kaaeaak.............kaaeaak.....',
          '............kaeeeak.............kaeeeak.....',
          '............kaaeaak.............kaaeaak.....',
          '.............kaaak...............kaaak......',
          '..............kkk.................kkk.......',
        ],
      ],
      { k: '#2a1c14', R: '#d8403a', r: '#a82c2a', W: '#fbf6e6', w: '#d9d2c2', p: '#8a6a4a', l: '#d9a52a', L: '#fff2b0', Y: '#ffe27a', g: 'rgba(196,232,255,0.45)', G: 'rgba(240,250,255,0.85)', o: '#f4efe4', f: '#f2c94c', c: '#e0463a', e: '#dfe3ea', t: '#c0392b', y: '#f2b233', b: '#a8703a', B: '#6e4a24', a: '#4a4a52', s: '#9aa0ac', S: '#5d616c', D: '#1b1920', F: '#ff8a2a', n: '#e8c070', N: '#c8904a', h: '#6e4a24', v: '#34343c' }
    );
    // penjual: rambut cepak hitam berkumis, kaos biru muda, celana hitam, handuk kuning di bahu
    buatRupa(s, 'player', 'nasgor', {
      kumis: '#1b1920',
      tukar: {
        '#f79617': '#2d2a33',
        '#fb6b1d': '#1b1920',
        '#f9c22b': '#4d4857',
        '#fdcbb0': '#c68b5e',
        '#fca790': '#a46d45',
        '#e83b3b': '#4a9ad8',
        '#ae2334': '#2f6fa8',
        '#ffffff': '#f2c94c',
        '#cd683d': '#2d2a33',
        '#9e4539': '#1b1920',
      },
    });
    Player.registerAnimations(s, 'nasgor');
    tanganTerangkat(s, 'nasgor', 'nasgor_ketuk', '#c68b5e', '#4a9ad8');
    if (!s.textures.exists('lampu_nasgor')) {
      const k = s.textures.createCanvas('lampu_nasgor', 72, 72)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(36, 36, 0, 36, 36, 36);
      g.addColorStop(0, 'rgba(255,240,190,0.95)');
      g.addColorStop(0.3, 'rgba(255,220,140,0.42)');
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 72, 72);
      k.refresh();
    }
  }

  /** Mulai satu putaran: masuk dari barat. */
  private berangkat() {
    this.keadaan = 'jalan';
    this.x = JALUR.masuk;
    this.arah = 1;
    this.singgahKe = 0;
    this.tujuan = JALUR.singgah[0];
    for (const o of [this.gerobak, this.abang, this.bayang]) o.setVisible(true).setAlpha(1);
    this.abang.play('nasgor_walk_right', true);
  }

  private detak(t: number, delta: number) {
    const g = this.gelap();
    const dt = Math.min(delta, 100) / 1000;
    if (this.keadaan === 'pulang') {
      // menunggu di luar peta; keluar lagi kalau sudah malam
      if (g > 0.6 && t > this.sampai) this.berangkat();
      else return;
    }
    // pagi datang di tengah jalan: langsung berbalik pulang
    if (g < 0.4 && this.arah === 1) {
      this.keadaan = 'jalan';
      this.arah = -1;
      this.tujuan = JALUR.masuk;
      this.singgahKe = JALUR.singgah.length;
    }

    if (this.keadaan === 'jalan') {
      const sisa = this.tujuan - this.x;
      const langkah = LAJU * dt;
      if (Math.abs(sisa) <= langkah) {
        this.x = this.tujuan;
        this.tiba(t);
      } else {
        this.x += Math.sign(sisa) * langkah;
      }
      // sambil lewat, sesekali tek-tek memberi tahu warga
      if ((this.jedaTek -= delta) <= 0) {
        this.jedaTek = Phaser.Math.Between(6000, 10000);
        this.ketuk(Phaser.Math.Between(3, 5));
      }
    } else if (this.keadaan === 'masak') {
      if ((this.jedaTek -= delta) <= 0) {
        this.jedaTek = Phaser.Math.Between(2500, 4500);
        this.ketuk(Phaser.Math.Between(4, 7));
        desis(this.wajan().x, this.wajan().y, 1.6);
      }
      if ((this.jedaAsap -= delta) <= 0) {
        this.jedaAsap = Phaser.Math.Between(260, 420);
        this.asap();
      }
      if (t > this.sampai) {
        this.singgahKe++;
        this.keadaan = 'jalan';
        const lanjut = JALUR.singgah[this.singgahKe];
        this.arah = lanjut === undefined ? -1 : 1;
        this.tujuan = lanjut ?? JALUR.masuk;
        this.abang.play(this.arah > 0 ? 'nasgor_walk_right' : 'nasgor_walk_left', true);
      }
    }
    this.tempatkan(t, g);
  }

  private tiba(t: number) {
    if (this.tujuan === JALUR.masuk) {
      // sampai lagi di luar peta
      this.keadaan = 'pulang';
      this.sampai = t + Phaser.Math.Between(25000, 50000);
      for (const o of [this.gerobak, this.abang, this.bayang, this.cahaya, this.genangan]) o.setVisible(false);
      return;
    }
    this.keadaan = 'masak';
    this.sampai = t + Phaser.Math.Between(26000, 36000);
    this.jedaTek = 600;
    this.abang.play('nasgor_idle_down', true);
    // "Nasi goreeeng!" — seruan penjual keliling
    gumam(this.abang.x, this.abang.y, 'bapak', 4);
  }

  /** Letak semua bagian: gerobak di depan, penjualnya di belakang dekat kompor. */
  private tempatkan(t: number, g: number) {
    const kanan = this.arah > 0;
    const y = JALUR.kaki;
    const z = this.scene.cameras.main.zoom;
    const x = Math.round(this.x * z) / z;
    this.gerobak.setPosition(x, y).setFlipX(!kanan).setDepth(kedalaman(y));
    // api kompor bergantian dua frame selama memasak
    this.gerobak.setFrame(this.keadaan === 'masak' ? 1 + (Math.floor(t / 140) % 2) : 0);
    const belakang = x + (kanan ? -1 : 1) * (LEBAR / 2 + 5);
    this.abang.setPosition(belakang, y - PLAYER.baseY - 1).setDepth(kedalaman(y) + 0.1);
    this.bayang.setPosition(belakang, y - 2).setDepth(kedalaman(y) - 0.4);
    // lampu petromaks di kolom 18 gambar (dari kiri), baris 8
    const lx = x + (kanan ? 18 - LEBAR / 2 : LEBAR / 2 - 18);
    const ly = y - 37 + 8;
    const nyala = Phaser.Math.Clamp((g - 0.2) / 0.4, 0, 1);
    const denyut = 0.92 + Math.sin(t / 90) * 0.04 + Math.sin(t / 37) * 0.03;
    this.cahaya.setPosition(lx, ly).setVisible(nyala > 0 && this.gerobak.visible).setAlpha(nyala * 0.8 * denyut);
    this.genangan.setPosition(x, y + 2).setVisible(nyala > 0 && this.gerobak.visible).setAlpha(nyala * 0.75 * denyut);
  }

  /** Titik wajan di dunia — ujung belakang gerobak. */
  private wajan() {
    const kanan = this.arah > 0;
    return { x: this.gerobak.x + (kanan ? -1 : 1) * (LEBAR / 2 - 5), y: JALUR.kaki - 20 };
  }

  /** Sutil memukul pinggir wajan beberapa kali: tangan naik-turun, "tek-tek-tek". */
  private ketuk(kali: number) {
    if (this.memukul || !this.gerobak.visible) return;
    this.memukul = true;
    const jalan = this.keadaan === 'jalan';
    const a = this.abang;
    let n = 0;
    this.scene.time.addEvent({
      delay: 150,
      repeat: kali - 1,
      callback: () => {
        n++;
        if (!jalan) a.anims.stop();
        if (!jalan) a.setTexture('nasgor_ketuk', n % 2);
        const w = this.wajan();
        tek(w.x, w.y);
        if (n >= kali) {
          this.scene.time.delayedCall(160, () => {
            this.memukul = false;
            if (!jalan && this.keadaan === 'masak') a.play('nasgor_idle_down', true);
          });
        }
      },
    });
  }

  /** Asap dan uap dari wajan yang sedang dipakai memasak. */
  private asap() {
    const w = this.wajan();
    const k = this.scene.add
      .rectangle(w.x + Phaser.Math.Between(-3, 3), w.y - 2, 2, 2, 0xf4f1ea, 0.6)
      .setDepth(DEPTH.above + 20);
    this.scene.tweens.add({
      targets: k,
      y: k.y - Phaser.Math.Between(12, 18),
      x: k.x + Phaser.Math.Between(-3, 6),
      scale: 2.4,
      alpha: 0,
      duration: Phaser.Math.Between(1300, 1900),
      ease: 'Sine.easeOut',
      onComplete: () => k.destroy(),
    });
  }
}
