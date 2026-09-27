import Phaser from 'phaser';
import { PLAYER, ROW, TILE, kedalaman, type Dir } from '../config';
import { Player } from './Player';
import { Kisi, spritesheetTeks, tukarWarna } from './piksel';

/**
 * Fakta singkat tentang Rahmat yang diucapkan warga saat diklik. Pengunjung
 * dapat isi portfolio sambil jalan-jalan, tanpa harus membuka panel.
 */
export const FAKTA = [
  'Did you know Rahmat placed 9th at the Monad Blitz Jakarta hackathon?',
  'Rahmat builds for web, mobile, and Web3 — often all three in one project.',
  'Ethernest, his Android wallet, lets you buy ETH with rupiah.',
  'The NFTs in MonadWishes are drawn 100% on-chain — no IPFS at all.',
  'In ChessStake the audience bets on which piece moves next, and an AI plays it.',
  "MarketEdge's WarrenAI answers questions using live market data.",
  'This whole village was drawn in Tiled and runs on Phaser.',
  'Want to reach Rahmat? He is on Telegram as @luwakwhitecofeee.',
  'Taniin is a pixel farming game with an economy on the blockchain.',
];

let giliranFakta = Math.floor(Math.random() * FAKTA.length);
export function faktaBerikutnya() {
  giliranFakta = (giliranFakta + 1) % FAKTA.length;
  return FAKTA[giliranFakta];
}

/**
 * Menjadikan sebuah sprite bisa diajak bicara: diklik → gelembung di atas
 * kepalanya. `kalimat` boleh berupa daftar pembuka milik warga itu; setelah
 * pembukanya habis, ia ganti bercerita fakta.
 *
 * Klik pada warga tidak boleh sekaligus terbaca sebagai "jalan ke sini":
 * preventDefault dicek oleh penangan klik-tanah di WorldScene.
 */
export function bisaDiajak(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, nama: string, pembuka: string[] = []) {
  let ke = 0;
  s.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });
  s.on('pointerup', (p: Phaser.Input.Pointer) => {
    p.event.preventDefault();
    const msg = ke < pembuka.length ? pembuka[ke++] : faktaBerikutnya();
    scene.game.events.emit('mapporto:ucap', { msg, siapa: s, nama });
  });
}

/* ---------------- tekstur warga ---------------- */

/** Warna asli karakter utama (blonde_man.png) → warna pedagang/kurir. */
const TUKAR_PEDAGANG = {
  '#f79617': '#3a2a2a', // rambut → hitam
  '#fb6b1d': '#241a1a',
  '#f9c22b': '#5a4540',
  '#fdcbb0': '#e8b48a', // kulit
  '#fca790': '#c98f6a',
  '#e83b3b': '#3b7dd8', // baju → biru seperti tenda kios
  '#ae2334': '#2a5aa0',
  '#ffffff': '#f2efe6', // garis baju → celemek krem
  '#cd683d': '#4b3f36', // celana
  '#9e4539': '#332a24',
};
const TUKAR_KURIR = {
  '#f79617': '#6b4226', // rambut → cokelat
  '#fb6b1d': '#4a2c18',
  '#f9c22b': '#8a5a36',
  '#fdcbb0': '#f2c29a',
  '#fca790': '#d9a079',
  '#e83b3b': '#e8862a', // seragam oranye pos
  '#ae2334': '#b2601a',
  '#ffffff': '#fff3c4',
  '#cd683d': '#2f4a6b', // celana biru tua
  '#9e4539': '#223449',
};

/**
 * Frame melambai pedagang: frame diam-menghadap-bawah, tangan kanan yang
 * menggantung dihapus, lalu digambar lengan terangkat — dua posisi tangan
 * yang bergantian. Koordinat dibaca dari frame aslinya: tangan kanan di
 * x 20-22 baris 25-27, bahu di baris 24.
 */
