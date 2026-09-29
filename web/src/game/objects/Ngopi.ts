import Phaser from 'phaser';
import { gumam, meong } from '../bunyi';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { F, FRAME_KUCING } from './Kucing';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatDuduk, buatRupa } from './Rupa';
import { UapKopi } from './UapKopi';
import { bisaDiajak } from './Warga';
import { sisiPemain } from './toleh';

/** Di atas sandaran bangku (layer `di atas map 1` = DEPTH.above), sama dengan Nongkrong. */
const DI_BANGKU = DEPTH.above + 2;

/**
 * Kucing putih belang oren: huruf lembar kucing (Kucing.ts) dengan palet
 * lain — o bulu putih, O bercak oren, D bayangan kelabu hangat, R oren tua,
 * n hidung. Bayangannya sengaja bukan hitam: bayangan hitam di bulu putih
 * terbaca sebagai bercak, dan kucingnya jadi terlihat kotor.
 */
const WARNA_PUTIH_OREN = { D: '#c9bdb0', O: '#ee9a45', R: '#c0692c', e: '#2a2320', g: '#8fcf5f', k: '#3b2630', o: '#f6f0e6', p: '#eea0a6', n: '#e07a86', w: '#ffffff' };

/** Tidur melingkar versi putih-oren: bentuknya sama dengan frame 0-1 Kucing.ts. */
const TIDUR_PUTIH: string[][] = [
  [
    '....................',
    '....................',
    '....................',
    '...........k...k....',
    '....kkkk..kpk.kpk...',
    '..kkOOOOk.koOkoook..',
    '.kOOROOOokoooooook..',
    'kOOROOooookooooook..',
    'kOOoooooookokkokkk..',
    'koooooooookkoonook..',
    'kooooooooookkoook...',
    'kDooooOOOOOOOOok....',
    '.kDDDORRRRRRROk.....',
    '..kkkkkkkkkkkkk.....',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....kkkk...k...k....',
    '..kkOOOO..kpk.kpk...',
    '.kOOROOOk.koOkoook..',
    'kOOROOOOokoooooook..',
    'kOOROOooookooooook..',
    'kOOoooooookokkokkk..',
    'koooooooookkoonook..',
    'kooooooooookkoook...',
    'kDooooOOOOOOOOok....',
    '.kDDDORRRRRRROk.....',
    '..kkkkkkkkkkkkk.....',
  ],
];

/** Jam pakde duduk ngopi di bangku, lewat tengah malam ditulis 24+. */
const JAM_NGOPI = [17, 23.5];

const EONG = ['Mrrp.', 'Meow?', '...', 'Prrrt!'];

type Keadaan = 'tidur' | 'duduk' | 'turun' | 'kolong' | 'lompat';

/**
 * Bangku di utara rumah CV — dulu kosong.
 *
 * Kucing putih belang oren tidur melingkar di ujung kanannya, siang dan malam.
 * Pemain yang mendekat membangunkannya: ia duduk, menatap, lalu melompat
 * turun dan menunggu di rumput sampai pemainnya pergi, baru naik lagi dan
 * tidur. Saat gerimis ia berteduh di kolong bangku.
 *
 * Menjelang magrib seorang pakde bersarung datang dan duduk di ujung kiri
 * dengan segelas kopi di sebelahnya. Kopinya mengepul, sesekali diseruput,
 * dan kepalanya menoleh ke pemain yang lewat.
 */
export class Ngopi {
  private pakde: Phaser.GameObjects.Sprite;
  private kopi: Phaser.GameObjects.Image;
  private genggam: Phaser.GameObjects.Image;
  private kucing: Phaser.GameObjects.Sprite;
  private bayangKucing: Phaser.GameObjects.Sprite;
  private keadaan: Keadaan = 'tidur';
  private sampai = 0;
  private hadir = 0;
  private seruput = 0;
  private menyeruput = false;
  private eong = 0;
  private readonly tempat: { x: number; y: number };
  private readonly rumput: { x: number; y: number };
  private readonly kolong: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    gelap: () => number,
    /** Jam desa (Suasana.jam) — pakde datang dan pulang menurut jam. */
    private jam: () => number,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    const { kiri, kanan, kaki } = LAPANGAN.bangku;
    this.buatTekstur();

