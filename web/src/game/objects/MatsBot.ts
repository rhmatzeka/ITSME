import Phaser from 'phaser';
import { bipBot } from '../bunyi';
import { DEPTH, PLAYER, kedalaman } from '../config';
import { FRAME_BOT, FRAME_NYALA, PALET_BOT } from '../../matsbot/rupa';
import { bahasa, kunjungan, obrolanLama } from '../../matsbot/ingat';
import type { Player } from './Player';
import { BAYANGAN_KAKI, bayanganKaki, spritesheetTeks } from './piksel';

export type ModeBot = 'diam' | 'pikir' | 'bicara' | 'senyum';

/** Tinggi melayang di atas tanah, px (badan bawah ke bayangan). */
const MELAYANG = 7;
/** Seberapa sigap mengejar: makin besar makin rapat mengikuti. */
const SIGAP = 4.5;
/** Tertinggal sejauh ini (mis. pemain pindah lewat petir): langsung muncul di sampingnya. */
const LOMPAT = 160;
/** Sapaan pertama, setelah sapaan Rahmat sendiri selesai dibaca, ms sejak dunia tampil. */
const SAPA_SETELAH = 9000;
/** Tawaran "Mau kubukakan Projects?" berlaku selama ini, ms: mengetuk MATS-BOT = menerimanya. */
const TAWARAN_MS = 9000;
/** Di atas tirai malam, di bawah awan — seperti layar monitor Rahmat. */
const KEDALAMAN_NYALA = DEPTH.above + 61;

/**
 * Letak MATS-BOT terhadap kaki pemain, per arah hadap: selalu di belakang
 * bahunya, jadi tidak pernah menutupi jalan di depan atau wajah karakternya.
 */
const BELAKANG: Record<string, [number, number]> = {
  down: [-15, -6],
  up: [14, 5],
  left: [15, -3],
  right: [-15, -3],
};

/**
 * MATS-BOT: robot kecil pendamping yang melayang mengikuti karakter ke mana
 * pun, dan menjawab pertanyaan pengunjung tentang Rahmat (jendela obrolan di
 * src/matsbot/, jawabannya dari AI lewat terminal-server/tanya/).
 *
 * Dia mengejar dengan sedikit tertinggal di belakang bahu karakter, naik-turun
 * pelan dengan api pendorong yang berkedip; antenanya berkedip kuning seperti
 * panah pintu, sesekali mengedip, dan label "ASK AI" memantul di atasnya
 * (UIScene). Pindah tempat lewat petir: dia ikut muncul di tujuan. Setelah
 * sapaan Rahmat selesai, dia memperkenalkan diri sekali. Di malam hari mata,
 * antena, dan lampu dadanya menyala — piksel tajam (FRAME_NYALA), bukan
 * pendar kabur yang menutupi wajahnya.
 *
 * Diklik: `mapporto:matsbot` (jendela obrolan terbuka). Jendela obrolan
 * mengabarkan keadaannya lewat `mapporto:matsbot-mode` — berpikir saat
 * menunggu jawaban, bicara saat jawabannya muncul.
 *
 * Dia juga menyapa duluan: karakter yang berdiri diam dekat rumah yang belum
 * dimasuki ditawari "Mau kubukakan Projects?" (`mapporto:matsbot-tawar`
 * dari WorldScene) — gelembungnya atau robotnya diketuk, rumahnya dibuka.
 * Pengunjung yang datang lagi disapa "Welcome back", dalam bahasa yang
 * terakhir dipakainya di obrolan (src/matsbot/ingat.ts).
 */
export class MatsBot {
  private sprite: Phaser.GameObjects.Sprite;
  private bayangan: Phaser.GameObjects.Image;
  /** Piksel yang menyala (mata, antena, lampu dada, api), di atas tirai malam. */
  private nyala: Phaser.GameObjects.Sprite;
  /** Titik tanah di bawahnya (pecahan; yang digambar dibulatkan). */
  private x: number;
  private kaki: number;
  private mode: ModeBot = 'diam';
  private bicaraSampai = 0;
  private kedipPada = 0;
  private sudahMenyapa = false;
  private mulai = -1;
  /** Tawaran yang masih berlaku: id POI dan sampai kapan (waktu scene). */
  private tawaran?: { id: string; sampai: number };

