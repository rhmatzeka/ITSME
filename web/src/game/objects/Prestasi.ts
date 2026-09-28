import Phaser from 'phaser';
import { DEPTH, LAPANGAN, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

/**
 * Isi prasasti piala — diambil dari halaman CV (cv.md), bukan karangan:
 * satu penghargaan dan satu pengalaman kerja yang memang tercantum di sana.
 */
const PRESTASI = [
  'Trophy: 9th Place at the Monad Blitz Jakarta Hackathon, with MonadWishes.',
  'MonadWishes: birthday card NFTs drawn fully on-chain, kept in time-locked vaults that earn staking yield on Monad.',
  'Experience: intern at PT Way Abung Global Network (2022), network technician and WiFi support.',
  'The full CV is inside — walk up to the door of this house.',
];

/**
 * Piala emas di atas tiang kayu berpelat kuningan, di kiri pintu rumah CV.
 * Sesekali kilau kecil berkedip di mangkuknya; diklik, ia bercerita tentang
 * penghargaan dan pengalaman kerja Rahmat.
 */
export class Prestasi {
  private piala: Phaser.GameObjects.Image;
  private ke = 0;

  constructor(
    private scene: Phaser.Scene,
    blocked?: Phaser.Physics.Arcade.StaticGroup
  ) {
    spritesheetTeks(
      scene,
      'piala',
      [
        [
          '....kkkyykkkk...',
          '..kkyyyyyyyoykk.',
          '.kykyYYyyyyoykyk',
          '.kykyYyyyyyoykyk',
          '.kyyyYyyyyyoykyk',
          '..kyyyyYyyyokyk.',
          '...kyyyyoyyokk..',
          '....kyyyyyyk....',
          '.....kkyyyk.....',
          '......kyyyk.....',
          '.....kkyyykk....',
          '....kyyyyyyyk...',
          '...kkyyyyyyykk..',
          '..kbbbbbbbbbbbk.',
          '..kbbbbbbbbbbbk.',
          '...kccccccccBk..',
          '...kccccccccBk..',
          '...kclllllllBk..',
          '...kclLLLLLlBk..',
          '...kclLLLLllBk..',
          '...kclllllllBk..',
          '...kccccccccBk..',
          '..kkccccccccBkk.',
          '.kbbbbbbbbbbbbbk',
          '.kbbbbbbbbbbbbbk',
          '..kkkkkkkkkkkkk.',
        ],
      ],
      { B: '#7a4a24', L: '#8a6a3a', Y: '#fff2b0', b: '#a8703a', c: '#c89060', k: '#2a2420', l: '#e8d9a8', o: '#c8961c', y: '#f2c94c' }
    );
    spritesheetTeks(scene, 'kilau_piala', [['..y..', '..Y..', 'yYWYy', '..Y..', '..y..']], {
      y: '#f2c94c',
      Y: '#fff2b0',
      W: '#ffffff',
    });
    const { x, kaki } = LAPANGAN.prestasi;
    this.piala = scene.add.image(x, kaki, 'piala').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 12, 3);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    this.piala.setInteractive({ useHandCursor: true });
    this.piala.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      scene.game.events.emit('mapporto:ucap', {
        msg: PRESTASI[this.ke++ % PRESTASI.length],
        siapa: this.piala,
        nama: 'Trophy',
      });
    });
    scene.time.addEvent({ delay: 2600, loop: true, callback: () => this.kilau() });
  }

  /** Bintang kecil yang berkedip di salah satu sisi mangkuk piala. */
  private kilau() {
    const { x, kaki } = LAPANGAN.prestasi;
    const k = this.scene.add
      .image(x + Phaser.Math.Between(-4, 3), kaki - 22 + Phaser.Math.Between(0, 4), 'kilau_piala')
      .setDepth(DEPTH.above + 20)
      .setScale(0.3);
    this.scene.tweens.add({ targets: k, scale: 1, duration: 160, yoyo: true, hold: 120, onComplete: () => k.destroy() });
  }
}
