import Phaser from 'phaser';
import { gumam, klakson, kring, mesin } from '../bunyi';
import { DEPTH, JALAN, kedalaman } from '../config';
import { cuaca } from '../cuaca';
import { GAMBAR_KENDARAAN } from './KendaraanGambar';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';

type Jenis = 'motor' | 'sayur' | 'becak';
type Titik = { x: number; y: number };

/** Kecepatan tiap jenis, px/detik. Pemain berjalan 74. */
const LAJU: Record<Jenis, number> = { motor: 52, sayur: 38, becak: 21 };

/**
 * Motor bebek ada empat: bodi merah, biru, hitam, dan putih, masing-masing
 * dikendarai warga yang berbeda (gambar motor_*_0..3), jadi yang lewat
 * tidak selalu motor dan orang yang sama.
 */
const VARIAN_MOTOR = 4;

/** Yang diucapkan saat diketuk, per jenis. */
const UCAP: Record<Jenis, [string, string[]]> = {
  motor: [
    'Rider',
    [
      'Excuse me, coming through! Just heading to the market.',
      'Mind the road! This is the busiest street in the village, believe it or not.',
    ],
  ],
  sayur: [
    'Vegetable seller',
    [
      'Sayur, sayuuur! Fresh spinach, carrots, chillies — straight from the farm south of the river.',
      'Rahmat buys his chillies from me. He likes everything extra spicy.',
    ],
  ],
  becak: [
    'Becak driver',
    [
      'Becak! Need a ride? I pedal this thing up and down the village all day.',
      'My passenger is going to the market. Rahmat? He prefers walking around here.',
    ],
  ],
};

/** Sesuatu di jalan yang membuat kendaraan berhenti: titik pijaknya. */
export type Halangan = () => Titik[];

/**
 * Kendaraan yang sesekali lewat di jalan desa: motor bebek, motor tukang
 * sayur berkeranjang, dan becak. Satu per satu, tidak berbarengan — desanya
 * desa kecil, bukan jalan raya.
 *
 * Rutenya satu putaran lewat dua jalan tanah dan penghubung tegaknya: masuk
 * dari jembatan barat di jalan tengah, ke timur sampai pertigaan, naik ke
 * jalan atas, lalu kembali ke barat dan keluar lewat jembatan atas — atau
 * kebalikannya. Tukang sayur masuk dari jalan atas dan mangkal dulu di
 * dekat rumah Projects sambil berteriak "sayuuur!", lalu memutar balik.
 *
 * Kalau ada orang di depannya (pemain, kurir, gerobak nasi goreng), ia
 * berhenti dan membunyikan klakson (becak: belnya), lalu jalan lagi setelah
 * jalannya kosong. Malam hari cuma motor yang lewat, lampu depannya menyala.
 */
