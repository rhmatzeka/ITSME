import Phaser from 'phaser';
import { cebur, klik, kertas } from '../bunyi';
import { DEPTH, MANCING, PLAYER, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { GAMBAR_MANCING } from './MancingGambar';
import { buatPoseDorong } from './NasiGoreng';
import { Penunjuk } from './Penunjuk';
import type { Player } from './Player';
import { TUKAR_RAHMAT } from './Rupa';
import { spritesheetTeks } from './piksel';

/**
 * Isi catatan ikan, urut dari yang paling sering didapat. `tekstur` +
 * `frame`: gambar tangkapannya — ikan sungai memakai lembar Ikan.ts (frame 2
 * = tampak samping mendatar), lele dan sepatu bot digambar sendiri.
 */
export const TANGKAPAN = [
  { id: 'wader', nama: 'Wader', ket: 'A tiny silver river fish. They swim in schools.', bobot: 30, tekstur: 'ikan_wader', frame: 2 },
  { id: 'nila', nama: 'Tilapia', ket: 'Grey-green with a spiny back. Great fried with sambal.', bobot: 24, tekstur: 'ikan_nila', frame: 2 },
  { id: 'mas', nama: 'Goldfish', ket: 'A golden carp, the kind farmers raise in rice-field ponds.', bobot: 18, tekstur: 'ikan_mas', frame: 2 },
  { id: 'koi', nama: 'Koi', ket: 'An orange koi. Someone upstream must have a pond.', bobot: 12, tekstur: 'ikan_koi', frame: 2 },
  { id: 'kohaku', nama: 'Kohaku', ket: 'A white koi with red patches. Rare and very pretty.', bobot: 7, tekstur: 'ikan_kohaku', frame: 2 },
  { id: 'lele', nama: 'Catfish', ket: 'Whiskers! Catfish bite more often at night.', bobot: 5, tekstur: 'ikan_lele', frame: 0 },
  { id: 'sepatu', nama: 'Old boot', ket: 'Not a fish. Somebody lost a rain boot in the river.', bobot: 4, tekstur: 'sepatu_bot', frame: 0 },
] as const;

const KUNCI = 'mapporto:ikan';

/** Catatan tangkapan pengunjung: id → jumlah. Disimpan di browser. */
export function bacaCatatan(): Record<string, number> {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI) ?? '{}');
    return x && typeof x === 'object' ? x : {};
  } catch {
    return {};
  }
}

function simpanCatatan(c: Record<string, number>) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(c));
  } catch {
    /* tetap berlaku untuk kunjungan ini */
  }
}

/** Lama pelampung tenggelam sebelum ikannya lepas, ms. */
const SAMBAR = 1100;

type Keadaan = 'diam' | 'lempar' | 'tunggu' | 'sambar' | 'tarik';

/**
 * Mancing di dermaga kecil di sungai barat, sebelah rumah About.
 *
 * Berjalan ke lingkaran kuning di pangkal dermaga = Rahmat melangkah ke
 * ujung dermaga, memegang joran, dan melempar kailnya. Pelampung merah-putih
 * terapung dan sesekali bergetar dicolek ikan; begitu ia tenggelam dan tanda
 * "!" muncul, klik / ketuk di mana saja (atau tekan Spasi) untuk menarik.
 * Telat sedikit, ikannya lepas. Tangkapan melompat keluar dari air, tampil
 * sebentar di atas kepala, lalu masuk ember — dan tercatat di catatan ikan
 * (ketuk embernya untuk melihatnya). Bergerak ke mana pun = berhenti mancing.
 *
 * Malam hari lele lebih sering menyambar; gerimis membuat ikan lebih lapar.
 */
