import Phaser from 'phaser';
import { pok, tawa } from '../bunyi';
import { DEPTH, LAPANGAN, PLAYER, kedalaman } from '../config';
import { gelapAtauHujan } from '../cuaca';
import { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';
import { buatRupa } from './Rupa';
import { bisaDiajak } from './Warga';
import { arahKePemain } from './toleh';

/** Anak digambar lebih kecil dari orang dewasa, sama dengan anak engklek. */
const KECIL = 0.7;

/** Jari-jari bola, px dunia — dipakai tabrakan dan jarak tendang. */
const R = 4;

/** Perlambatan per detik: tanah lapang licin, rumput di tepinya menahan. */
const GESEK = 1.5;

/** Laju tendangan, px/detik: [pelan, keras]. */
const TENDANG = { anak: [70, 115], pemain: 105 };

/** Laju lari anak mengejar bola, px/detik. */
const LARI = 40;

type Kotak = { x0: number; y0: number; x1: number; y1: number };

type Keadaan = 'kejar' | 'tunggu' | 'istirahat';

/**
 * Bola plastik di lapangan tanah timur rumah CV, dan anak laki-laki yang
 * memainkannya.
 *
 * Bolanya bisa ditendang pemain: berjalan menabraknya melontarkan bola ke
 * arah langkah, ia menggelinding (garis-garisnya berputar), sedikit
 * melambung, memantul di batu, tiang bendera, tepi lapangan, dan pos
 * ronda, dan meninggalkan kepulan debu tiap kali menyentuh tanah.
 *
 * Siang hari si anak mengejar bola itu, menggiringnya, dan menendangnya ke
 * sudut lain lapangan — kadang ke arah pemain, mengoper. Menjelang malam
 * (atau saat gerimis) ia pulang; yang tertinggal sandal jepit sebelah dan
 * sebatang kapur di dekat engklek.
 */
export class Bola {
  private bola: Phaser.GameObjects.Sprite;
  private bayangBola: Phaser.GameObjects.Sprite;
  private x: number;
  private y: number;
  private vx = 0;
  private vy = 0;
  /** Tinggi bola di atas tanah dan laju naiknya — lambungan kecil. */
  private z = 0;
  private vz = 0;
  private putar = 0;
  private batas: Kotak;
  private dinding: Kotak[] = [];
  private debu: Phaser.GameObjects.Rectangle[] = [];

  private anak: Phaser.GameObjects.Sprite;
  private bayangAnak: Phaser.GameObjects.Sprite;
  private keadaan: Keadaan = 'tunggu';
  private sampai = 0;
  private arah = new Phaser.Math.Vector2(1, 0);
  private hadir = 1;
  private tertinggal: Phaser.GameObjects.Image[] = [];
  /** Pemain baru saja menendang: anaknya bersorak sekali, tidak tiap sentuhan. */
  private soraiLagi = 0;

  constructor(
    private scene: Phaser.Scene,
    private gelap: () => number,
    private pemain: () => Player | undefined,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.buatTekstur();
    const { x0, y0, x1, y1, pos } = LAPANGAN.bola;
    this.batas = { x0: x0 + R, y0: y0 + R, x1: x1 - R, y1: y1 - R };
    this.dinding.push(pos);
    // benda padat di dalam lapangan (tiang bendera, batu besar) ikut memantulkan bola
    blocked?.getChildren().forEach((c) => {
      const r = c as Phaser.GameObjects.Rectangle;
      const k = { x0: r.x - r.width / 2, y0: r.y - r.height / 2, x1: r.x + r.width / 2, y1: r.y + r.height / 2 };
      if (k.x1 > x0 && k.x0 < x1 && k.y1 > y0 && k.y0 < y1) this.dinding.push(k);
    });

    this.x = 534;
    this.y = 268;
    this.bola = scene.add.sprite(this.x, this.y, 'bola_plastik', 0).setOrigin(0.5, 1);
    this.bayangBola = scene.add.sprite(this.x, this.y, bayanganKaki(scene)).setScale(0.6, 0.75).setAlpha(BAYANGAN_KAKI);
    for (let i = 0; i < 8; i++) this.debu.push(scene.add.rectangle(0, 0, 1, 1, 0xd9b27a).setVisible(false));

    // sandal jepit sebelah dan kapur yang ketinggalan — hanya tampak setelah anak-anak pulang
    this.tertinggal.push(
      scene.add.image(492, 306, 'sandal_jepit').setDepth(DEPTH.below + 1).setAlpha(0),
      scene.add.image(512, 292, 'kapur_tulis').setDepth(DEPTH.below + 1).setAngle(0).setAlpha(0)
    );

    const z = scene.cameras.main.zoom;
    const sk = Math.max(1, Math.round(z * KECIL)) / z;
    this.anak = scene.add.sprite(520, 300, 'anak_bola', 0).setOrigin(0.5, 1).setScale(sk);
    this.bayangAnak = scene.add.sprite(520, 300, bayanganKaki(scene)).setScale(sk).setAlpha(BAYANGAN_KAKI);
    bisaDiajak(scene, this.anak, 'Kid', [
      'Wanna play? Walk into the ball to kick it!',
      'I am practising for the village cup. Pass it here!',
    ]);
    this.anak.play('anak_bola_idle_down');
    this.sampai = scene.time.now + 1500;
    this.gambarBola();
    this.gambarAnak();
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const s = this.scene;
    /*
     * Bola pantai plastik 8×8: tiga panel melengkung (kuning, merah, biru)
     * dipisah pita putih, kilau di kiri atas. Berputar = warna panelnya
     * bergilir sementara kilau dan garis tepinya tetap — digambar di
     * scratchpad art2/benda.py dan dibandingkan dengan aset karakter.
     */
    // 1 2 3 = panel, 4 5 = sisi gelap panel 2 dan 3
    const BOLA = ['..kkkk..', '.k1122k.', 'k1W1222k', 'k111222k', 'k333w24k', 'k333ww4k', '.k533wk.', '..kkkk..'];
    const panel = [
      ['y', 'r', 'R', 'b', 'B'],
      ['b', 'y', 'Y', 'r', 'R'],
      ['r', 'b', 'B', 'y', 'Y'],
    ];
    spritesheetTeks(
      s,
      'bola_plastik',
      panel.map(([p1, p2, p2g, p3, p3g]) => BOLA.map((r) => r.replace(/1/g, p1).replace(/2/g, p2).replace(/4/g, p2g).replace(/3/g, p3).replace(/5/g, p3g))),
      { k: '#3b2630', y: '#f6c945', Y: '#c89a2a', r: '#e0463a', R: '#a8302a', b: '#3f7fd6', B: '#2a5aa0', w: '#f7f5ee', W: '#ffffff' }
    );
    // sandal jepit merah sebelah, bentuknya sama dengan sepasang di teras CV
    spritesheetTeks(s, 'sandal_jepit', [['.kkk.', 'kbwbk', 'kwbwk', 'wbbbw', '.kbk.', 'kbbbk', 'kBBBk', '.kkk.']], {
      k: '#5a1a1a',
      b: '#e0463a',
      B: '#a8302a',
      w: '#ffffff',
    });
    spritesheetTeks(s, 'kapur_tulis', [['wwwwv']], { w: '#f7f5ee', v: '#c9c3b6' });
    // anak laki-laki: rambut hitam cepak, kaos bola hijau bernomor putih, celana pendek putih
    buatRupa(s, 'player', 'anak_bola', {
      tukar: {
        '#f79617': '#2d2a33',
        '#fb6b1d': '#1b1920',
        '#f9c22b': '#4d4857',
        '#fdcbb0': '#c68b5e',
        '#fca790': '#a46d45',
        '#e83b3b': '#2f9a4a',
        '#ae2334': '#1f6e34',
        '#ffffff': '#f7f5ee',
        '#cd683d': '#f2efe6',
        '#9e4539': '#c9c3b6',
      },
    });
    Player.registerAnimations(s, 'anak_bola');
  }

  private detak(t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.aturAnak(t, dt);
    this.tendanganPemain(t);
    this.gerakBola(dt);
    this.gambarBola();
  }

  /* ---------------- bola ---------------- */

  private gerakBola(dt: number) {
    const laju = Math.hypot(this.vx, this.vy);
    if (laju < 2 && this.z <= 0) {
      this.vx = this.vy = 0;
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const redam = Math.exp(-GESEK * dt);
    this.vx *= redam;
    this.vy *= redam;
    this.putar += laju * dt;

    // lambungan kecil: jatuh, memantul makin rendah, lalu menggelinding
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 260 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        if (this.vz < -30) {
          this.kepul(this.x, this.y, 3);
          pok(this.x, this.y, Math.min(1, -this.vz / 90) * 0.6);
        }
        this.vz = this.vz < -30 ? -this.vz * 0.4 : 0;
      }
    }

    // tepi lapangan
    const b = this.batas;
    if (this.x < b.x0 || this.x > b.x1) {
      this.x = Phaser.Math.Clamp(this.x, b.x0, b.x1);
      this.pantul('x');
    }
    if (this.y < b.y0 || this.y > b.y1) {
      this.y = Phaser.Math.Clamp(this.y, b.y0, b.y1);
      this.pantul('y');
    }
    // benda padat: dorong keluar lewat sisi yang paling dangkal, lalu memantul
    for (const k of this.dinding) {
      if (this.x + R <= k.x0 || this.x - R >= k.x1 || this.y <= k.y0 || this.y - R >= k.y1) continue;
      const kiri = this.x + R - k.x0;
      const kanan = k.x1 - (this.x - R);
      const atas = this.y - k.y0;
      const bawah = k.y1 - (this.y - R);
      const m = Math.min(kiri, kanan, atas, bawah);
      if (m === kiri) this.x = k.x0 - R;
      else if (m === kanan) this.x = k.x1 + R;
      else if (m === atas) this.y = k.y0;
      else this.y = k.y1 + R;
      this.pantul(m === kiri || m === kanan ? 'x' : 'y');
    }
  }

  private pantul(sumbu: 'x' | 'y') {
    const laju = Math.hypot(this.vx, this.vy);
    if (sumbu === 'x') this.vx *= -0.6;
    else this.vy *= -0.6;
    if (laju > 25) pok(this.x, this.y, Math.min(1, laju / 120) * 0.7);
  }

  private tendang(arah: Phaser.Math.Vector2, laju: number, lambung = 45) {
    const a = arah.clone().normalize();
    this.vx = a.x * laju;
    this.vy = a.y * laju;
    this.vz = lambung;
    this.z = Math.max(this.z, 0.1);
    this.kepul(this.x, this.y, 4);
    pok(this.x, this.y);
  }

  private gambarBola() {
    const z = this.scene.cameras.main.zoom;
    const bulat = (v: number) => Math.round(v * z) / z;
    this.bola
      .setPosition(bulat(this.x), bulat(this.y - this.z))
      .setFrame(Math.floor(this.putar / 3) % 3)
      .setDepth(kedalaman(this.y));
    this.bayangBola.setPosition(bulat(this.x), bulat(this.y - 1)).setDepth(kedalaman(this.y) - 0.5);
  }

  /** Kepulan debu tanah: beberapa piksel yang memencar lalu memudar. */
  private kepul(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const d = this.debu.find((r) => !r.visible);
      if (!d) return;
      d.setPosition(x + Phaser.Math.Between(-2, 2), y - 1).setVisible(true).setAlpha(0.8).setDepth(kedalaman(y) + 0.2);
      this.scene.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-5, 5),
        y: d.y - Phaser.Math.Between(1, 4),
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        onComplete: () => d.setVisible(false),
      });
    }
  }

  /** Pemain yang berjalan menabrak bola menendangnya searah langkahnya. */
  private tendanganPemain(t: number) {
    const p = this.pemain();
    if (!p?.body || !p.visible) return;
    const v = (p.body as Phaser.Physics.Arcade.Body).velocity;
    const kx = p.x;
    const ky = p.y + PLAYER.baseY;
    const dx = this.x - kx;
    const dy = this.y - ky;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 6 || this.z > 4) return;
    const laju = Math.hypot(v.x, v.y);
    if (laju < 10) return;
    // hanya kalau langkahnya memang menuju bola, bukan menjauhinya
    if (v.x * dx + v.y * dy <= 0) return;
    this.tendang(new Phaser.Math.Vector2(v.x, v.y), TENDANG.pemain + Phaser.Math.Between(-10, 15), 30);
    this.scene.game.events.emit('mapporto:jejak', 'bola');
    // dorong bola keluar dari kaki supaya tidak ditendang dua kali
    const a = new Phaser.Math.Vector2(v.x, v.y).normalize();
    this.x = kx + a.x * 9;
    this.y = ky + a.y * 7;
    if (this.hadir > 0.9 && t > this.soraiLagi && Math.random() < 0.5) {
      this.soraiLagi = t + 15000;
      this.scene.time.delayedCall(400, () => {
        tawa(this.anak.x, this.anak.y - 8, 'anak');
        this.loncat();
      });
    }
    // anaknya berhenti beristirahat dan ikut mengejar
    if (this.keadaan === 'istirahat') this.sampai = 0;
  }

  /* ---------------- anak ---------------- */

  private aturAnak(t: number, dt: number) {
    this.hadir = Phaser.Math.Clamp((0.55 - gelapAtauHujan(this.gelap())) / 0.25, 0, 1);
    const ada = this.hadir > 0;
    this.anak.setVisible(ada).setAlpha(this.hadir);
    this.bayangAnak.setVisible(ada).setAlpha(this.hadir * BAYANGAN_KAKI);
    if (this.anak.input) this.anak.input.enabled = this.hadir > 0.5;
    for (const b of this.tertinggal) b.setAlpha(1 - this.hadir);
    if (this.hadir < 0.5) return;

    if (this.keadaan !== 'kejar') {
      if (t < this.sampai) {
        const a = arahKePemain(this.anak.x, this.anak.y);
        if (a) this.anak.play(`anak_bola_idle_${a}`, true);
        else this.hadap(this.x - this.anak.x, this.y - this.anak.y, false);
        return;
      }
      if (this.keadaan === 'tunggu' && Math.random() < 0.15) {
        this.keadaan = 'istirahat';
        this.sampai = t + Phaser.Math.Between(2500, 5000);
        return;
      }
      this.keadaan = 'kejar';
      this.arah = this.tujuanTendang();
    }

    // berdiri di belakang bola, searah tendangan yang direncanakan
    const tx = this.x - this.arah.x * 6;
    const ty = this.y - this.arah.y * 3 + 1;
    const dx = tx - this.anak.x;
    const dy = ty - this.anak.y;
    const jarak = Math.hypot(dx, dy);
    if (jarak < 2 && Math.hypot(this.vx, this.vy) < 20) {
      this.tendang(this.arah, Phaser.Math.Between(TENDANG.anak[0], TENDANG.anak[1]));
      this.keadaan = 'tunggu';
      this.sampai = t + Phaser.Math.Between(500, 1300);
      this.hadap(this.arah.x, this.arah.y, false);
      return;
    }
    if (jarak < 0.5) return;
    const langkah = Math.min(jarak, LARI * dt);
    this.anak.x += (dx / jarak) * langkah;
    this.anak.y += (dy / jarak) * langkah;
    this.jauhiPos();
    this.hadap(dx, dy, true);
    this.gambarAnak();
  }

  /** Arah tendangan: ke sudut lapangan yang lain, atau mengoper ke pemain yang dekat. */
  private tujuanTendang() {
    const p = this.pemain();
    if (p && Math.random() < 0.4) {
      const d = Phaser.Math.Distance.Between(p.x, p.y + PLAYER.baseY, this.x, this.y);
      if (d < 90 && d > 16) return new Phaser.Math.Vector2(p.x - this.x, p.y + PLAYER.baseY - this.y).normalize();
    }
    const { x0, y0, x1, y1 } = LAPANGAN.bola;
    const gx = Phaser.Math.Between(x0 + 26, x1 - 8);
    const gy = Phaser.Math.Between(y0 + 8, y1 - 44);
    const a = new Phaser.Math.Vector2(gx - this.x, gy - this.y);
    return a.lengthSq() < 1 ? new Phaser.Math.Vector2(1, 0) : a.normalize();
  }

  /** Kaki anak tidak boleh masuk ke kolong pos ronda. */
  private jauhiPos() {
    const k = LAPANGAN.bola.pos;
    const a = this.anak;
    if (a.x > k.x0 - 3 && a.y > k.y0 && a.y < k.y1 + 2) {
      if (a.x - (k.x0 - 3) < a.y - k.y0) a.x = k.x0 - 3;
      else a.y = k.y0;
    }
  }

  private hadap(dx: number, dy: number, jalan: boolean) {
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.anak.play(`anak_bola_${jalan ? 'walk' : 'idle'}_${dir}`, true);
  }

  /** Lompat kegirangan. */
  private loncat() {
    const y = this.anak.y;
    this.scene.tweens.add({ targets: this.anak, y: y - 5, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeOut', onUpdate: () => this.gambarAnak(y) });
  }

  private gambarAnak(tanah = this.anak.y) {
    this.anak.setDepth(kedalaman(tanah));
    this.bayangAnak.setPosition(this.anak.x, tanah - this.anak.scaleY).setDepth(kedalaman(tanah) - 0.5);
  }
}
