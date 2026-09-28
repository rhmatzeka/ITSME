import Phaser from 'phaser';
import { gumam, kembangApi, kresek, tawa } from '../bunyi';
import { DEPTH, kedalaman } from '../config';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { bisaDiajak, tanganTerangkat } from './Warga';

/** Di atas tirai malam, bersama cahaya lampu jalan — lihat Senter.ts. */
const KEDALAMAN_CAHAYA = DEPTH.above + 61;

/** Sama dengan anak layangan dan anak engklek: dua pertiga tinggi orang dewasa. */
const KECIL = 0.67;

/**
 * Dua anak, dari mana datang dan di mana berdiri, px dunia: lapangan tanah
 * di timur rumah CV, di bawah kotak engklek dan di kiri pos ronda.
 */
const ANAK = [
  { rupa: 'anak', angkat: 'anak_tarik', dari: { x: 438, y: 352 }, di: { x: 470, y: 324 } },
  { rupa: 'anak_engklek', angkat: 'anak_engklek_angkat', dari: { x: 446, y: 356 }, di: { x: 494, y: 320 } },
] as const;

/** Lama sebatang kembang api lidi menyala, ms. */
const NYALA = { min: 24000, maks: 34000 } as const;

interface Percik {
  r: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  vx: number;
  vy: number;
  umur: number;
  hidup: boolean;
}

interface Pemain {
  s: Phaser.GameObjects.Sprite;
  bayang: Phaser.GameObjects.Sprite;
  batang: Phaser.GameObjects.Graphics;
  cahaya: Phaser.GameObjects.Image;
  api?: Phaser.GameObjects.Sprite;
  obor: boolean;
  angkat: string;
  fase: number;
  kaki: number;
}

/**
 * Anak-anak main kembang api lidi di lapangan — kejadian langka, tidak
 * setiap malam.
 *
 * Tiap kali malam tiba, kira-kira separuhnya "malam kembang api". Di malam
 * seperti itu, sesekali dua anak berlari keluar ke lapangan di sebelah
 * rumah CV, lalu memutar-mutar kembang api lidinya: percikan terang
 * memancar dari ujungnya, cahayanya menerangi tanah di sekitar mereka, dan
 * desis-kereteknya terdengar dari dekat. Kadang salah satunya membawa obor
 * bambu, bukan kembang api. Mereka cekikikan, lalu pulang begitu batangnya
 * habis terbakar.
 */