export class Mancing {
  private keadaan: Keadaan = 'diam';
  private sampai = 0;
  private penunjuk: Penunjuk;
  private joranDiam: Phaser.GameObjects.Image;
  private ember: Phaser.GameObjects.Image;
  private tali: Phaser.GameObjects.Graphics;
  private pelampung: Phaser.GameObjects.Sprite;
  private seru: Phaser.GameObjects.Text;
  private diPetak = false;
  private kenalan = false;
  /** Titik pelampung di air dan ujung joran, px dunia. */
  private apung = { x: 0, y: 0 };
  private ujung = { x: 0, y: 0 };

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Player | undefined,
    private gelap: () => number
  ) {
    for (const [nama, g] of Object.entries(GAMBAR_MANCING)) spritesheetTeks(scene, nama, g.frame, g.palet);
    // pose memegang joran: berdiri menghadap kanan, kedua tangan menjulur ke depan
    // (dicerminkan saat menghadap kiri ke sungai)
    buatPoseDorong(
      scene,
      'rahmat',
      'rahmat_joran',
      [TUKAR_RAHMAT['#fdcbb0'], TUKAR_RAHMAT['#fca790']],
      [TUKAR_RAHMAT['#e83b3b'], TUKAR_RAHMAT['#ae2334']],
      8
    );

    const { dermaga, joran, ember, pangkal } = MANCING;
    scene.add.image(dermaga.x, dermaga.y, 'dermaga').setOrigin(0).setDepth(DEPTH.below + 1);
    this.joranDiam = scene.add.image(joran.x, joran.kaki + 1, 'joran').setOrigin(0.5, 1).setDepth(kedalaman(joran.kaki));
    this.ember = scene.add.image(ember.x, ember.kaki + 1, 'ember_ikan', 0).setOrigin(0.5, 1).setDepth(kedalaman(ember.kaki));
    this.penunjuk = new Penunjuk(scene, pangkal.x, pangkal.y);
    this.tali = scene.add.graphics().setDepth(kedalaman(MANCING.berdiri.kaki) + 1);
    this.pelampung = scene.add.sprite(0, 0, 'pelampung', 0).setDepth(DEPTH.below + 2).setVisible(false);
    this.seru = scene.add
      .text(0, 0, '!', { fontFamily: '"Pixelify Sans", monospace', fontSize: '16px', color: '#ffd23f', stroke: '#2a1c14', strokeThickness: 4, resolution: 4 })
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setDepth(DEPTH.above + 70)
      .setVisible(false);

    if (bacaCatatan() && Object.keys(bacaCatatan()).length) this.ember.setFrame(1);
    for (const o of [this.joranDiam, this.ember]) o.setInteractive({ useHandCursor: true });
    this.joranDiam.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.ajak();
    });
    this.ember.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.bukaCatatan();
    });
    scene.input.keyboard?.on('keydown-SPACE', () => this.tarik());
    scene.events.on('update', this.detak, this);
  }

  /** Sedang memegang joran (lempar, menunggu, atau disambar). */
  get sedang() {
    return this.keadaan !== 'diam';
  }

  /** Joran diklik dari jauh: beri tahu caranya. */
  private ajak() {
    const p = this.pemain();
    const { pangkal } = MANCING;
    if (p && Phaser.Math.Distance.Between(p.x, p.y, pangkal.x, pangkal.y) < 40) {
      this.mulai(p);
      return;
    }
    this.scene.game.events.emit('mapporto:ucap', {
      msg: 'Gone fishing? Walk onto the yellow circle at the end of the jetty to pick up the rod.',
      siapa: this.joranDiam,
      nama: 'Fishing rod',
    });
  }

  private mulai(p: Player) {
    if (this.sedang) return;
    const { berdiri, pangkal } = MANCING;
    // berdiri di ujung dermaga menghadap sungai; bergerak = kembali ke pangkal
    p.duduk(berdiri.x, berdiri.kaki - PLAYER.baseY, 'rahmat_joran_pegang', { x: pangkal.x, y: pangkal.y });
    p.setFlipX(true);
    this.scene.events.emit('teras:duduk');
    this.joranDiam.setVisible(false);
    this.keadaan = 'lempar';
    this.lempar();
    if (!this.kenalan) {
      this.kenalan = true;
      this.ucap('Wait for the float to sink, then click, tap or press Space to reel it in!');
    }
  }

  private berhenti() {
    this.keadaan = 'diam';
    this.tali.clear();
    this.pelampung.setVisible(false);
    this.seru.setVisible(false);
    this.joranDiam.setVisible(true);
    this.pemain()?.setFlipX(false);
  }

  private lempar() {
    const { air } = MANCING;
    this.apung = { x: air.x + Phaser.Math.Between(-3, 3), y: air.y + Phaser.Math.Between(-6, 6) };
    this.keadaan = 'lempar';
    const awal = { ...this.ujung };
    const o = { t: 0 };
    this.pelampung.setVisible(true).setFrame(0);
    klik(this.apung.x, this.apung.y);
    this.scene.tweens.add({
      targets: o,
      t: 1,
      duration: 420,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        // melengkung dari ujung joran ke air
        const x = Phaser.Math.Linear(awal.x, this.apung.x, o.t);
        const y = Phaser.Math.Linear(awal.y, this.apung.y, o.t) - Math.sin(o.t * Math.PI) * 10;
        this.pelampung.setPosition(x, y);
      },
      onComplete: () => {
        cebur(this.apung.x, this.apung.y, true);
        this.riak();
        this.keadaan = 'tunggu';
        // gerimis: ikan lebih lapar
        const lapar = cuaca.hujan > 0.3 ? 0.6 : 1;
        this.sampai = this.scene.time.now + Phaser.Math.Between(2500, 8000) * lapar;
      },
    });
  }

  /** Ikan menyambar: klik / ketuk / Spasi selama pelampungnya tenggelam. */
  tarik() {
    if (this.keadaan === 'sambar') {
      this.keadaan = 'tarik';
      this.seru.setVisible(false);
      this.dapat();
      return true;
    }
    // menarik sebelum ada yang menyambar: kail diangkat dan dilempar lagi
    if (this.keadaan === 'tunggu') {
      this.lempar();
      return true;
    }
    return this.keadaan !== 'diam';
  }

  private pilih() {
    const malam = this.gelap() > 0.6;
    const daftar = TANGKAPAN.map((j) => ({ j, b: j.id === 'lele' && malam ? j.bobot * 4 : j.bobot }));
    let r = Math.random() * daftar.reduce((a, d) => a + d.b, 0);
    for (const d of daftar) if ((r -= d.b) < 0) return d.j;
    return TANGKAPAN[0];
  }

  private dapat() {
    const j = this.pilih();
    const p = this.pemain();
    cebur(this.apung.x, this.apung.y);
    this.riak();
    const tekstur = this.scene.textures.exists(j.tekstur) ? j.tekstur : 'ikan_lele';
    const ikan = this.scene.add.sprite(this.apung.x, this.apung.y, tekstur, j.frame).setDepth(DEPTH.above + 40);
    this.pelampung.setVisible(false);
    const atas = p ? { x: p.x, y: p.y - 22 } : { x: this.apung.x, y: this.apung.y - 30 };
    // melompat keluar dari air ke atas kepala Rahmat, menggelepar sebentar
    this.scene.tweens.add({
      targets: ikan,
      x: atas.x,
      duration: 520,
      ease: 'Sine.easeOut',
    });
    this.scene.tweens.add({
      targets: ikan,
      y: { value: atas.y, ease: 'Back.easeOut' },
      duration: 520,
      onComplete: () => {
        this.scene.tweens.add({ targets: ikan, angle: { from: -12, to: 12 }, duration: 120, yoyo: true, repeat: 5 });
        const c = bacaCatatan();
        const baru = !c[j.id];
        c[j.id] = (c[j.id] ?? 0) + 1;
        simpanCatatan(c);
        const jenis = Object.keys(c).filter((k) => c[k] > 0).length;
        this.ucap(
          j.id === 'sepatu'
            ? `Ugh, an old boot! (${jenis}/${TANGKAPAN.length} in your fish log)`
            : `${baru ? 'New! ' : ''}You caught a ${j.nama}! (${jenis}/${TANGKAPAN.length} in your fish log)`
        );
        this.scene.game.events.emit('mapporto:jejak', 'ikan');
        this.scene.time.delayedCall(1700, () => {
          // masuk ember
          this.scene.tweens.add({
            targets: ikan,
            x: this.ember.x,
            y: this.ember.y - 8,
            scale: 0.6,
            duration: 380,
            ease: 'Quad.easeIn',
            onComplete: () => {
              ikan.destroy();
              this.ember.setFrame(1);
              kertas(this.ember.x, this.ember.y);
              if (this.keadaan === 'tarik') this.lempar();
            },
          });
        });
      },
    });
  }

  private ucap(msg: string) {
    const p = this.pemain();
    if (p) this.scene.game.events.emit('mapporto:ucap', { msg, siapa: p, nama: 'Rahmat' });
  }

  /** Riak melingkar di sekitar pelampung. */
  private riak() {
    const r = this.scene.add.ellipse(this.apung.x, this.apung.y + 2, 6, 2).setStrokeStyle(1, 0xdff4ff, 0.9).setDepth(DEPTH.below + 1.5);
    this.scene.tweens.add({ targets: r, scaleX: 3, scaleY: 3, alpha: 0, duration: 900, onComplete: () => r.destroy() });
  }

  /** Catatan ikan: kirim ke halaman (Desa.astro) beserta gambar tiap jenis. */
  private bukaCatatan() {
    const c = bacaCatatan();
    const daftar = TANGKAPAN.map((j) => {
      let gambar = '';
      try {
        if (c[j.id] && this.scene.textures.exists(j.tekstur)) gambar = this.scene.textures.getBase64(j.tekstur, j.frame);
      } catch {
        /* tanpa gambar pun tetap bisa dibaca */
      }
      return { id: j.id, nama: j.nama, ket: j.ket, jumlah: c[j.id] ?? 0, gambar };
    });
    this.scene.game.events.emit('mapporto:catatan-ikan', daftar);
  }

  private detak(t: number) {
    const p = this.pemain();
    if (!p) return;
    const { pangkal, berdiri } = MANCING;
    // ujung joran: dari tangan (pose menjulur, dicerminkan ke kiri) naik serong ke sungai
    this.ujung = { x: berdiri.x - 20, y: berdiri.kaki - 30 };
    if (this.sedang && !p.sedangKerja) this.berhenti();

    const jarak = Phaser.Math.Distance.Between(p.x, p.y, pangkal.x, pangkal.y);
    this.penunjuk.atur(this.sedang ? 0 : jarak < 14 ? 0.35 : 1);
    if (!this.sedang) {
      const masuk = jarak < 7;
      if (masuk && !this.diPetak) this.mulai(p);
      this.diPetak = masuk || (this.diPetak && jarak < 16);
      return;
    }
    this.diPetak = true;

    if (this.keadaan === 'tunggu') {
      // terapung naik-turun; sesekali dicolek ikan
      const colek = Math.sin(t / 90) > 0.97 && Math.random() < 0.3;
      this.pelampung.setPosition(this.apung.x, this.apung.y + (Math.floor(t / 600) % 2) + (colek ? 1 : 0));
      if (t > this.sampai) {
        this.keadaan = 'sambar';
        this.sampai = t + SAMBAR;
        this.pelampung.setFrame(1);
        cebur(this.apung.x, this.apung.y, true);
        this.riak();
        this.seru.setPosition(p.x - 2, p.y - 18).setVisible(true);
      }
    } else if (this.keadaan === 'sambar') {
      // tenggelam: cuma ujung putihnya yang menyembul
      this.pelampung.setPosition(this.apung.x, this.apung.y + 3);
      this.seru.setY(p.y - 18 - (Math.floor(t / 120) % 2));
      if (t > this.sampai) {
        this.seru.setVisible(false);
        this.ucap(Phaser.Utils.Array.GetRandom(['It got away...', 'Too slow! The bait is gone.', 'So close!']));
        this.lempar();
      }
    }

    // senar: dari ujung joran ke pelampung, melendut saat santai, tegang saat disambar
    const g = this.tali;
    g.clear();
    const tangan = { x: berdiri.x - 6, y: berdiri.kaki - 6 };
    g.lineStyle(1, 0x8a5a2a, 1).lineBetween(tangan.x, tangan.y, this.ujung.x, this.ujung.y);
    g.lineStyle(1, 0xc8a050, 1).lineBetween(tangan.x, tangan.y - 1, this.ujung.x + 1, this.ujung.y);
    if (this.pelampung.visible) {
      const ke = { x: this.pelampung.x, y: this.pelampung.y - 2 };
      const lendut = this.keadaan === 'tunggu' ? 4 : 0;
      const tengah = { x: (this.ujung.x + ke.x) / 2, y: (this.ujung.y + ke.y) / 2 + lendut };
      g.lineStyle(1, 0xf4f1ea, 0.7);
      const kurva = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(this.ujung.x, this.ujung.y),
        new Phaser.Math.Vector2(tengah.x, tengah.y),
        new Phaser.Math.Vector2(ke.x, ke.y)
      );
      kurva.draw(g, 12);
    }
  }
}
