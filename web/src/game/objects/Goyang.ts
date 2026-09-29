import Phaser from 'phaser';
import { srek } from '../bunyi';
import { DEPTH, PLAYER, TILE } from '../config';

/**
 * Tile tanaman di layer `lantai` yang bisa bergoyang (gid di atlas): semak
 * hijau, tunas, bunga merah muda, bunga putih. Semak juga merontokkan
 * sehelai-dua daun waktu diterobos.
 */
const TANAMAN: Record<number, { daun: boolean }> = {
  90: { daun: true },
  91: { daun: false },
  92: { daun: false },
  233: { daun: false },
};

/** Urutan frame satu kali goyang: condong kanan, tegak, kiri, tegak, kanan tipis, tegak. */
const AYUN = [1, 0, 2, 0, 3, 0];
const LAMA_FRAME = 85;

interface Rumpun {
  tile: Phaser.Tilemaps.Tile;
  gid: number;
  sibuk: boolean;
}

/**
 * Semak dan bunga yang bergoyang waktu dilewati.
 *
 * Tanamannya tile peta, dan tile tidak bisa bergerak. Jadi saat kaki pemain
 * masuk ke petaknya, tile itu disembunyikan sebentar dan diganti sprite
 * dari gambar yang sama, yang diayun beberapa kali lalu dikembalikan.
 *
 * Condongnya digambar sekali saat dimuat, per baris piksel: pucuknya
 * bergeser dua piksel, tengahnya satu, pangkalnya diam — bukan diputar,
 * karena memutar pixel art di skala sekecil ini membuat pikselnya bergerigi.
 */
export class Goyang {
  private rumpun = new Map<string, Rumpun>();
  private pool: Phaser.GameObjects.Sprite[] = [];
  private daun: Phaser.GameObjects.Rectangle[] = [];
  private tadi = '';

  constructor(
    private scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    private pemain: () => Phaser.GameObjects.Sprite | undefined
  ) {
    const lantai = map.getLayer('lantai');
    if (!lantai) return;
    const firstgid = map.tilesets[0].firstgid;
    for (const baris of lantai.data) {
      for (const t of baris) {
        if (!t || t.index < 0) continue;
        const gid = t.index - firstgid + 1;
        if (!TANAMAN[gid]) continue;
        this.buatCondong(map, gid);
        this.rumpun.set(`${t.x},${t.y}`, { tile: t, gid, sibuk: false });
      }
    }
    for (let i = 0; i < 4; i++) this.pool.push(scene.add.sprite(0, 0, '__DEFAULT').setOrigin(0).setDepth(DEPTH.floor + 0.1).setVisible(false));
    for (let i = 0; i < 6; i++) this.daun.push(scene.add.rectangle(0, 0, 1, 1, 0x4f9a3a).setOrigin(0).setDepth(DEPTH.above + 4).setVisible(false));
    scene.events.on('update', this.detak, this);
  }

  /** Lembar empat frame untuk satu jenis tanaman: tegak, condong kanan, kiri, kanan tipis. */
  private buatCondong(map: Phaser.Tilemaps.Tilemap, gid: number) {
    const key = `goyang_${gid}`;
    const tx = this.scene.textures;
    if (tx.exists(key)) return;
    const ts = map.tilesets[0];
    const src = tx.get('atlas').getSourceImage() as HTMLImageElement;
    const lokal = gid - 1;
    const sx = ts.tileMargin + (lokal % ts.columns) * (TILE + ts.tileSpacing);
    const sy = ts.tileMargin + Math.floor(lokal / ts.columns) * (TILE + ts.tileSpacing);
    const kanvas = tx.createCanvas(key, TILE * 4, TILE)!;
    const ctx = kanvas.getContext();
    // pergeseran per baris untuk tiap frame: pucuk jauh, pangkal diam
    const geser = [(_y: number) => 0, (y: number) => (y < 6 ? 2 : y < 11 ? 1 : 0), (y: number) => (y < 6 ? -2 : y < 11 ? -1 : 0), (y: number) => (y < 8 ? 1 : 0)];
    geser.forEach((g, f) => {
      for (let y = 0; y < TILE; y++) ctx.drawImage(src, sx, sy + y, TILE, 1, f * TILE + g(y), y, TILE, 1);
      kanvas.add(f, 0, f * TILE, 0, TILE, TILE);
    });
    kanvas.refresh();
  }

  private detak() {
    const p = this.pemain();
    const body = p?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!p || !body || !p.visible) return;
    const kx = Math.floor(p.x / TILE);
    const ky = Math.floor((p.y + PLAYER.baseY - 2) / TILE);
    const kunci = `${kx},${ky}`;
    if (kunci === this.tadi) return;
    this.tadi = kunci;
    if (Math.hypot(body.velocity.x, body.velocity.y) < 5) return;
    const r = this.rumpun.get(kunci);
    if (r && !r.sibuk) this.ayun(r, body.velocity.x);
  }

  /** Sembunyikan tile-nya, ayun sprite penggantinya, lalu kembalikan. */
  private ayun(r: Rumpun, arah: number) {
    const s = this.pool.find((o) => !o.visible);
    if (!s) return;
    r.sibuk = true;
    const t = r.tile;
    t.setVisible(false);
    s.setTexture(`goyang_${r.gid}`, 0)
      .setPosition(t.pixelX, t.pixelY)
      .setFlipX(t.flipX)
      .setVisible(true);
    // didorong dari kiri, pucuknya condong ke kanan dulu
    const urut = arah < 0 ? AYUN.map((f) => (f === 1 ? 2 : f === 2 ? 1 : f)) : AYUN;
    let i = 0;
    this.scene.time.addEvent({
      delay: LAMA_FRAME,
      repeat: urut.length,
      callback: () => {
        if (i < urut.length) s.setFrame(urut[i++]);
        else {
          s.setVisible(false);
          t.setVisible(true);
          r.sibuk = false;
        }
      },
    });
    srek(t.pixelX + TILE / 2, t.pixelY + TILE / 2);
    if (TANAMAN[r.gid].daun) this.rontok(t.pixelX + TILE / 2, t.pixelY + 6);
  }

  /** Satu dua helai daun kecil terlempar dari semak, lalu jatuh. */
  private rontok(x: number, y: number) {
    for (let n = Phaser.Math.Between(1, 2); n > 0; n--) {
      const d = this.daun.find((o) => !o.visible);
      if (!d) return;
      const kiri = Math.random() < 0.5 ? -1 : 1;
      d.setPosition(x, y).setVisible(true).setAlpha(1).setFillStyle(Math.random() < 0.5 ? 0x4f9a3a : 0x7ac04a);
      this.scene.tweens.add({ targets: d, x: x + kiri * Phaser.Math.Between(5, 9), duration: 700, ease: 'Sine.easeOut' });
      this.scene.tweens.add({
        targets: d,
        y: { from: y, to: y + 8 },
        duration: 700,
        ease: (v: number) => -4 * v * (1 - v) * 0.8 + v,
        onComplete: () =>
          this.scene.tweens.add({ targets: d, alpha: 0, delay: 500, duration: 400, onComplete: () => d.setVisible(false) }),
      });
    }
  }
}