function buatLambai(scene: Phaser.Scene) {
  const tx = scene.textures;
  if (tx.exists('pedagang_lambai') || !tx.exists('pedagang')) return;
  const src = tx.get('pedagang').getSourceImage() as HTMLCanvasElement;
  const S = PLAYER.frameWidth;
  const kanvas = tx.createCanvas('pedagang_lambai', S * 2, S)!;
  const ctx = kanvas.getContext();
  const kulit = TUKAR_PEDAGANG['#fdcbb0'];
  const baju = TUKAR_PEDAGANG['#e83b3b'];
  const tinta = '#45293f';
  const tangan = [
    // [lengan (kulit)], [genggaman 2×2 pojok kiri atas]
    { lengan: [[21, 23], [22, 22], [22, 21], [23, 20]], telapak: [23, 18] },
    { lengan: [[21, 23], [22, 22], [23, 21], [24, 20]], telapak: [24, 18] },
  ];
  tangan.forEach((t, f) => {
    const ox = f * S;
    ctx.drawImage(src, 0, 0, S, S, ox, 0, S, S);
    // hapus tangan kanan yang menggantung, rapatkan tepi badan
    ctx.clearRect(ox + 20, 25, 3, 3);
    ctx.fillStyle = tinta;
    ctx.fillRect(ox + 20, 25, 1, 3);
    const isi = new Set<string>();
    const titik: [number, number, string][] = [
      [20, 24, baju],
      [21, 24, baju],
      ...t.lengan.map(([x, y]) => [x, y, kulit] as [number, number, string]),
      [t.telapak[0], t.telapak[1], kulit],
      [t.telapak[0] + 1, t.telapak[1], kulit],
      [t.telapak[0], t.telapak[1] + 1, kulit],
      [t.telapak[0] + 1, t.telapak[1] + 1, kulit],
    ];
    for (const [x, y] of titik) isi.add(`${x},${y}`);
    // garis tepi dulu (hanya di piksel kosong), baru isinya
    const data = ctx.getImageData(ox, 0, S, S).data;
    const kosong = (x: number, y: number) => data[(y * S + x) * 4 + 3] === 0;
    ctx.fillStyle = tinta;
    for (const [x, y] of titik) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isi.has(`${nx},${ny}`) && kosong(nx, ny)) ctx.fillRect(ox + nx, ny, 1, 1);
      }
    }
    for (const [x, y, w] of titik) {
      ctx.fillStyle = w;
      ctx.fillRect(ox + x, y, 1, 1);
    }
  });
  kanvas.add(0, 0, 0, 0, S, S);
  kanvas.add(1, 0, S, 0, S, S);
  kanvas.refresh();
}

export function siapkanTeksturWarga(scene: Phaser.Scene) {
  const S = PLAYER.frameWidth;
  tukarWarna(scene, 'player', 'pedagang', TUKAR_PEDAGANG, S, S);
  tukarWarna(scene, 'player', 'kurir', TUKAR_KURIR, S, S);
  buatLambai(scene);
  if (!scene.anims.exists('pedagang_lambai')) {
    scene.anims.create({
      key: 'pedagang_lambai',
      frames: scene.anims.generateFrameNumbers('pedagang_lambai', { start: 0, end: 1 }),
      frameRate: 5,
      repeat: 5,
    });
  }
  Player.registerAnimations(scene, 'pedagang');
  Player.registerAnimations(scene, 'kurir');
  // amplop kecil yang muncul di atas kepala kurir saat mengantar
  spritesheetTeks(
    scene,
    'amplop',
    [
      [
        'kkkkkkkkk',
        'kwwwwwwwk',
        'kkwwwwwkk',
        'kwkwwwkwk',
        'kwwkrkwwk',
        'kwwwwwwwk',
        'kkkkkkkkk',
      ],
    ],
    { k: '#1b2416', w: '#fbf6e6', r: '#e0563f' }
  );
}

/** Bayangan kaki, sama dengan milik pemain. */
function bayanganDi(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite) {
  const b = scene.add.sprite(s.x, s.y, 'player_shadow', 0).setAlpha(0.55);
  b.setDepth(s.depth - 0.5);
  return b;
}

/* ---------------- pedagang ---------------- */

/**
 * Penjaga kios Tech Stack. Berdiri di SAMPING kios, bukan di balik mejanya:
 * tenda kios menempel langsung ke meja (celahnya 3 px), jadi siapa pun yang
 * berdiri di baliknya tertutup tenda sampai ke leher dan tertutup meja dari
 * pinggang — yang tersisa cuma garis. Melambai tiap kali pemain lewat dekat.
 */