export class KembangApi {
  private anak: Pemain[] = [];
  private percik: Percik[] = [];
  private malam = false;
  private malamIni = false;
  private berikut = 0;
  private main = false;
  private habis = 0;
  private jedaBunyi = 0;
  private jedaTawa = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number
  ) {
    const s = scene;
    tanganTerangkat(s, 'anak_engklek', 'anak_engklek_angkat', '#e8b48a', '#ec6fa6');
    tanganTerangkat(s, 'anak', 'anak_tarik', '#d9a07a', '#e8743a');
    for (const a of ANAK) Player.registerAnimations(s, a.rupa);
    // api obor: dua frame nyala di ujung batang bambu
    spritesheetTeks(
      s,
      'api_obor',
      [
        ['..r..', '.rFr.', '.rFr.', 'rFyFr', 'rFyFr', '.kbk.'],
        ['.r...', '.rF..', 'rFFr.', 'rFyFr', '.Fyr.', '.kbk.'],
      ],
      { r: '#e0463a', F: '#ff8a2a', y: '#fff2b0', k: '#3a2418', b: '#8a5a2a' }
    );
    const z = s.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    for (const a of ANAK) {
      const sp = s.add.sprite(a.dari.x, a.dari.y, a.rupa, 0).setOrigin(0.5, 1).setScale(sk).setVisible(false);
      bisaDiajak(s, sp, 'Kids', ['Look, a sparkler! Want to write your name in the air?', 'Shh, do not tell mom we are still outside!']);
      this.anak.push({
        s: sp,
        bayang: s.add.sprite(0, 0, bayanganKaki(s)).setScale(sk).setAlpha(BAYANGAN_KAKI).setVisible(false),
        batang: s.add.graphics().setVisible(false),
        cahaya: s.add
          .image(0, 0, s.textures.exists('lentera_cahaya') ? 'lentera_cahaya' : 'lampu_genangan')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(KEDALAMAN_CAHAYA)
          .setVisible(false),
        obor: false,
        angkat: a.angkat,
        fase: Math.random() * 6,
        kaki: a.dari.y,
      });
    }
    // percikan: kumpulan titik yang dipakai ulang, bukan dibuat-dibuang tiap percik
    for (let i = 0; i < 70; i++) {
      this.percik.push({
        r: s.add.rectangle(0, 0, 1, 1, 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(KEDALAMAN_CAHAYA + 2).setVisible(false),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        umur: 0,
        hidup: false,
      });
    }
    s.events.on('update', this.detak, this);
  }

  /** Untuk mengetes dari konsol: anak-anaknya keluar sekarang juga. */
  mulai() {
    if (this.main) return;
    this.main = true;
    this.habis = this.scene.time.now + Phaser.Math.Between(NYALA.min, NYALA.maks);
    // kadang yang satu membawa obor, bukan kembang api
    const obor = Math.random() < 0.4 ? Phaser.Math.Between(0, 1) : -1;
    this.anak.forEach((p, i) => {
      const a = ANAK[i];
      p.obor = i === obor;
      p.kaki = a.dari.y;
      p.s.setPosition(a.dari.x, a.dari.y).setVisible(true).setAlpha(0).setTexture(a.rupa, 0);
      p.s.play(`${a.rupa}_walk_right`, true);
      p.bayang.setVisible(true);
      this.scene.tweens.add({ targets: p.s, alpha: 1, duration: 400 });
      this.scene.tweens.add({
        targets: p.s,
        x: a.di.x,
        y: a.di.y,
        duration: 2600 + i * 300,
        onUpdate: () => (p.kaki = p.s.y),
        onComplete: () => {
          p.kaki = a.di.y;
          p.s.anims.stop();
          p.s.setTexture(p.angkat, 0);
          p.batang.setVisible(true);
          p.cahaya.setVisible(true);
          if (p.obor) p.api = this.scene.add.sprite(0, 0, 'api_obor', 0).setOrigin(0.5, 1);
          if (i === 0) gumam(p.s.x, p.s.y, 'anak', 4);
        },
      });
    });
  }

  private selesai() {
    this.main = false;
    this.anak.forEach((p, i) => {
      const a = ANAK[i];
      p.batang.setVisible(false).clear();
      p.cahaya.setVisible(false);
      p.api?.destroy();
      p.api = undefined;
      p.s.setTexture(a.rupa, 0).play(`${a.rupa}_walk_left`, true);
      this.scene.tweens.add({
        targets: p.s,
        x: a.dari.x,
        y: a.dari.y,
        alpha: 0,
        duration: 2400,
        onUpdate: () => (p.kaki = p.s.y),
        onComplete: () => {
          p.s.setVisible(false);
          p.bayang.setVisible(false);
        },
      });
    });
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    const malam = this.gelap() > 0.7;
    if (malam && !this.malam) {
      // malam baru: kira-kira separuhnya malam kembang api
      this.malamIni = Math.random() < 0.55;
      this.berikut = t + Phaser.Math.Between(15000, 35000);
    }
    this.malam = malam;
    if (!this.main && malam && this.malamIni && t > this.berikut) {
      this.berikut = t + Phaser.Math.Between(150000, 240000);
      this.mulai();
    }
    if (this.main && (t > this.habis || this.gelap() < 0.4)) this.selesai();

    for (const p of this.anak) {
      if (!p.s.visible) continue;
      p.s.setDepth(kedalaman(p.kaki));
      p.bayang.setPosition(p.s.x, p.kaki - p.s.scaleY).setDepth(kedalaman(p.kaki) - 0.5).setAlpha(BAYANGAN_KAKI * p.s.alpha);
      if (!p.batang.visible) continue;
      this.mainkan(p, t, dt);
    }
    this.gerakPercik(dt);

    if (this.main && this.anak.some((p) => p.batang.visible)) {
      if ((this.jedaBunyi -= delta) <= 0) {
        this.jedaBunyi = 950;
        for (const p of this.anak) {
          if (!p.batang.visible) continue;
          if (p.obor) kresek(p.s.x, p.s.y - 12, 120);
          else kembangApi(p.s.x, p.s.y - 12);
        }
      }
      if ((this.jedaTawa -= delta) <= 0) {
        this.jedaTawa = Phaser.Math.Between(6000, 11000);
        const p = Phaser.Utils.Array.GetRandom(this.anak);
        if (Math.random() < 0.6) tawa(p.s.x, p.s.y - 10, 'anak');
        else gumam(p.s.x, p.s.y - 10, 'anak', 3);
      }
    }
  }

  /** Tangan mengayun, batang mengikuti, ujungnya memercik (atau apinya menyala). */
  private mainkan(p: Pemain, t: number, dt: number) {
    p.fase += dt * (p.obor ? 1.2 : 4.2);
    // tangan terangkat bergantian dua posisi — lengan yang mengayun
    const f = p.obor ? 0 : Math.sin(p.fase) > 0 ? 1 : 0;
    p.s.setFrame(f);
    const k = p.s.scaleX;
    // genggaman di (23,18) / (24,18) frame 32×32 — lihat tanganTerangkat()
    const hx = p.s.x + (f ? 8.5 : 7.5) * k;
    const hy = p.kaki - (32 - 18.5) * k;
    const panjang = p.obor ? 12 : 7;
    const sudut = p.obor ? -Math.PI / 2 + Math.sin(p.fase) * 0.12 : -Math.PI / 2 + Math.sin(p.fase * 1.3) * 0.9;
    const ux = hx + Math.cos(sudut) * panjang;
    const uy = hy + Math.sin(sudut) * panjang;
    p.batang
      .clear()
      .lineStyle(1, p.obor ? 0x8a5a2a : 0x9a9aa4, 1)
      .lineBetween(hx, hy, ux, uy)
      .setDepth(p.s.depth + 0.1);
    const kedip = 0.8 + Math.sin(t / 45) * 0.1 + Math.random() * 0.1;
    p.cahaya.setPosition(ux, uy).setScale(p.obor ? 1.3 * kedip : 0.8 * kedip).setAlpha(p.obor ? 0.85 : 0.75 * kedip);
    if (p.api) {
      p.api.setPosition(ux, uy + 1).setDepth(p.s.depth + 0.2).setFrame(Math.floor(t / 130) % 2);
      if (Math.random() < dt * 3) this.pancar(ux, uy - 2, 1, true);
    } else {
      this.pancar(ux, uy, Math.random() < 0.5 ? 1 : 2, false);
    }
  }

  /** Lepaskan `n` percikan dari (x, y). Bara obor lebih lambat dan naik. */
  private pancar(x: number, y: number, n: number, bara: boolean) {
    for (let i = 0; i < n; i++) {
      const pc = this.percik.find((q) => !q.hidup);
      if (!pc) return;
      const a = Math.random() * Math.PI * 2;
      const v = bara ? Phaser.Math.FloatBetween(4, 10) : Phaser.Math.FloatBetween(18, 42);
      pc.hidup = true;
      pc.x = x;
      pc.y = y;
      pc.vx = Math.cos(a) * v;
      pc.vy = bara ? -Phaser.Math.FloatBetween(8, 16) : Math.sin(a) * v;
      pc.umur = bara ? Phaser.Math.FloatBetween(0.5, 0.9) : Phaser.Math.FloatBetween(0.15, 0.38);
      pc.r
        .setFillStyle(bara ? 0xff8a2a : Phaser.Utils.Array.GetRandom([0xffffff, 0xfff6c8, 0xffd35a, 0xffb040]))
        .setVisible(true)
        .setAlpha(1);
    }
  }

  private gerakPercik(dt: number) {
    for (const pc of this.percik) {
      if (!pc.hidup) continue;
      pc.umur -= dt;
      if (pc.umur <= 0) {
        pc.hidup = false;
        pc.r.setVisible(false);
        continue;
      }
      pc.vy += 30 * dt;
      pc.x += pc.vx * dt;
      pc.y += pc.vy * dt;
      pc.r.setPosition(pc.x, pc.y).setAlpha(Math.min(1, pc.umur * 5));
    }
  }
}