export class Kendaraan {
  private s: Phaser.GameObjects.Sprite;
  private bayang: Phaser.GameObjects.Image;
  private sorot: Phaser.GameObjects.Image;
  private genangan: Phaser.GameObjects.Image;
  private jenis: Jenis = 'motor';
  private rute: (Titik & { singgah?: number })[] = [];
  private ke = 0;
  private x = 0;
  private y = 0;
  private arah: Titik = { x: 1, y: 0 };
  /** 'kosong' = menunggu di luar peta sampai `lagi`. */
  private keadaan: 'kosong' | 'jalan' | 'singgah' = 'kosong';
  private lagi = 0;
  private singgahSampai = 0;
  private terhalangSejak = -1;
  private klaksonLagi = 0;
  private mesinLagi = 0;
  private teriakLagi = 0;
  private bodi = 0;
  /** Jalan sedang dipakai (pasar Jumat): tidak ada yang berangkat. */
  libur: () => boolean = () => false;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private halangan: Halangan
  ) {
    this.buatTekstur();
    this.s = scene.add.sprite(0, 0, 'motor_samping_0', 0).setOrigin(0.5, 1).setVisible(false);
    this.bayang = scene.add.image(0, 0, bayanganKaki(scene)).setAlpha(BAYANGAN_KAKI).setVisible(false);
    this.sorot = scene.add
      .image(0, 0, 'sorot_motor')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.above + 61)
      .setVisible(false);
    this.genangan = scene.add
      .image(0, 0, scene.textures.exists('lampu_genangan') ? 'lampu_genangan' : 'sorot_motor')
      .setScale(0.16)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.above + 60)
      .setVisible(false);
    // ucapannya ikut jenis yang sedang lewat: satu sprite dipakai bergantian
    let ke = 0;
    this.s.setInteractive({ useHandCursor: true });
    this.s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      const [nama, kalimat] = UCAP[this.jenis];
      const msg = kalimat[ke++ % kalimat.length];
      scene.game.events.emit('mapporto:ucap', { msg, siapa: this.s, nama });
      scene.game.events.emit('mapporto:jejak', 'warga');
      gumam(this.s.x, this.s.y - 20, 'bapak', 4);
    });
    this.lagi = scene.time.now + Phaser.Math.Between(6000, 14000);
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    for (const [nama, g] of Object.entries(GAMBAR_KENDARAAN)) {
      // motor sudah bernomor varian; sayur dan becak cuma satu (_0)
      spritesheetTeks(this.scene, /_\d$/.test(nama) ? nama : `${nama}_0`, g.frame, g.palet);
    }
    if (!tx.exists('sorot_motor')) {
      const k = tx.createCanvas('sorot_motor', 48, 48)!;
      const ctx = k.getContext();
      const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, 'rgba(255,246,210,0.95)');
      g.addColorStop(0.25, 'rgba(255,236,170,0.45)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 48, 48);
      k.refresh();
    }
  }

  /** Untuk dites dari konsol: `__game.scene.getScene('World').kendaraan.datang('becak')`. */
  datang(jenis?: Jenis, balik = Math.random() < 0.5) {
    const malam = this.gelap() > 0.6;
    this.jenis = jenis ?? (malam ? 'motor' : Phaser.Utils.Array.GetRandom<Jenis>(['motor', 'motor', 'sayur', 'becak']));
    this.bodi = Phaser.Math.Between(0, VARIAN_MOTOR - 1);
    const { atas, tengah, tegak, masuk, mangkal } = JALAN;
    if (this.jenis === 'sayur') {
      // masuk dari jalan atas, mangkal dekat rumah Projects, putar balik,
      // turun ke jalan tengah, lalu keluar ke barat
      this.rute = [
        { x: masuk, y: atas },
        { x: mangkal, y: atas, singgah: Phaser.Math.Between(16000, 24000) },
        { x: tegak, y: atas },
        { x: tegak, y: tengah },
        { x: masuk, y: tengah },
      ];
    } else {
      const putaran = [
        { x: masuk, y: tengah },
        { x: tegak, y: tengah },
        { x: tegak, y: atas },
        { x: masuk, y: atas },
      ];
      this.rute = balik ? putaran.reverse() : putaran;
    }
    this.ke = 1;
    this.x = this.rute[0].x;
    this.y = this.rute[0].y;
    this.keadaan = 'jalan';
    this.terhalangSejak = -1;
    this.s.setVisible(true);
    this.bayang.setVisible(true);
  }

  private pergi(t: number) {
    this.keadaan = 'kosong';
    for (const o of [this.s, this.bayang, this.sorot, this.genangan]) o.setVisible(false);
    const malam = this.gelap() > 0.6;
    // gerimis: jalanan lebih sepi
    const jarang = cuaca.hujan ? 1.8 : 1;
    this.lagi = t + jarang * (malam ? Phaser.Math.Between(40000, 90000) : Phaser.Math.Between(14000, 38000));
  }

  /** Ada yang berdiri di jalur depan kendaraan? */
  private terhalang() {
    const { x: ax, y: ay } = this.arah;
    for (const h of this.halangan()) {
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const depan = dx * ax + dy * ay;
      const samping = Math.abs(dx * ay - dy * ax);
      // ujung depan kendaraan dari titik tengahnya saat menyamping: becak
      // (40 px, kabin di depan) lebih panjang dari motor
      const ujung = ax ? (this.jenis === 'becak' ? 20 : 16) : 6;
      if (depan > ujung - 4 && depan < ujung + 16 && samping < 10) return true;
    }
    return false;
  }

  private detak(t: number, delta: number) {
    if (this.keadaan === 'kosong') {
      if (this.libur()) this.lagi = Math.max(this.lagi, t + 5000);
      if (t > this.lagi) this.datang();
      else return;
    }
    const dt = Math.min(delta, 100) / 1000;
    let melaju = false;
    if (this.keadaan === 'singgah') {
      if (t > this.singgahSampai) {
        this.keadaan = 'jalan';
        this.ke++;
      } else if (t > this.teriakLagi) {
        this.teriakLagi = t + Phaser.Math.Between(5000, 8000);
        this.teriak();
      }
    }
    if (this.keadaan === 'jalan') {
      const target = this.rute[this.ke];
      if (!target) {
        this.pergi(t);
        return;
      }
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const jarak = Math.hypot(dx, dy);
      if (jarak > 0.01) this.arah = { x: Math.round(dx / jarak), y: Math.round(dy / jarak) };
      if (this.terhalang()) {
        if (this.terhalangSejak < 0) this.terhalangSejak = t;
        if (t > this.klaksonLagi && t - this.terhalangSejak > 500) {
          this.klaksonLagi = t + 3200;
          if (this.jenis === 'becak') kring(this.x, this.y - 12);
          else klakson(this.x, this.y - 12);
        }
      }
      // 9 detik menunggu orang yang tak mau minggir: kendaraannya lewat pelan-pelan
      const tunggu = this.terhalangSejak >= 0 && t - this.terhalangSejak < 9000 && this.terhalang();
      if (!tunggu) {
        if (this.terhalangSejak >= 0 && !this.terhalang()) this.terhalangSejak = -1;
        const langkah = LAJU[this.jenis] * dt * (this.terhalangSejak >= 0 ? 0.4 : 1);
        if (jarak <= langkah) {
          this.x = target.x;
          this.y = target.y;
          if (target.singgah) {
            this.keadaan = 'singgah';
            this.singgahSampai = t + target.singgah;
            this.teriakLagi = t + 600;
          } else {
            this.ke++;
          }
        } else {
          this.x += (dx / jarak) * langkah;
          this.y += (dy / jarak) * langkah;
          melaju = true;
        }
      }
    }
    if (melaju && this.jenis !== 'becak' && t > this.mesinLagi) {
      this.mesinLagi = t + 430;
      mesin(this.x, this.y - 10, this.jenis === 'motor' ? 1 : 0.6);
    }
    this.tempatkan(t, melaju);
  }

  /** Tukang sayur yang mangkal berteriak memanggil pembeli. */
  private teriak() {
    gumam(this.x, this.y - 24, 'bapak', 4, 1, 'seru');
    const kata = Phaser.Utils.Array.GetRandom(['Sayuuur!', 'Sayur, sayuuur!', 'Fresh veggies!']);
    this.scene.game.events.emit('mapporto:ucap', { msg: kata, siapa: this.s, nama: UCAP.sayur[0], lama: 3000 });
  }

  private tempatkan(t: number, melaju: boolean) {
    const { x: ax, y: ay } = this.arah;
    const sisi = ay === 0;
    const pandang = sisi ? 'samping' : ay > 0 ? 'depan' : 'belakang';
    const key = `${this.jenis}_${pandang}_${this.jenis === 'motor' ? this.bodi : 0}`;
    if (this.s.texture.key !== key) {
      this.s.setTexture(key, 0);
      // kotak ketukannya ikut ukuran gambar arah yang baru
      (this.s.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(this.s.frame.width, this.s.frame.height);
    }
    // roda berputar (becak: kaki mengayuh) hanya saat melaju
    const laju = this.jenis === 'becak' ? 260 : 120;
    this.s.setFrame(melaju ? Math.floor(t / laju) % 2 : 0);
    this.s.setFlipX(sisi && ax < 0);
    const z = this.scene.cameras.main.zoom;
    const x = Math.round(this.x * z) / z;
    // mesin hidup: bodi bergetar setengah piksel layar
    const getar = melaju || this.jenis === 'becak' ? 0 : (Math.floor(t / 60) % 2) / z;
    const y = Math.round(this.y * z) / z;
    this.s.setPosition(x, y - getar).setDepth(kedalaman(this.y));
    this.bayang
      .setPosition(x, y - 1)
      .setScale(sisi ? (this.jenis === 'becak' ? 3 : 2.4) : 1.6, 1.2)
      .setDepth(kedalaman(this.y) - 0.5);

    // lampu depan: motor dan becak sama-sama menyala saat gelap
    const nyala = Phaser.Math.Clamp((this.gelap() - 0.25) / 0.4, 0, 1);
    const becak = this.jenis === 'becak';
    const lampu = sisi
      ? { x: x + ax * (becak ? 16 : 10), y: y - (becak ? 9 : 14) }
      : { x, y: ay > 0 ? y - (becak ? 8 : 12) : y - 30 };
    const terlihat = nyala > 0 && this.s.visible && !(ay < 0);
    this.sorot.setPosition(lampu.x, lampu.y).setVisible(terlihat).setAlpha(nyala * 0.7).setScale(0.55);
    const depan = { x: lampu.x + ax * 22, y: y + ay * 20 - 2 };
    this.genangan.setPosition(depan.x, depan.y).setVisible(terlihat).setAlpha(nyala * 0.8);
  }
}
