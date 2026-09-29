import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { pasangKedalamanHemat, tidurSaatModal } from './hemat';

export function startGame(parent: string) {
  pasangKedalamanHemat();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#eff1e8',
    // pixelArt + roundPixels: wajib supaya tile tidak diperhalus dan tidak goyang
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    /*
     * Gerak mengikuti waktu nyata tiap frame — tanpa perataan, tanpa langkah tetap.
     *
     * Bawaan Phaser meratakan delta dengan rata-rata 10 frame terakhir. Satu
     * frame yang tersendat (laptop sibuk, tab lain) membuat karakter tetap
     * maju sejauh rata-rata lama padahal waktunya sudah lewat lebih lama —
     * terasa berat — lalu sepuluh frame berikutnya rata-ratanya masih
     * terangkat oleh frame lambat tadi, jadi karakternya ngebut mengejar.
     * `fixedStep` fisika menambah sendatan kedua: di layar yang tidak persis
     * 60 Hz (laptop yang turun ke 48 Hz saat hemat daya) tiap frame kadang
     * menjalankan satu langkah fisika, kadang dua.
     *
     * Delta nyata tetap dibatasi 50 ms di bawah (lihat `batasiDelta`): satu
     * frame yang macet lama tidak boleh melontarkan karakter menembus pagar.
     */
    fps: { smoothStep: false },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, fixedStep: false } },
    scene: [BootScene, PreloadScene, TitleScene, WorldScene, UIScene],
  });
  batasiDelta(game);
  tidurSaatModal(game);
  // pegangan untuk diagnosis dari devtools
  (window as unknown as { __game: Phaser.Game }).__game = game;
  return game;
}

/** Delta terpanjang yang diteruskan ke scene, ms — 3 frame di 60 Hz. */
const DELTA_MAKS = 50;

/**
 * Tanpa smoothStep, Phaser meneruskan delta mentah apa adanya. Callback
 * loop baru terpasang saat game mulai berjalan, jadi dibungkus pada langkah
 * pertamanya.
 */
function batasiDelta(game: Phaser.Game) {
  game.events.once(Phaser.Core.Events.PRE_STEP, () => {
    const loop = game.loop;
    const asli = loop.callback;
    loop.callback = (time: number, delta: number) => asli(time, Math.min(delta, DELTA_MAKS));
  });
}

/** Dipakai panel & menu DOM untuk menyuruh game pindah tempat. */
export function travel(game: Phaser.Game, poiId: string) {
  const world = game.scene.getScene('World') as WorldScene | null;
  world?.travelTo(poiId);
}
