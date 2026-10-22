import Phaser from 'phaser';
import { gumam, kertas, sukses } from '../bunyi';
import { DEPTH, PLAYER, SURAT, kedalaman } from '../config';
import type { Player } from './Player';
import { faktaBerikutnya, type Kurir } from './Warga';

/** Rumah tujuan tiap surat: slug panelnya dan nama yang dibaca pengunjung. */
const RUMAH: Record<string, string> = {
  about: 'About me',
  projects: 'Projects',
  office: 'AI Office',
  cv: 'CV',
  contact: 'Contact',
};
export const SLUG_SURAT = Object.keys(RUMAH);

const KUNCI = 'mapporto:surat';
interface Simpanan {
  /** Sudah diajak kurir (atau sudah memungut surat pertama). */
  mulai?: boolean;
  /** Surat yang sedang dibawa, belum diantar. */
  bawa: string[];
  /** Surat yang sudah sampai di rumahnya. */
  antar: string[];
  /** Hadiah (surat dari Rahmat) sudah diterima dari kurir. */
  hadiah?: boolean;
}

function baca(): Simpanan {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI) ?? '{}');
    return { bawa: Array.isArray(x.bawa) ? x.bawa : [], antar: Array.isArray(x.antar) ? x.antar : [], mulai: !!x.mulai, hadiah: !!x.hadiah };
  } catch {
    return { bawa: [], antar: [] };
  }
}

/**
 * Misi kecil "surat kurir yang tercecer": angin menerbangkan lima surat dari
 * tas kurir, satu untuk tiap rumah — About, Projects, AI Office, CV, Contact.
 *
 * Suratnya tergeletak di dekat rumah tujuannya, berkilau supaya kelihatan;
 * dipungut dengan berjalan di atasnya. Mengantarnya = masuk ke rumah itu,
 * jadi misinya sekaligus mengajak pengunjung membuka tiap bagian portfolio.
 * Setelah kelimanya sampai, kurir memberi hadiah: lencana "Village courier"
 * dan sepucuk surat dari Rahmat (ditampilkan halaman, Desa.astro).
 *
 * Kemajuannya disimpan di browser, jadi pengunjung yang kembali besok
 * melanjutkan dari surat yang tersisa.
 */
