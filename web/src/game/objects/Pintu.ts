import Phaser from 'phaser';
import { DEPTH, TILE, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/** Sama dengan cahaya jendela: ADD di atas tirai malam. */
const KEDALAMAN_CAHAYA = DEPTH.above + 60;

/**
 * Daun pintu tiap rumah, 12×14 piksel, dibaca dari map_full.png. Keempatnya
 * berengsel di kiri — gagangnya di kanan — jadi saat terbuka daunnya
 * menyempit ke kiri dan ruangan di dalam tampak dari kanan.
 */
const DAUN: Record<string, { x: number; y: number; pola: string[]; palet: Record<string, string> }> = {
  rumah_projects: {
    x: 469,
    y: 79,
    pola: [
      'aaaaaaaaaaaa',
      'abbbbaabbbba',
      'acddceecddca',
      'efggfeefggfe',
      'ehggheehgghe',
      'ehggheehgghe',
      'ghgghgghgghg',
      'ghgghgghgijk',
      'glgglgglgmnm',
      'glgglgglgglg',
      'glgglgglgglg',
      'ohoohgghooho',
      'oppppooppppo',
      'qqqqqqqqqqqq',
    ],
    palet: {
      a: '#54b094', b: '#1e6c55', c: '#32826a', d: '#a7f7de', e: '#6dcbaf', f: '#409a7f', g: '#8deccf', h: '#51b093',
      i: '#98b3ab', j: '#6e968a', k: '#4f6f65', l: '#65c4a7', m: '#6dceb0', n: '#37977a', o: '#7adbbd', p: '#419f82', q: '#5db99d',
    },
  },
  rumah_about: {
    x: 181,
    y: 249,
    pola: [
      'aababbbbabaa',
      'acccccccccca',
      'bdbbbbbbbbdb',
      'bdbeeffeebdb',
      'egeffffffege',
      'edeffffffede',
      'eghffffffhge',
      'fghffffffijf',
      'hgfffffffjkh',
      'fghffffffegf',
      'eghffffffhge',
      'edeeeeeeeede',
      'lmmmmmmmmmml',
      'lnllnllnllnl',
    ],
    palet: {
      a: '#357a5e', b: '#439071', c: '#1a593f', d: '#247353', e: '#52a584', f: '#53c094', g: '#3b8a6a',
      h: '#73cfaa', i: '#ffaf00', j: '#b27a00', k: '#82611a', l: '#3d8669', m: '#215a43', n: '#276b50',
    },
  },
  rumah_cv: {
    x: 421,
    y: 306,
    pola: [
      'abaaabbaaaba',
      'cdeddeeddedc',
      'cfaabaabaafc',
      'gfccccccccfg',
      'cfccccccccfc',
      'cfccccccccfc',
      'ghcccccccchg',
      'chccccccccic',
      'chccccccjkkc',
      'ghccccccgghg',
      'gfccccccccfg',
      'gfccccccccfg',
      'ldededdededl',
      'llllllllllll',
    ],
    palet: {
      a: '#bff7e0', b: '#d9ffef', c: '#9bf2ce', d: '#66a78b', e: '#549176', f: '#72bb9c',
      g: '#87dab8', h: '#7eccab', i: '#bcbcbc', j: '#ffffff', k: '#e1e1e1', l: '#78c8a7',
    },
  },
  rumah_contact: {
    x: 293,
    y: 443,
    pola: [
      'aabbcddcbbaa',
      'abedeccedeba',
      'bcfcfccfcfcb',
      'bcegeggegecb',
      'cdhghgghghdc',
      'cgididdidigc',
      'cgddddddddjc',
      'cgggggggjjkc',
      'ccededdedecc',
      'bcfgfggfgfcb',
      'bcegeggegecb',
      'achchcchchca',
      'laiciccicial',
      'llllllllllll',
    ],
    palet: {
      a: '#d08b2a', b: '#e2962c', c: '#f2a02c', d: '#ffb651', e: '#b07828', f: '#cd8b2e',
      g: '#ffa82e', h: '#8b5e1d', i: '#e69626', j: '#505050', k: '#404040', l: '#ac7424',
    },
  },
};

/** Lebar daun pintu tiap frame membuka; frame 0 = tertutup (gambar peta apa adanya). */
const LEBAR_DAUN = [12, 8, 4, 2];

/** Jarak pemain ke titik masuk yang membuka pintu, dan yang menutupnya lagi, px. */
const BUKA = 38;
const TUTUP = 46;

/** Ruangan di balik pintu, baris demi baris dari atas: gelap di atas, lantai kayu di bawah. */
const RUANG = ['#24170f', '#24170f', '#2b1c12', '#2b1c12', '#331f14', '#331f14', '#3a2418', '#3a2418', '#42291b', '#4a2f1e', '#553621', '#5e3c24', '#8a5a34', '#a8703a'];

/** Huruf warna ruangan per baris — bukan huruf, supaya tidak bentrok dengan palet pintu. */
const RUANG_HURUF = '0123456789+*#@';

interface SatuPintu {
  s: Phaser.GameObjects.Sprite;
  cahaya: Phaser.GameObjects.Image;
  titik: { x: number; y: number };
  terbuka: boolean;
  gerak?: Phaser.Tweens.Tween;
}

/**
 * Pintu rumah yang terbuka sendiri saat pemain berjalan ke lingkaran kuning
 * di depannya, dan menutup lagi saat pemain pergi.
 *
 * Tile pintunya tidak diubah; yang ditumpuk di atasnya sprite 12×14 seukuran
 * daun pintu: daun yang menyempit ke sisi engsel (warnanya disalin dari
 * gambar pintu aslinya, sedikit digelapkan karena menghadap samping) dan
 * ruangan remang di baliknya. Malam hari ruangan itu terang oleh lampu di
 * dalam — cahayanya jatuh keluar ke tanah depan pintu.
 */
export class Pintu {
  private pintu: SatuPintu[] = [];

  constructor(
    private scene: Phaser.Scene,
    masuk: { id: string; x: number; y: number }[],
    private pemain: () => Phaser.GameObjects.Components.Transform | undefined,
    private gelap: () => number
  ) {
    this.buatCahaya();
    for (const m of masuk) {
      const d = DAUN[m.id];
      if (!d) continue;
      const key = `pintu_${m.id}`;
      spritesheetTeks(scene, key, this.bingkai(d.pola), { ...d.palet, ...this.paletRuang(d.palet) });
      // tile pintu ada di layer `padat`, yang diurutkan menurut tepi bawah petaknya
      const bawah = (Math.floor((d.y + d.pola.length - 1) / TILE) + 1) * TILE;
      const s = scene.add.sprite(d.x, d.y, key, 0).setOrigin(0).setDepth(kedalaman(bawah) + 0.2).setVisible(false);
      const cahaya = scene.add
        .image(d.x + 6, d.y + 14, 'pintu_cahaya')
        .setScale(1 / 4)
        .setOrigin(0.5, 0.25)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(KEDALAMAN_CAHAYA)
        .setAlpha(0);
      this.pintu.push({ s, cahaya, titik: { x: m.x, y: m.y }, terbuka: false });
    }
    scene.events.on('update', this.detak, this);
  }

  /**
   * Frame membuka dari gambar pintu tertutup: daun yang dipipihkan ke sisi
   * engsel memakai huruf palet aslinya dalam huruf kapital (versi gelap),
   * sisanya ruangan di dalam, satu warna per baris (RUANG_HURUF).
   */
  private bingkai(pola: string[]) {
    const W = pola[0].length;
    return LEBAR_DAUN.map((L, f) =>
      pola.map((baris, y) => {
        if (f === 0) return '.'.repeat(W);
        let hasil = '';
        for (let x = 0; x < W; x++) {
          if (x < L) {
            // daun yang dipipihkan: kolom asli diambil merata
            const asal = L === 1 ? 0 : Math.round((x * (W - 1)) / (L - 1));
            hasil += baris[asal].toUpperCase();
          } else if (x === L && L < W) {
            hasil += '~'; // bayangan tepi daun di lantai ruangan
          } else {
            hasil += RUANG_HURUF[y];
          }
        }
        return hasil;
      })
    );
  }

  /** Palet daun yang menghadap samping (huruf kapital = versi gelap) + warna ruangan. */
  private paletRuang(palet: Record<string, string>) {
    const hasil: Record<string, string> = { '~': '#140c08' };
    for (const [h, w] of Object.entries(palet)) {
      const c = Phaser.Display.Color.HexStringToColor(w);
      c.darken(18);
      hasil[h.toUpperCase()] = Phaser.Display.Color.RGBToString(c.red, c.green, c.blue, 255, '#');
    }
    RUANG.forEach((w, i) => (hasil[RUANG_HURUF[i]] = w));
    return hasil;
  }

  private buatCahaya() {
    const tx = this.scene.textures;
    if (tx.exists('pintu_cahaya')) return;
    // sorot hangat yang keluar dari pintu: sempit di ambang, melebar di tanah
    const w = 40 * 4;
    const h = 32 * 4;
    const k = tx.createCanvas('pintu_cahaya', w, h)!;
    const ctx = k.getContext();
    const g = ctx.createRadialGradient(w / 2, h * 0.25, 0, w / 2, h * 0.25, w / 2);
    g.addColorStop(0, 'rgba(255, 196, 110, 0.75)');
    g.addColorStop(0.35, 'rgba(255, 170, 90, 0.3)');
    g.addColorStop(1, 'rgba(255, 150, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    k.refresh();
  }

  private detak() {
    const p = this.pemain();
    const malam = Phaser.Math.Clamp((this.gelap() - 0.2) / 0.5, 0, 1);
    for (const pt of this.pintu) {
      const jarak = p ? Phaser.Math.Distance.Between(p.x, p.y, pt.titik.x, pt.titik.y) : Infinity;
      if (!pt.terbuka && jarak < BUKA) this.gerak(pt, true);
      else if (pt.terbuka && jarak > TUTUP) this.gerak(pt, false);
      const lebar = pt.s.visible ? Number(pt.s.frame.name) / (LEBAR_DAUN.length - 1) : 0;
      pt.cahaya.setAlpha(malam * lebar);
    }
  }

  /** Membuka atau menutup: frame demi frame, 55 ms per langkah. */
  private gerak(pt: SatuPintu, buka: boolean) {
    pt.terbuka = buka;
    pt.gerak?.stop();
    const akhir = LEBAR_DAUN.length - 1;
    const dari = pt.s.visible ? Number(pt.s.frame.name) : 0;
    const ke = buka ? akhir : 0;
    const langkah = { f: dari };
    pt.s.setVisible(true);
    pt.gerak = this.scene.tweens.add({
      targets: langkah,
      f: ke,
      duration: Math.abs(ke - dari) * 55,
      onUpdate: () => pt.s.setFrame(Math.round(langkah.f)),
      onComplete: () => {
        pt.s.setFrame(ke);
        if (!buka) pt.s.setVisible(false);
      },
    });
  }
}
