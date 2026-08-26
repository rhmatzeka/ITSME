import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

export function startGame(parent: string) {
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
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: [BootScene, PreloadScene, TitleScene, WorldScene, UIScene],
  });
  // pegangan untuk diagnosis dari devtools
  (window as unknown as { __game: Phaser.Game }).__game = game;
  return game;
}

/** Dipakai panel & menu DOM untuk menyuruh game pindah tempat. */
export function travel(game: Phaser.Game, poiId: string) {
  const world = game.scene.getScene('World') as WorldScene | null;
  world?.travelTo(poiId);
}