export class Surat {
  private s: Simpanan = baca();
  private amplop = new Map<string, { img: Phaser.GameObjects.Image; kilau: Phaser.GameObjects.Image; x: number; y: number }>();
  private kurirKe = 0;

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Player | undefined,
    private kurir: Kurir | undefined
  ) {
    this.buatTekstur();
    for (const [slug, t] of Object.entries(SURAT)) {
      if (this.s.bawa.includes(slug) || this.s.antar.includes(slug)) continue;
      const img = scene.add.image(t.x, t.y, 'amplop_tanah', 0).setOrigin(0.5, 1).setDepth(kedalaman(t.y) - 1);
      const kilau = scene.add.image(t.x + 3, t.y - 6, 'kilau_surat').setDepth(DEPTH.above + 40).setAlpha(0);
      // angin sesekali mengangkat ujungnya
      scene.tweens.add({ targets: img, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 900 });
      this.amplop.set(slug, { img, kilau, x: t.x, y: t.y });
    }
    // kurir diajak bicara: misinya diceritakan dulu, baru fakta biasa
    if (kurir) {
      kurir.s.removeAllListeners('pointerup');
      kurir.s.on('pointerup', (p: Phaser.Input.Pointer) => {
        p.event.preventDefault();
        this.bicaraKurir();
      });
    }
    // masuk rumah = surat untuk rumah itu sampai
    const masuk = (slug: string) => this.antar(slug);
    scene.game.events.on('mapporto:panel', masuk);
    scene.events.once('shutdown', () => scene.game.events.off('mapporto:panel', masuk));
    scene.events.on('update', this.detak, this);
  }

  private buatTekstur() {
    const tx = this.scene.textures;
    if (!tx.exists('amplop_tanah')) {
      // amplop 11×8 dengan perangko merah dan bayangan tipis di bawahnya
      const k = tx.createCanvas('amplop_tanah', 11, 9)!;
      const c = k.getContext();
      const isi = (x: number, y: number, w: number, h: number, warna: string) => {
        c.fillStyle = warna;
        c.fillRect(x, y, w, h);
      };
      isi(1, 8, 9, 1, 'rgba(27,36,22,0.35)');
      isi(0, 0, 11, 8, '#2a1c14');
      isi(1, 1, 9, 6, '#fbf6e6');
      isi(1, 1, 1, 1, '#d9d2c2');
      for (let i = 0; i < 4; i++) isi(1 + i, 1 + i, 1, 1, '#c9c0ae'), isi(9 - i, 1 + i, 1, 1, '#c9c0ae');
      isi(7, 2, 2, 2, '#e0463a');
      k.refresh();
    }
    if (!tx.exists('kilau_surat')) {
      const k = tx.createCanvas('kilau_surat', 5, 5)!;
      const c = k.getContext();
      c.fillStyle = '#fff6c0';
      c.fillRect(2, 0, 1, 5);
      c.fillRect(0, 2, 5, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(2, 2, 1, 1);
      k.refresh();
    }
  }

  private simpan() {
    try {
      localStorage.setItem(KUNCI, JSON.stringify(this.s));
    } catch {
      /* tetap berlaku untuk kunjungan ini */
    }
  }

  private ucap(msg: string, siapa?: Phaser.GameObjects.Sprite, nama = 'Rahmat') {
    const s = siapa ?? this.pemain();
    if (s) this.scene.game.events.emit('mapporto:ucap', { msg, siapa: s, nama });
  }

  private sisa() {
    return SLUG_SURAT.filter((x) => !this.s.antar.includes(x));
  }

  private bicaraKurir() {
    const k = this.kurir!;
    gumam(k.s.x, k.s.y, 'pria', 4);
    this.scene.game.events.emit('mapporto:jejak', 'warga');
    const n = this.s.antar.length;
    let msg: string;
    if (this.s.hadiah) {
      msg = this.kurirKe++ % 2 ? faktaBerikutnya() : 'Thanks again for helping with the mail! You are an honorary village courier now.';
    } else if (n === SLUG_SURAT.length) {
      msg = 'All five delivered? You are a lifesaver! Here — Rahmat left a letter for whoever helped me. It is addressed to you.';
      this.s.hadiah = true;
      this.simpan();
      sukses(k.s.x, k.s.y);
      this.scene.time.delayedCall(2200, () => this.scene.game.events.emit('mapporto:surat-hadiah'));
    } else if (!this.s.mulai && !this.s.bawa.length) {
      msg =
        'Oh no, the wind blew five letters out of my bag! One each for About me, Projects, AI Office, CV and Contact. Could you find them and walk them in through the right front door?';
      this.s.mulai = true;
      this.simpan();
    } else {
      const belum = this.sisa().map((x) => RUMAH[x]);
      msg = `${n} of ${SLUG_SURAT.length} delivered. Still missing: ${belum.join(', ')}. Look for something white sparkling near each house.`;
    }
    this.ucap(msg, k.s, 'Courier');
  }

  /** Memungut surat yang diinjak. */
  private pungut(slug: string) {
    const a = this.amplop.get(slug);
    if (!a) return;
    this.amplop.delete(slug);
    kertas(a.x, a.y);
    this.scene.tweens.killTweensOf(a.img);
    this.scene.tweens.add({
      targets: [a.img, a.kilau],
      y: a.y - 14,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        a.img.destroy();
        a.kilau.destroy();
      },
    });
    this.s.bawa.push(slug);
    const pertama = !this.s.mulai;
    this.s.mulai = true;
    this.simpan();
    this.ucap(
      pertama
        ? `A letter for ${RUMAH[slug]}! The courier must have dropped it. I'll walk it in through the front door of ${RUMAH[slug]}.`
        : `Another letter, this one for ${RUMAH[slug]}. (${this.s.antar.length + this.s.bawa.length}/${SLUG_SURAT.length} found)`
    );
  }

  /** Masuk ke sebuah rumah sambil membawa suratnya. */
  private antar(slug: string) {
    if (!this.s.bawa.includes(slug)) return;
    this.s.bawa = this.s.bawa.filter((x) => x !== slug);
    this.s.antar.push(slug);
    this.simpan();
    const n = this.s.antar.length;
    this.scene.game.events.emit('mapporto:jejak', 'surat', slug);
    this.scene.game.events.emit('mapporto:surat-diantar', { rumah: RUMAH[slug], n, total: SLUG_SURAT.length });
    if (n === SLUG_SURAT.length) {
      this.scene.time.delayedCall(1500, () =>
        this.scene.game.events.emit('mapporto:matsbot-ucap', 'All five letters are delivered! Go find the courier, he wants to thank you.')
      );
    }
  }

  private detak(t: number) {
    const p = this.pemain();
    if (!p?.visible) return;
    const kx = p.x;
    const ky = p.y + PLAYER.baseY;
    for (const [slug, a] of this.amplop) {
      // kilau sebentar tiap beberapa detik, tidak serempak
      const fase = ((t + a.x * 37) % 2600) / 2600;
      a.kilau.setAlpha(fase < 0.18 ? Math.sin((fase / 0.18) * Math.PI) : 0).setScale(fase < 0.18 ? 0.6 + fase * 3 : 1);
      if (Math.abs(kx - a.x) < 9 && Math.abs(ky - a.y) < 8) this.pungut(slug);
    }
    // semua surat sampai: kurir yang lewat dekat menyapa sendiri
    if (this.kurir && this.s.antar.length === SLUG_SURAT.length && !this.s.hadiah) {
      if (Phaser.Math.Distance.Between(p.x, p.y, this.kurir.s.x, this.kurir.s.y) < 40) this.bicaraKurir();
    }
  }
}
