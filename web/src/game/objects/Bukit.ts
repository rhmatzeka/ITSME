import Phaser from 'phaser';
import { DEPTH, TILE, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Bukit taman di utara desa, dalam tile: tanggulnya x 3-22, y 8-11. */
const BUKIT = { x0: 3, y0: 8, x1: 22, y1: 11 } as const;

const TINTA = '#3a2418';

/**
 * Isi bukit taman: dulu cuma rumput datar dengan beberapa benda yang
 * berjauhan — ember, jamur, orang-orangan sawah, batu, tugu — dan dua anak
 * ayam. Sekarang ia kebun bunga kecil tempat orang berpiknik:
 *
 * - rumpun bunga yang bergoyang pelan di sepanjang bukit;
 * - sarang lebah jerami di ujung timur, lebahnya terbang dari bunga ke bunga;
 * - tikar piknik dengan keranjang, dan anak anjing yang tidur di atasnya;
 * - layang-layang yang terbang tinggi, talinya terikat ke patok di bukit.
 *
 * Semuanya hiasan: tidak ada yang menghalangi langkah kecuali sarang lebah.
 */
export class Bukit {
  constructor(
    private scene: Phaser.Scene,
    private blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.rapikanLatar();
    this.buatTekstur();
    this.tanamBunga();
    this.gelarTikar();
    this.pasangSarang();
    this.terbangkanLayangan();
  }

  private px(tx: number) {
    return tx * TILE;
  }

  /* ---------------- rumput di bawah benda ---------------- */

  /**
   * Rumput bukit ini (#59c135) bukan lapisan dasar peta: ia tile 127 di
   * lapisan lantai, di atas rumput muda (#79bf56) lapisan dasar. Di petak
   * tempat ember, jamur, dan tugu berdiri, tile 127 itu tidak ada — benda
   * yang latarnya transparan itu ditaruh di lantai MENGGANTIKAN rumputnya,
   * atau di petak yang lantainya kosong. Hasilnya tiap benda duduk di kotak
   * hijau pucat seukuran satu tile.
   *
   * Petak dalam bukit yang tidak punya tile rumput itu di lantai maupun di
   * lapisan padat diberi satu tambalan rumput di antara lapisan dasar dan
   * lantai, jadi bendanya tetap tergambar di atasnya.
   */
  private rapikanLatar() {
    const peta = (this.scene as unknown as { tilemap?: Phaser.Tilemaps.Tilemap }).tilemap;
    if (!peta) return;
    const RUMPUT = 127; // gid tile rumput bukit
    const punya = (x: number, y: number) =>
      peta.layers.some((l) => (l.name === 'lantai' || l.name.startsWith('padat')) && l.data[y]?.[x]?.index === RUMPUT);
    const contoh = peta.getTileAt(4, 9, false, 'lantai');
    if (!contoh || contoh.index !== RUMPUT) return;
    const frame = this.frameAtlas(contoh);
    for (let y = BUKIT.y0 + 1; y <= BUKIT.y1 - 1; y++) {
      for (let x = BUKIT.x0 + 1; x <= BUKIT.x1 - 1; x++) {
        if (punya(x, y)) continue;
        this.scene.add
          .image(this.px(x) + TILE / 2, this.px(y) + TILE / 2, 'atlas', frame.name)
          .setDepth((DEPTH.ground + DEPTH.floor) / 2);
      }
    }
  }

  /** Frame atlas sebuah tile (didaftarkan dulu kalau belum ada). */
  private frameAtlas(t: Phaser.Tilemaps.Tile) {
    const ts = t.tileset!;
    const lokal = t.index - ts.firstgid;
    const nama = `t${lokal}`;
    const tex = this.scene.textures.get('atlas');
    if (!tex.has(nama)) {
      const langkah = TILE + ts.tileSpacing;
      tex.add(nama, 0, ts.tileMargin + (lokal % ts.columns) * langkah, ts.tileMargin + Math.floor(lokal / ts.columns) * langkah, TILE, TILE);
    }
    return tex.get(nama);
  }

  /* ---------------- tekstur ---------------- */

  private buatTekstur() {
    const s = this.scene;
    /*
     * Anak anjing yang tidur di tikar. Sempat berupa kucing oranye yang
     * meringkuk menyamping — dari jauh terbaca sebagai roti tawar. Wajah yang
     * menghadap depan (telinga terkulai, mata terpejam, moncong putih di atas
     * kaki depan) yang membuatnya langsung terbaca sebagai anjing.
     * Frame: 0 diam, 1 menarik napas (punggung naik), 2 ekor mengibas.
     */
    const anjing = [
      '...kkkkkk...........',
      '..kttttttk.kkkkkk...',
      '.kEttttttEktttttTkk.',
      'kEEt-tt-tEEttttttTk.',
      'kEEtwwwwtEEtttttttTk',
      '.kEwwnnwwEkttttttTTk',
      '..kwwwwwwktttttTTkTk',
      '.kwwkwwkwwkkttTTkTTk',
      '.kkkkkkkkkkkkkkkkkk.',
    ];
    const napas = [
      '...kkkkkk.kkkkkk....',
      '..kttttttkttttttkk..',
      '.kEttttttEktttttTTk.',
      'kEEt-tt-tEEttttttTk.',
      'kEEtwwwwtEEtttttttTk',
      '.kEwwnnwwEkttttttTTk',
      '..kwwwwwwktttttTTkTk',
      '.kwwkwwkwwkkttTTkTTk',
      '.kkkkkkkkkkkkkkkkkk.',
    ];
    const kibas = [...anjing];
    kibas[5] = '.kEwwnnwwEkttttttTTk';
    kibas[6] = '..kwwwwwwktttttTTk.k';
    kibas[7] = '.kwwkwwkwwkkttTTkTkk';
    spritesheetTeks(s, 'bukit_anjing', [anjing, napas, kibas], {
      k: TINTA,
      E: '#8a5a36',
      t: '#d9a066',
      T: '#b98049',
      w: '#fbf1dc',
      '-': TINTA,
      n: '#1f1410',
    });

    spritesheetTeks(
      s,
      'bukit_tikar',
      [
        [
          '..kkkkkkkkkkkkkkkkkkkkkkkkkk..',
          '.krrwwrrwwrrwwrrwwrrwwrrwwrrk.',
          '.krrwwrrwwrrwwrrwwrrwwrrwwrrk.',
          '.kwwrrwwrrwwrrwwrrwwrrwwrrwwk.',
          'kwwrrwwrrwwrrwwrrwwrrwwrrwwrrk',
          'krrwwrrwwrrwwrrwwrrwwrrwwrrwwk',
          'krrwwrrwwrrwwrrwwrrwwrrwwrrwwk',
          'kwwrrwwrrwwrrwwrrwwrrwwrrwwrrk',
          'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
        ],
      ],
      { k: '#6b2a22', r: '#d8453a', w: '#fbead0' }
    );

    spritesheetTeks(
      s,
      'bukit_keranjang',
      [
        [
          '...kkkk...',
          '..k....k..',
          '.k.aaA..k.',
          'kkaAaagkkk',
          'kbBbBbBbBk',
          'kBbBbBbBbk',
          'kbBbBbBbBk',
          '.kBBBBBBk.',
          '..kkkkkk..',
        ],
      ],
      { k: TINTA, a: '#e0473c', A: '#f7a08f', g: '#5aa53a', b: '#c99a57', B: '#96693a' }
    );

    // sarang lebah jerami bergaris di atas bangku kayu, madu menetes di pintunya
    spritesheetTeks(
      s,
      'bukit_sarang',
      [
        [
          '......kkkk......',
          '....kkyyyykk....',
          '...kyyyyyyyyk...',
          '...kYYsYYsYYk...',
          '..kyyyyyyyyyyk..',
          '..kYsYYsYYsYYk..',
          '.kyyyyyyyyyyyyk.',
          '.kYYsYYYsYYYsYk.',
          'kyyyyyykkyyyyyyk',
          'kYsYYYkddkYYYsYk',
          'kyyyyykddkyyyyyk',
          'kYYYYYkdhkYYYYYk',
          'kkkkkkkkhkkkkkkk',
          '.kbbbbbbbbbbbbk.',
          '.kBBBBBBBBBBBBk.',
          '..kbk......kbk..',
          '..kbk......kbk..',
          '..kkk......kkk..',
        ],
      ],
      { k: TINTA, y: '#f2c94c', Y: '#d8a52c', s: '#b07d24', d: '#2a1a10', h: '#f6a623', b: '#b98a4b', B: '#8f6634' }
    );

    // lebah: badan kuning bergaris, sayap putih yang mengepak
    spritesheetTeks(
      s,
      'bukit_lebah',
      [
        ['.ww...', '.wwk..', 'kykyk.', 'kykyke', '.kkkk.'],
        ['......', '..wwk.', 'kykykw', 'kykyke', '.kkkk.'],
      ],
      { w: '#f4fbff', y: '#f2c233', k: '#2a1a10', e: '#2a1a10' }
    );

    spritesheetTeks(
      s,
      'bukit_layangan',
      [
        [
          '.....k.....',
          '....krk....',
          '...krrrk...',
          '..krrcrrk..',
          '.kyyycyyyk.',
          'kcccccccccK',
          '.kyyycyyyk.',
          '..krrcrrk..',
          '...krrrk...',
          '....krk....',
          '.....k.....',
        ],
      ],
      { k: '#5a1e1a', K: '#5a1e1a', r: '#e2453a', y: '#f7d154', c: '#7a4a24' }
    );
    spritesheetTeks(s, 'bukit_pita', [['kk', 'bb'], ['bb', 'kk']], { k: '#e2453a', b: '#f7d154' });
    spritesheetTeks(s, 'bukit_patok', [['.k.', 'kbk', 'kbk', 'kbk', 'kkk']], { k: TINTA, b: '#96693a' });

    /*
     * Rumpun bunga: dua kuntum berkelopak empat di atas gerumbul daun, semua
     * bergaris tepi. Kelopaknya tiga nada (kilau, terang, bayangan) dan daunnya
     * tiga nada hijau — versi sebelumnya bunga setangkai-setangkai tanpa garis
     * tepi, dari jauh cuma titik-titik warna di rumput. Enam pilihan warna;
     * separuh rumpun dicerminkan supaya tidak ada dua yang persis sama.
     * Frame kedua menggeser kuntumnya satu piksel: goyang ditiup angin,
     * daunnya tetap di tanah.
     */
    const rumpun = [
      '..kkk.kkk.......',
      '.kPPPkPPPk......',
      '.kPWPPPPpk.kkk..',
      '..kPPYYPk.kPPPk.',
      '.kPPpYYppkkPWPPk',
      '.kPPpkkppkPPYpPk',
      '..kkk.kkkkkppppk',
      '...kLk....kkkkk.',
      '..kLlLk..kLk....',
      '.kLLlgLkkLlLk...',
      'kLLlglLLLlgLLk..',
      'kLllggkLLlggLLk.',
      '.kkggLLlllgggk..',
      '..kkkkkkkkkkkk..',
    ];
    const goyang = rumpun.map((r, i) => (i < 7 ? `.${r.slice(0, -1)}` : r));
    const warnaBunga = [
      { P: '#f37aa6', p: '#c9457a', W: '#ffd6e6', Y: '#ffd24a' },
      { P: '#ffd24a', p: '#d9962a', W: '#fff4b8', Y: '#b3561f' },
      { P: '#f4f1f8', p: '#c8bfd8', W: '#ffffff', Y: '#ffc93c' },
      { P: '#b98cf0', p: '#8457c4', W: '#e6d6ff', Y: '#ffe07a' },
      { P: '#ff6a5a', p: '#c63d34', W: '#ffc2b8', Y: '#ffe07a' },
      { P: '#7fb2ff', p: '#4a78d0', W: '#d8e8ff', Y: '#fff4b8' },
    ];
    warnaBunga.forEach((w, i) =>
      spritesheetTeks(s, `bukit_bunga_${i}`, [rumpun, goyang], {
        ...w,
        k: '#2a1a22',
        L: '#72c24c',
        l: '#4f9b3a',
        g: '#2f6e2a',
      })
    );
    spritesheetTeks(s, 'bukit_z', [['kkkkk', '...k.', '..k..', '.k...', 'kkkkk']], { k: '#f4fbff' });
  }

  /* ---------------- bunga ---------------- */

  /** Rumpun bunga: [tile x, tile y, geser x, geser y]. Tidak menutup tangga (x 7-9). */
  private static readonly BUNGA: [number, number, number, number][] = [
    [4, 9, 2, 2],
    [7, 9, 4, 0],
    [9, 10, 6, 4],
    [10, 9, 2, -1],
    [11, 10, 8, 3],
    [13, 9, 6, 0],
    [14, 10, 0, 4],
    [16, 9, 4, 1],
    [17, 10, 2, 3],
    [19, 10, 6, 2],
    [21, 9, 2, -1],
    [5, 10, 10, 4],
  ];
  /** Posisi bunga, px dunia — sasaran terbang lebah. */
  private bunga: { x: number; y: number }[] = [];

  private tanamBunga() {
    const s = this.scene;
    Bukit.BUNGA.forEach(([tx, ty, dx, dy], i) => {
      const x = this.px(tx) + dx + 5;
      /*
       * Pangkal rumpun di dasar petaknya. Rumpunnya 14 px — lebih tinggi
       * dari bunga setangkai yang dulu — jadi yang di baris 9 kuntumnya
       * menyembul ke baris tanggul dan tertutup olehnya kalau ditaruh lebih
       * tinggi. Diurutkan per garis pijak seperti benda lain: pemain yang
       * lewat di belakang rumpun tertutup kakinya, bukan menginjaknya.
       */
      const y = this.px(ty) + 15 + Math.min(dy, 0);
      const b = s.add
        .sprite(x, y, `bukit_bunga_${i % 6}`, 0)
        .setFlipX(i % 2 === 1)
        .setOrigin(0.5, 1)
        .setDepth(kedalaman(y));
      this.bunga.push({ x, y: y - 11 });
      // bergoyang ditiup angin, tiap rumpun pada ketukannya sendiri
      s.time.addEvent({
        delay: Phaser.Math.Between(700, 1100),
        loop: true,
        startAt: Phaser.Math.Between(0, 600),
        callback: () => b.setFrame(b.frame.name === '0' ? 1 : 0),
      });
    });
  }

  /* ---------------- piknik ---------------- */

  private gelarTikar() {
    const s = this.scene;
    const x = this.px(5) + 16;
    const y = this.px(9) + 10;
    s.add.image(x, y, 'bukit_tikar').setDepth(DEPTH.floor + 0.4);
    s.add
      .image(x + 10, y + 2, 'bukit_keranjang')
      .setOrigin(0.5, 1)
      .setDepth(kedalaman(y + 2));

    const anjing = s.add
      .sprite(x - 6, y + 4, 'bukit_anjing', 0)
      .setOrigin(0.5, 1)
      .setDepth(kedalaman(y + 4));
    // napas: naik-turun pelan; sesekali ekornya mengibas
    let napas = 0;
    s.time.addEvent({
      delay: 1100,
      loop: true,
      callback: () => {
        napas = 1 - napas;
        anjing.setFrame(napas);
        if (napas === 0 && Math.random() < 0.3) {
          anjing.setFrame(2);
          s.time.delayedCall(350, () => anjing.setFrame(0));
        }
      },
    });
    // dengkur: huruf z kecil melayang naik dari kepalanya
    s.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        const z = s.add
          .image(anjing.x - 7, anjing.y - 9, 'bukit_z')
          .setDepth(anjing.depth + 1)
          .setAlpha(0.95);
        s.tweens.add({
          targets: z,
          x: z.x - 5,
          y: z.y - 12,
          alpha: 0,
          duration: 1800,
          ease: 'Sine.easeOut',
          onComplete: () => z.destroy(),
        });
      },
    });
  }

  /* ---------------- lebah ---------------- */

  private pasangSarang() {
    const s = this.scene;
    const x = this.px(20) + 8;
    const y = this.px(10) + 1;
    s.add.image(x, y, 'bukit_sarang').setOrigin(0.5, 1).setDepth(kedalaman(y));
    if (this.blocked) {
      const r = s.add.rectangle(x, y - 3, 12, 6);
      s.physics.add.existing(r, true);
      this.blocked.add(r);
    }
    const pintu = { x, y: y - 9 };
    // lebah hanya ke bunga di separuh timur bukit, dekat sarangnya
    const dekat = this.bunga.filter((b) => Math.abs(b.x - x) < 110);
    for (let i = 0; i < 5; i++) this.lebah(pintu, dekat, i);
  }

  /**
   * Satu lebah: keluar dari sarang, terbang ke bunga, berputar-putar di atasnya
   * sebentar, lalu pindah ke bunga lain atau pulang. Jalannya digerakkan
   * pegas ke titik tujuan ditambah goyangan — lebah tidak pernah terbang lurus.
   */
  private lebah(pintu: { x: number; y: number }, bunga: { x: number; y: number }[], i: number) {
    const s = this.scene;
    const b = s.add.sprite(pintu.x, pintu.y, 'bukit_lebah', 0);
    const pos = { x: pintu.x, y: pintu.y, vx: 0, vy: 0 };
    let tujuan = pintu;
    let singgah = 0;
    let kepak = 0;
    let t = i * 1.7;
    const pilih = () => {
      tujuan = Math.random() < 0.2 || !bunga.length ? pintu : Phaser.Utils.Array.GetRandom(bunga);
      singgah = Phaser.Math.Between(1500, 3500);
    };
    pilih();
    const z = s.cameras.main.zoom;
    s.events.on('update', (_w: number, delta: number) => {
      const dt = Math.min(delta, 100) / 1000;
      t += dt;
      singgah -= delta;
      if (singgah <= 0) pilih();
      // berputar kecil di sekitar tujuan
      const sx = tujuan.x + Math.cos(t * 3.1 + i) * 5;
      const sy = tujuan.y - 4 + Math.sin(t * 4.3 + i) * 3;
      pos.vx += (sx - pos.x) * 6 * dt - pos.vx * 2.2 * dt;
      pos.vy += (sy - pos.y) * 6 * dt - pos.vy * 2.2 * dt;
      pos.x += pos.vx * dt * 6;
      pos.y += pos.vy * dt * 6;
      b.setPosition(Math.round(pos.x * z) / z, Math.round(pos.y * z) / z);
      b.setFlipX(pos.vx > 0);
      b.setDepth(kedalaman(pos.y + 10));
      kepak += delta;
      if (kepak > 60) {
        kepak = 0;
        b.setFrame(b.frame.name === '0' ? 1 : 0);
      }
    });
  }

  /* ---------------- layang-layang ---------------- */

  /**
   * Layang-layang yang terikat ke patok di bukit, terbang tinggi ke timur
   * laut. Posisinya melayang mengikuti angin (dua gelombang yang tidak
   * sefase, jadi tidak pernah terlihat berulang), dan talinya digambar
   * ulang tiap frame sebagai lengkung yang melendut.
   *
   * Digambar di bawah tirai malam supaya ikut gelap di malam hari, tapi di
   * atas atap dan pohon — ia ada di langit.
   */
  private terbangkanLayangan() {
    const s = this.scene;
    const patok = { x: this.px(15) + 8, y: this.px(9) + 12 };
    s.add.image(patok.x, patok.y, 'bukit_patok').setOrigin(0.5, 1).setDepth(kedalaman(patok.y));
    const depth = DEPTH.above + 30;
    const tali = s.add.graphics().setDepth(depth - 1);
    const layang = s.add.image(0, 0, 'bukit_layangan').setDepth(depth);
    const pita = [0, 1, 2, 3, 4].map((i) => s.add.sprite(0, 0, 'bukit_pita', i % 2).setDepth(depth - 0.5));
    const z = s.cameras.main.zoom;
    const kunci = (v: number) => Math.round(v * z) / z;
    let t = 0;
    const jejak: { x: number; y: number }[] = [];
    s.events.on('update', (_w: number, delta: number) => {
      t += Math.min(delta, 100) / 1000;
      const x = patok.x + 30 + Math.sin(t * 0.7) * 8 + Math.sin(t * 1.9) * 2;
      const y = patok.y - 70 + Math.cos(t * 0.9) * 5 + Math.sin(t * 2.3) * 1.5;
      layang.setPosition(kunci(x), kunci(y)).setAngle(Math.sin(t * 1.3) * 8);

      // ekor: seutas tali merah dengan simpul pita, tiap simpul mengikuti
      // posisi layang-layang beberapa saat lalu — jadi ekornya berkelok
      jejak.unshift({ x, y: y + 6 });
      if (jejak.length > 60) jejak.pop();
      const simpul = pita.map((p, i) => {
        const j = jejak[Math.min(jejak.length - 1, (i + 1) * 5)];
        const q = { x: j.x + Math.sin(t * 5 + i) * 1.2, y: j.y + (i + 1) * 3 };
        p.setPosition(kunci(q.x), kunci(q.y));
        if (Math.random() < 0.08) p.setFrame(p.frame.name === '0' ? 1 : 0);
        return q;
      });

      // tali melendut dari patok ke layang-layang
      const dari = { x: patok.x, y: patok.y - 4 };
      const ke = { x, y: y + 5 };
      const lendut = { x: (dari.x + ke.x) / 2 + 6, y: (dari.y + ke.y) / 2 + 10 };
      tali.clear().lineStyle(1 / z, 0xe2453a, 1).beginPath().moveTo(x, y + 5);
      for (const q of simpul) tali.lineTo(q.x, q.y);
      tali.strokePath().lineStyle(1 / z, 0xf4ecd8, 0.9);
      const lengkung = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(dari.x, dari.y),
        new Phaser.Math.Vector2(lendut.x, lendut.y),
        new Phaser.Math.Vector2(ke.x, ke.y)
      );
      lengkung.draw(tali, 24);
    });
  }
}