  constructor(
    private scene: Phaser.Scene,
    x: number,
    kaki: number,
    private pemain: () => Player | undefined,
    private gelap: () => number,
    /** Bawa pemain ke rumah ini (petir) — tawaran yang diterima. */
    private antar?: (poi: string) => void
  ) {
    spritesheetTeks(scene, 'matsbot', FRAME_BOT, PALET_BOT);
    spritesheetTeks(scene, 'matsbot_nyala', FRAME_NYALA, PALET_BOT);
    this.x = x;
    this.kaki = kaki;
    this.bayangan = scene.add
      .image(x, kaki, bayanganKaki(scene))
      .setAlpha(BAYANGAN_KAKI)
      .setDepth(DEPTH.below + 1);
    this.sprite = scene.add.sprite(x, kaki - MELAYANG, 'matsbot', 0).setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerup', (p: Phaser.Input.Pointer) => {
      // jangan sampai terbaca juga sebagai "jalan ke sini"
      p.event?.preventDefault();
      this.buka();
    });
    this.nyala = scene.add
      .sprite(x, kaki - MELAYANG, 'matsbot_nyala', 0)
      .setOrigin(0.5, 1)
      .setDepth(KEDALAMAN_NYALA)
      .setAlpha(0);

    const game = scene.game;
    const ganti = (m: ModeBot) => this.setMode(m);
    game.events.on('mapporto:matsbot-mode', ganti);
    // MATS-BOT bicara di desa atas permintaan halaman (selesai tur, setelan diubah)
    const ucap = (msg: string) => {
      bipBot(this.x, this.kaki, 3);
      game.events.emit('mapporto:ucap', { msg, siapa: this.sprite, nama: 'MATS-BOT' });
    };
    game.events.on('mapporto:matsbot-ucap', ucap);
    const tawar = (t: { id: string; label: string }) => this.tawarkan(t.id, t.label);
    game.events.on('mapporto:matsbot-tawar', tawar);
    scene.events.on('update', this.detak, this);
    scene.events.once('shutdown', () => {
      game.events.off('mapporto:matsbot-mode', ganti);
      game.events.off('mapporto:matsbot-ucap', ucap);
      game.events.off('mapporto:matsbot-tawar', tawar);
      scene.events.off('update', this.detak, this);
    });
  }

  /** Titik gantung label "ASK AI", atau undefined saat robotnya tidak tampak. */
  get puncak() {
    if (!this.sprite.visible) return undefined;
    return { x: this.sprite.x, y: this.sprite.y - FRAME_BOT[0].length - 3 };
  }

  buka() {
    bipBot(this.x, this.kaki, 2);
    // masih ada tawaran: ketukan ini berarti "ya, bukakan"
    const t = this.tawaran;
    this.tawaran = undefined;
    if (t && this.antar && this.scene.time.now < t.sampai) return this.antar(t.id);
    this.scene.game.events.emit('mapporto:matsbot');
  }

  /** "Mau kubukakan Projects?" — diterima dengan mengetuk gelembungnya atau robotnya. */
  private tawarkan(id: string, label: string) {
    if (!this.antar || !this.sprite.visible) return;
    this.tawaran = { id, sampai: this.scene.time.now + TAWARAN_MS };
    bipBot(this.x, this.kaki, 2);
    this.scene.game.events.emit('mapporto:ucap', {
      msg: bahasa() === 'id' ? `Mau kubukakan ${label}? Ketuk aku!` : `Want me to open ${label} for you? Tap me!`,
      siapa: this.sprite,
      nama: 'MATS-BOT',
      lama: TAWARAN_MS,
      ketuk: () => {
        this.tawaran = undefined;
        this.antar?.(id);
      },
    });
  }

  setMode(m: ModeBot) {
    this.mode = m;
    if (m === 'bicara') {
      this.bicaraSampai = this.scene.time.now + 1600;
      bipBot(this.x, this.kaki, 4);
    }
  }

  private ikuti(dt: number) {
    const p = this.pemain();
    if (!p) return;
    const tampak = p.visible;
    this.sprite.setVisible(tampak);
    this.bayangan.setVisible(tampak);
    if (!tampak) return;
    const kakiPemain = p.y + PLAYER.baseY;
    const [dx, dy] = BELAKANG[p.hadap] ?? BELAKANG.down;
    const tx = p.x + dx;
    const ty = kakiPemain + dy;
    if (Math.hypot(tx - this.x, ty - this.kaki) > LOMPAT) {
      this.x = tx;
      this.kaki = ty;
      return;
    }
    const k = 1 - Math.exp((-dt / 1000) * SIGAP);
    this.x += (tx - this.x) * k;
    this.kaki += (ty - this.kaki) * k;
  }

  private detak(t: number, dt: number) {
    if (this.mulai < 0) this.mulai = t;
    this.ikuti(Math.min(dt, 100));

    // melayang: naik-turun 3 px, bayangan mengecil saat badannya naik
    const naik = (Math.sin(t / 420) + 1) / 2;
    const x = Math.round(this.x);
    const kaki = Math.round(this.kaki);
    this.sprite.setPosition(x, Math.round(kaki - MELAYANG - naik * 3)).setDepth(kedalaman(kaki));
    this.bayangan
      .setPosition(x, kaki)
      .setScale(1 - naik * 0.2, 1)
      .setAlpha(BAYANGAN_KAKI * (1 - naik * 0.35));

    if (this.mode === 'bicara' && t > this.bicaraSampai) this.mode = 'senyum';
    let fr: number;
    switch (this.mode) {
      case 'pikir':
        fr = Math.floor(t / 180) % 2 ? 5 : 6;
        break;
      case 'bicara':
        fr = Math.floor(t / 130) % 2 ? 3 : 4;
        break;
      case 'senyum':
        fr = 7;
        break;
      default: {
        // kedip sesekali, antena berkedip pelan
        if (t > this.kedipPada + 3200 + (this.kedipPada % 1700)) this.kedipPada = t;
        fr = t - this.kedipPada < 140 ? 2 : Math.floor(t / 600) % 2 ? 1 : 0;
      }
    }
    this.sprite.setFrame(fr);

    // malam: piksel mata, antena, lampu dada, dan api menyala di atas tirai
    const g = this.sprite.visible ? this.gelap() : 0;
    this.nyala.setPosition(this.sprite.x, this.sprite.y).setFrame(fr).setAlpha(g * 0.95).setVisible(g > 0.02);

    // sekali memperkenalkan diri, setelah sapaan Rahmat selesai dibaca
    if (!this.sudahMenyapa && this.sprite.visible && t - this.mulai > SAPA_SETELAH) {
      this.sudahMenyapa = true;
      bipBot(this.x, this.kaki, 3);
      const id = bahasa() === 'id';
      const ingatObrolan = obrolanLama().length > 0;
      const msg = kunjungan().kembali
        ? id
          ? `Selamat datang lagi! ${ingatObrolan ? 'Aku masih ingat obrolan kita. Ketuk aku kalau mau lanjut.' : 'Senang kamu mampir lagi. Ketuk aku kalau perlu apa-apa.'}`
          : `Welcome back! ${ingatObrolan ? "I still remember our chat. Tap me if you'd like to pick up where we left off." : 'Good to see you again. Tap me if you need anything.'}`
        : id
          ? 'Bip bup! Aku MATS-BOT, asisten AI Rahmat. Aku ikut menemanimu. Ketuk aku dan tanya apa saja soal dia!'
          : "Beep boop! I'm MATS-BOT, Rahmat's AI helper. I'll tag along. Tap me and ask anything about him, in any language!";
      this.scene.game.events.emit('mapporto:ucap', {
        msg,
        siapa: this.sprite,
        nama: 'MATS-BOT',
      });
    }
  }
}