export class Pedagang {
  readonly s: Phaser.GameObjects.Sprite;
  private lambaiLagi = 0;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    kaki: number,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    const y = kaki - PLAYER.baseY;
    this.s = scene.add.sprite(x, y, 'pedagang', ROW.idle.down * 4).setDepth(kedalaman(kaki));
    bayanganDi(scene, this.s);
    this.s.play('pedagang_idle_down');
    this.s.on('animationcomplete-pedagang_lambai', () => this.s.play('pedagang_idle_down'));
    bisaDiajak(scene, this.s, 'Merchant', [
      'Welcome! Everything Rahmat builds with is on this stall — Next.js, Kotlin, Solidity and more.',
      'Step up to the front of the stall to see the full tech stack.',
    ]);
    scene.events.on('update', this.detak, this);
  }

  private detak(t: number) {
    const p = this.pemain();
    if (!p || t < this.lambaiLagi) return;
    if (Phaser.Math.Distance.Between(p.x, p.y, this.s.x, this.s.y) < 64) {
      this.s.play('pedagang_lambai');
      this.lambaiLagi = t + 7000;
    }
  }
}

/* ---------------- kurir ---------------- */

/**
 * Kurir pos yang berkeliling dari pintu ke pintu. Rutenya dicari BFS di
 * atas grid tabrakan peta, jadi ia selalu lewat jalan dan tidak pernah
 * menembus rumah; berhenti sebentar di tiap pintu, amplopnya muncul, lalu
 * lanjut ke rumah berikutnya.
 */
export class Kurir {
  readonly s: Phaser.GameObjects.Sprite;
  private bayangan: Phaser.GameObjects.Sprite;
  private rute: Phaser.Math.Vector2[] = [];
  private ke = 0;
  private berhentiSampai = 0;
  private arah: Dir = 'down';
  private tujuanKe = 0;
  private readonly laju = 30;

  constructor(
    private scene: Phaser.Scene,
    private kisi: Kisi,
    private pintu: [number, number][]
  ) {
    const [tx, ty] = pintu[0];
    const a = this.tengah(tx, ty);
    this.s = scene.add.sprite(a.x, a.y, 'kurir', 0);
    this.bayangan = bayanganDi(scene, this.s);
    bisaDiajak(scene, this.s, 'Courier', ['Mail for everyone! I deliver between all the houses in this village.']);
    this.tujuanKe = 1;
    this.rencanakan();
    scene.events.on('update', this.detak, this);
  }

  /** Pusat sprite untuk berdiri di sebuah petak (kakinya di dasar petak). */
  private tengah(tx: number, ty: number) {
    return new Phaser.Math.Vector2(tx * TILE + TILE / 2, (ty + 1) * TILE - 2 - PLAYER.baseY);
  }

  private rencanakan() {
    const dari = this.pintu[(this.tujuanKe - 1 + this.pintu.length) % this.pintu.length];
    const ke = this.pintu[this.tujuanKe % this.pintu.length];
    const jalur = this.kisi.jalur(dari, ke);
    this.rute = (jalur ?? [ke]).map(([x, y]) => this.tengah(x, y));
    this.ke = 0;
  }

  private detak(t: number, delta: number) {
    const s = this.s;
    if (t < this.berhentiSampai) return;
    const target = this.rute[this.ke];
    if (!target) {
      // sampai di pintu: menghadap rumah, amplop muncul, lalu lanjut
      this.berhentiSampai = t + 2600;
      this.arah = 'up';
      s.play('kurir_idle_up', true);
      this.amplop();
      this.tujuanKe = (this.tujuanKe + 1) % this.pintu.length;
      this.rencanakan();
      return;
    }
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const jarak = Math.hypot(dx, dy);
    const langkah = (this.laju * Math.min(delta, 100)) / 1000;
    if (jarak <= langkah) {
      s.setPosition(target.x, target.y);
      this.ke++;
    } else {
      s.x += (dx / jarak) * langkah;
      s.y += (dy / jarak) * langkah;
      const arah: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      this.arah = arah;
      s.play(`kurir_walk_${arah}`, true);
    }
    const d = kedalaman(s.y + PLAYER.baseY);
    s.setDepth(d);
    this.bayangan.setPosition(s.x, s.y).setDepth(d - 0.5).setFrame(s.frame.name);
  }

  private amplop() {
    const a = this.scene.add.image(this.s.x, this.s.y - 20, 'amplop').setDepth(this.s.depth + 1);
    this.scene.tweens.add({
      targets: a,
      y: a.y - 8,
      alpha: { from: 1, to: 0 },
      delay: 900,
      duration: 900,
      onComplete: () => a.destroy(),
    });
  }
}
