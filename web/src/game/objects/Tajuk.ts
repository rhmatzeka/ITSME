import Phaser from 'phaser';
import { cuaca } from '../cuaca';

/**
 * Tile tajuk pohon (gid di atlas) dan seberapa jauh ia ikut bergoyang:
 * 1 = pucuk, 0,6 = tengah tajuk. Baris terbawah tajuk dan batangnya tidak
 * ada di sini: mereka diam, jadi pohonnya condong dari pangkal, bukan
 * bergeser utuh.
 */
const BOBOT: Record<number, number> = {
  // pohon rimbun berdahan (2×3)
  43: 1, 44: 1, 47: 0.6, 48: 0.6,
  // pohon ayunan ban (2×3)
  41: 1, 42: 1, 45: 0.6, 46: 0.6,
  // pohon bulat kecil (2×3)
  104: 1, 105: 1, 112: 0.6, 113: 0.6,
  // cemara (2×2)
  114: 1, 115: 1,
  // pohon besar (4×5)
  75: 1, 76: 1, 77: 1, 78: 1, 79: 1, 80: 1, 81: 1, 82: 1, 86: 0.6, 87: 0.6, 88: 0.6, 89: 0.6,
};

/** Lapisan tilemap yang memuat tajuk (yang lain digambar per tile: lihat `gambar`). */
const LAPISAN = ['di atas map 1', 'aset kedua'];

interface Potong {
  /** Titik tengahnya di dunia: menentukan kapan embusan angin sampai. */
  cx: number;
  bobot: number;
  geser: number;
  pasang: (dx: number) => void;
}

/**
 * Tajuk pohon yang bergoyang pelan diterpa angin.
 *
 * Pohonnya tile peta. Yang digeser cuma tile tajuknya, satu piksel ke kiri
 * atau kanan: pucuk lebih sering daripada tengah, pangkal tidak pernah —
 * cara yang sama dengan semak di Goyang.ts, tanpa memutar gambarnya. Anginnya
 * datang bergelombang dari barat ke timur (searah awan), jadi pohon-pohon
 * bergoyang bergiliran dan ada jeda tenang di antaranya; saat gerimis
 * embusannya lebih kuat.
 */
export class Tajuk {
  private potong: Potong[] = [];

  constructor(
    private scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    /** Tile padat yang digambar satu per satu oleh WorldScene.gambarPadat(). */
    gambar: { img: Phaser.GameObjects.Image; gid: number }[]
  ) {
    const firstgid = map.tilesets[0].firstgid;
    for (const nama of LAPISAN) {
      const l = map.getLayer(nama);
      if (!l) continue;
      for (const baris of l.data) {
        for (const t of baris) {
          const bobot = t && t.index >= 0 ? BOBOT[t.index - firstgid + 1] : undefined;
          if (!bobot) continue;
          const asal = t.pixelX;
          // tilemap menggambar tiap tile di pixelX-nya: cukup itu yang digeser
          this.potong.push({ cx: asal + t.width / 2, bobot, geser: 0, pasang: (dx) => (t.pixelX = asal + dx) });
        }
      }
    }
    for (const { img, gid } of gambar) {
      const bobot = BOBOT[gid];
      if (!bobot) continue;
      const asal = img.x;
      this.potong.push({ cx: asal, bobot, geser: 0, pasang: (dx) => img.setX(asal + dx) });
    }
    if (!this.potong.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // sepuluh kali sedetik sudah cukup: gesernya satu piksel, bukan gerak halus
    const jam = scene.time.addEvent({ delay: 100, loop: true, callback: () => this.tiup() });
    scene.events.once('shutdown', () => jam.remove());
  }

  private tiup() {
    const s = this.scene.time.now / 1000;
    const kuat = 1.25 + cuaca.hujan * 0.6;
    for (const p of this.potong) {
      // embusan: gelombang lambat yang merambat ke timur, nol di antara embusan
      const embus = Math.max(0, Math.sin(s * 0.5 - p.cx * 0.006));
      const ayun = Math.sin(s * 2.1 - p.cx * 0.03);
      const dx = Math.round(Phaser.Math.Clamp(ayun * embus * kuat * p.bobot, -1, 1));
      if (dx === p.geser) continue;
      p.geser = dx;
      p.pasang(dx);
    }
  }
}
