import Phaser from 'phaser';
import { gumam, meong } from '../bunyi';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { F, FRAME_KUCING } from './Kucing';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatDuduk, buatRupa } from './Rupa';
import { bisaDiajak } from './Warga';

/** Di atas sandaran bangku (layer `di atas map 1` = DEPTH.above), sama dengan Nongkrong. */
const DI_BANGKU = DEPTH.above + 2;

/** Kucing belang tiga: putih, belang hitam, bercak jingga. */
const WARNA_BELANG_TIGA = { D: '#d9782a', O: '#3a3434', e: '#2a2320', g: '#e0b030', k: '#2a2220', o: '#f4efe6', p: '#f29ba0', w: '#ffffff' };

const EONG = ['Mrrp.', 'Meow?', '...', 'Prrrt!'];

type Keadaan = 'tidur' | 'duduk' | 'turun' | 'kolong' | 'lompat';

/**
 * Bangku di utara rumah CV — dulu kosong.
 *
 * Kucing belang tiga tidur melingkar di ujung kanannya, siang dan malam.
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
  private asap: Phaser.GameObjects.Rectangle[] = [];
  private jedaAsap = 0;
  private eong = 0;
  private readonly tempat: { x: number; y: number };
  private readonly rumput: { x: number; y: number };
  private readonly kolong: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
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
    for (let i = 0; i < 5; i++) this.asap.push(scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.6).setDepth(DI_BANGKU + 2).setVisible(false));

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
    spritesheetTeks(s, 'kucing_belang', FRAME_KUCING, WARNA_BELANG_TIGA);
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
    // datang menjelang magrib, pulang saat subuh — atau saat gerimis
    this.hadir = Phaser.Math.Clamp((this.gelap() - 0.3) / 0.2, 0, 1) * (1 - Phaser.Math.Clamp(cuaca.hujan * 2, 0, 1));
    const ada = this.hadir > 0;
    this.pakde.setVisible(ada).setAlpha(this.hadir);
    if (this.pakde.input) this.pakde.input.enabled = this.hadir > 0.5;
    this.kopi.setVisible(ada && !this.menyeruput).setAlpha(this.hadir);
    this.genggam.setAlpha(this.hadir);
    if (!ada) {
      for (const a of this.asap) a.setVisible(false);
      return;
    }

    // menoleh ke pemain yang lewat dekat, kalau tidak sedang menyeruput
    if (!this.menyeruput) {
      const p = this.pemain();
      const dekat = p && Math.abs(p.x - this.pakde.x) < 44 && Math.abs(p.y + 15 - this.pakde.y) < 30;
      if (dekat && p) this.pakde.setFrame(1).setFlipX(p.x < this.pakde.x - 2);
      else this.pakde.setFrame(0).setFlipX(false);
    }

    if (t > this.seruput && !this.menyeruput && this.hadir > 0.9) {
      this.seruput = t + Phaser.Math.Between(7000, 13000);
      this.minum();
    }

    // kepulan: satu piksel putih naik dari gelas, beberapa sekaligus
    if ((this.jedaAsap -= delta) <= 0) {
      this.jedaAsap = 420;
      const a = this.asap.find((r) => !r.visible);
      const gelas = this.menyeruput ? this.genggam : this.kopi;
      if (a) {
        a.setPosition(gelas.x + Phaser.Math.Between(-1, 1), gelas.y - gelas.height).setVisible(true).setAlpha(0.55 * this.hadir);
        this.scene.tweens.add({
          targets: a,
          y: a.y - Phaser.Math.Between(6, 10),
          x: a.x + Phaser.Math.Between(-2, 2),
          alpha: 0,
          duration: 1600,
          ease: 'Sine.easeOut',
          onComplete: () => a.setVisible(false),
        });
      }
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