    this.pakde = scene.add.sprite(kiri, kaki, 'pakde_duduk', 0).setOrigin(0.5, 1).setDepth(DI_BANGKU).setVisible(false);
    bisaDiajak(scene, this.pakde, 'Uncle', [
      'Evening coffee under the flags. Best seat in the village.',
      'That cat sleeps here more than I do. Do not wake her!',
    ]);
    // gelas di ujung kiri papan dudukan; saat diseruput pindah ke tangannya
    this.kopi = scene.add.image(kiri - 8, kaki + 1, 'kopi').setOrigin(0.5, 1).setDepth(DI_BANGKU + 1).setVisible(false);
    this.genggam = scene.add.image(kiri + 3, kaki - 7, 'kopi_genggam').setOrigin(0.5, 1).setDepth(DI_BANGKU + 1).setVisible(false);
    // kopi panas: uapnya naik dari gelas di bangku, atau dari gelas di tangannya
    new UapKopi(
      scene,
      () => {
        if (this.hadir < 0.5) return null;
        const g = this.menyeruput ? this.genggam : this.kopi;
        return { x: g.x, y: g.y - g.height + 1 };
      },
      gelap
    );

    this.tempat = { x: kanan, y: kaki + 2 };
    this.rumput = { x: kanan + 18, y: kaki + 15 };
    this.kolong = { x: kanan - 6, y: kaki + 6 };
    this.kucing = scene.add
      .sprite(this.tempat.x, this.tempat.y, 'kucing_belang', F.tidurA)
      .setOrigin(0.5, 1)
      .setFlipX(true)
      .setDepth(DI_BANGKU);
    this.bayangKucing = scene.add
      .sprite(0, 0, bayanganKaki(scene))
      .setScale(1.2, 1)
      .setAlpha(BAYANGAN_KAKI)
      .setVisible(false);
    this.kucing.play('kucing_belang_tidur');
    this.kucing.setInteractive({ useHandCursor: true });
    this.kucing.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', { msg: EONG[this.eong++ % EONG.length], siapa: this.kucing, nama: 'Cat' });
      meong(this.kucing.x, this.kucing.y - 4);
    });
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    // pakde: rambut hitam beruban, kaos oblong putih, sarung kotak hijau
    buatRupa(s, 'player', 'pakde', {
      kumis: '#6a6a72',
      tukar: {
        '#f79617': '#45454d',
        '#fb6b1d': '#2e2e34',
        '#f9c22b': '#8a8a94',
        '#fdcbb0': '#c68b5e',
        '#fca790': '#a46d45',
        '#e83b3b': '#ecebe4',
        '#ae2334': '#c4c1b6',
        '#ffffff': '#ecebe4',
        '#cd683d': '#2f6a4a',
        '#9e4539': '#1f4a32',
      },
    });
    buatDuduk(s, 'pakde', 'pakde_duduk', { toleh: 1, kulit: '#c68b5e', celana: ['#2f6a4a', '#1f4a32'] });
    // gelas kopi yang sama dengan bangku utara, kalau belum dibuat Nongkrong
    spritesheetTeks(s, 'kopi', [['kkkkk', 'kccck', 'kcsck', 'kIcIk', 'kIIIk', '.kkk.']], {
      I: '#d9d4c8',
      c: '#8a3a20',
      k: '#3a2418',
      s: '#3a2a22',
    });
    // gelas di tangan, diangkat ke mulut: jari-jarinya melingkar di bawah
    spritesheetTeks(s, 'kopi_genggam', [['kkkkk', 'kccck', 'kIcIk', 'kIIIk', 'hkkkh', '.hhh.']], {
      I: '#d9d4c8',
      c: '#8a3a20',
      k: '#3a2418',
      h: '#c68b5e',
    });
    spritesheetTeks(s, 'kucing_belang', [...TIDUR_PUTIH, ...FRAME_KUCING.slice(2)], WARNA_PUTIH_OREN);
    if (!s.anims.exists('kucing_belang_tidur')) {
      s.anims.create({
        key: 'kucing_belang_tidur',
        frames: s.anims.generateFrameNumbers('kucing_belang', { frames: [F.tidurA, F.tidurA, F.tidurB] }),
        frameRate: 1.2,
        repeat: -1,
      });
      s.anims.create({
        key: 'kucing_belang_jalan',
        frames: s.anims.generateFrameNumbers('kucing_belang', { frames: [F.jalanA, F.jalanB, F.jalanC, F.jalanD] }),
        frameRate: 9,
        repeat: -1,
      });
    }
  }

  private detak(t: number, delta: number) {
    this.aturPakde(t, delta);
    this.aturKucing(t, delta);
  }

  /* ---------------- pakde ---------------- */

  private aturPakde(t: number, delta: number) {
    /*
     * Datang jam lima sore dan pulang tidur jam setengah dua belas malam,
     * menurut jam desa — bukan menurut gelapnya langit. Waktu Senja di
     * Setelan (18.10) baru segelap 0,3; dengan patokan gelap ia hampir
     * tidak kelihatan tepat di jam yang paling cocok untuk ngopi. Gerimis
     * membuatnya pulang lebih cepat.
     */
    const j = this.jam();
    const h = j < 12 ? j + 24 : j;
    const tujuan = h >= JAM_NGOPI[0] && h < JAM_NGOPI[1] && cuaca.hujan < 0.3 ? 1 : 0;
    this.hadir = Phaser.Math.Clamp(this.hadir + Math.sign(tujuan - this.hadir) * (delta / 800), 0, 1);
    const ada = this.hadir > 0;
    this.pakde.setVisible(ada).setAlpha(this.hadir);
    if (this.pakde.input) this.pakde.input.enabled = this.hadir > 0.5;
    this.kopi.setVisible(ada && !this.menyeruput).setAlpha(this.hadir);
    this.genggam.setAlpha(this.hadir);
    if (!ada) return;

    // menoleh ke pemain yang lewat dekat, kalau tidak sedang menyeruput
    if (!this.menyeruput) {
      const sisi = sisiPemain(this.pakde.x, this.pakde.y);
      this.pakde.setFrame(sisi ? 1 : 0).setFlipX(sisi < 0);
    }

    if (t > this.seruput && !this.menyeruput && this.hadir > 0.9) {
      this.seruput = t + Phaser.Math.Between(7000, 13000);
      this.minum();
    }
  }

  /** Angkat gelas ke mulut, tahan sebentar, taruh lagi — "sruput". */
  private minum() {
    this.menyeruput = true;
    this.pakde.setFrame(0).setFlipX(false);
    this.kopi.setVisible(false);
    this.genggam.setVisible(true);
    this.scene.time.delayedCall(1300, () => {
      this.genggam.setVisible(false);
      this.menyeruput = false;
      // "ahh": gumam puas yang pendek
      if (this.hadir > 0.9) gumam(this.pakde.x, this.pakde.y - 10, 'bapak', 1, 0.5);
    });
  }

  /* ---------------- kucing ---------------- */

  private aturKucing(t: number, delta: number) {
    const k = this.kucing;
    if (this.keadaan === 'lompat') return;
    const p = this.pemain();
    const kaki = p ? { x: p.x, y: p.y + 15 } : undefined;
    const jarak = kaki ? Phaser.Math.Distance.Between(kaki.x, kaki.y, k.x, k.y) : 999;
    const hujan = cuaca.hujan > 0.25;

    if (hujan && this.keadaan !== 'kolong') {
      this.berjalanKe(this.kolong, 'kolong', delta);
      return;
    }
    if (!hujan && this.keadaan === 'kolong') {
      this.berjalanKe(this.rumput, 'turun', delta);
      return;
    }

    if (this.keadaan === 'tidur') {
      if (jarak < 30) {
        this.keadaan = 'duduk';
        k.anims.stop();
        k.setFrame(F.duduk);
        this.sampai = t + 900;
      }
      return;
    }
    if (this.keadaan === 'duduk') {
      if (kaki) k.setFlipX(kaki.x < k.x);
      if (t < this.sampai) return;
      // masih didekati: melompat turun ke rumput sebelah kanan bangku
      if (jarak < 30) this.lompat(this.rumput, 'turun');
      else {
        this.keadaan = 'tidur';
        k.setFlipX(true).play('kucing_belang_tidur');
      }
      return;
    }
    if (this.keadaan === 'turun') {
      if (k.x !== this.rumput.x || k.y !== this.rumput.y) {
        this.berjalanKe(this.rumput, 'turun', delta);
        return;
      }
      if (kaki && jarak < 70) {
        k.setFlipX(kaki.x < k.x);
        this.sampai = t + 6000;
        return;
      }
      // pemainnya sudah pergi cukup lama: naik lagi ke bangku lalu tidur
      if (t > this.sampai) this.lompat(this.tempat, 'tidur');
    }
  }

  /** Jalan kaki ke `tujuan`; sesampainya di sana berganti keadaan. */
  private berjalanKe(tujuan: { x: number; y: number }, jadi: Keadaan, delta: number) {
    const k = this.kucing;
    // yang masih di atas bangku turun dulu
    if (k.depth === DI_BANGKU) {
      this.lompat(this.rumput, 'turun');
      return;
    }
    const dx = tujuan.x - k.x;
    const dy = tujuan.y - k.y;
    const jarak = Math.hypot(dx, dy);
    if (jarak < 1) {
      k.setPosition(tujuan.x, tujuan.y);
      this.keadaan = jadi;
      k.anims.stop();
      k.setFrame(jadi === 'kolong' ? F.tidurA : F.duduk);
      if (jadi === 'kolong') k.play('kucing_belang_tidur');
      this.sampai = this.scene.time.now + 6000;
      this.ikut();
      return;
    }
    const langkah = Math.min(jarak, (26 * delta) / 1000);
    k.x += (dx / jarak) * langkah;
    k.y += (dy / jarak) * langkah;
    if (Math.abs(dx) > 0.5) k.setFlipX(dx < 0);
    if (k.anims.currentAnim?.key !== 'kucing_belang_jalan') k.play('kucing_belang_jalan');
    this.ikut();
  }

  /** Lompat melengkung ke `tujuan` — naik ke bangku atau turun darinya. */
  private lompat(tujuan: { x: number; y: number }, jadi: Keadaan) {
    const k = this.kucing;
    this.keadaan = 'lompat';
    const naik = tujuan === this.tempat;
    k.anims.stop();
    k.setFrame(F.lompat).setFlipX(tujuan.x < k.x);
    const dari = { x: k.x, y: k.y };
    const p = { t: 0 };
    // yang naik digambar di atas sandaran sejak lepas landas; yang turun baru setelah mendarat
    if (naik) k.setDepth(DI_BANGKU);
    this.scene.tweens.add({
      targets: p,
      t: 1,
      duration: 380,
      onUpdate: () => {
        k.setPosition(dari.x + (tujuan.x - dari.x) * p.t, dari.y + (tujuan.y - dari.y) * p.t - Math.sin(p.t * Math.PI) * 9);
      },
      onComplete: () => {
        k.setPosition(tujuan.x, tujuan.y);
        this.keadaan = jadi;
        this.sampai = this.scene.time.now + 6000;
        if (jadi === 'tidur') k.setFlipX(true).play('kucing_belang_tidur');
        else k.setFrame(F.duduk);
        if (!naik) this.ikut();
        else this.bayangKucing.setVisible(false);
      },
    });
  }

  /** Di tanah: urutan gambar ikut garis pijak, bayangan menempel di bawahnya. */
  private ikut() {
    const k = this.kucing;
    k.setDepth(kedalaman(k.y));
    this.bayangKucing.setVisible(true).setPosition(k.x, k.y - 1).setDepth(k.depth - 0.5);
  }
}
