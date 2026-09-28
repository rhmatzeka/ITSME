import Phaser from 'phaser';
import { kertas } from '../bunyi';
import { DEPTH, UTARA, kedalaman } from '../config';
import { spritesheetTeks } from './piksel';

interface Projek {
  title: string;
  summary: string;
  year?: number;
}

/** Kalimat pertama ringkasan, dipotong kalau masih terlalu panjang untuk gelembung. */
function ringkas(teks: string, maks = 110) {
  // tanpa regex lookbehind: Safari lama gagal mem-parse-nya, dan itu menjatuhkan seluruh modul
  const titik = teks.indexOf('. ');
  const satu = titik > 0 ? teks.slice(0, titik + 1) : teks;
  return satu.length <= maks ? satu : `${satu.slice(0, maks - 1).replace(/\s+\S*$/, '')}…`;
}

/**
 * Papan pengumuman desa di dekat rumah Projects.
 *
 * Isinya bukan karangan: kabarnya diambil dari content.json, sumber yang
 * sama dengan panel Projects — projek baru di src/content/projects/ ikut
 * tertempel di sini tanpa menyentuh kode. Tiap klik membacakan satu kabar;
 * yang terakhir mengarahkan ke rumah Projects di sebelahnya. Tanda seru
 * kecil di atasnya memanggil pengunjung sampai papannya pernah dibaca.
 */
export class Papan {
  private ke = 0;

  constructor(scene: Phaser.Scene, blocked?: Phaser.Physics.Arcade.StaticGroup) {
    spritesheetTeks(
      scene,
      'papan_desa',
      [
        [
          '......kkkkkkkkkkkkkkkkkk......',
          '.....kzzzzzzzzzzzzzzzzzzk.....',
          '...ZkzZzzZzzZzzZzzZzzZzzZk.Z..',
          '...kzzzzzzzzzzzzzzzzzzzzzzk...',
          '..kZZZZZZZZZZZZZZZZZZZZZZZZk..',
          '.kkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
          '..kkkkkkkkkkkkkkkkkkkkkkkkkk..',
          '..kbkkkkkkkkkkkkkkkkkkkkkkbk..',
          '..kbkqqqqqqqqkkkNkkkqqqqqkbk..',
          '..kbkkkkxxkkkkjjjjjkkkxkkkbk..',
          '..kbkkiiiiiikktttttkkffffkbk..',
          '..kbkkkkkkkkkkjjjjjkkffufkbk..',
          '..kbkkiiiiiikkttttjkkfFffkbk..',
          '..kbkkttttttkkjjjjjkkFFFFkbk..',
          '..kbkkiiiiiikkkkkkkkkFFFFkbk..',
          '..kbkkttttttkqqqqqqqkkkkkkbk..',
          '..kbkkiiiiiikkkkUkkkkqqqqkbk..',
          '..kbkkttttiikkllllllkkkNkkbk..',
          '..kbkkkkkkkkkkttttttkkHHHkbk..',
          '..kbkqqqqqqqqkllllllkktttkbk..',
          '..kbkqqqqQqqqktttttlkkHHHkbk..',
          '..kbkqqqqqqqqkllllllkkkkkkbk..',
          '..kbkqqqqqqqqkkkkkkkkqqqqkbk..',
          '..kbkkkkkkkkkkkkkkkkkkkkkkbk..',
          '..kBBBBBBBBBBBBBBBBBBBBBBBBk..',
          '..kkkkkkkkkkkkkkkkkkkkkkkkkk..',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kbBk............kbBk.....',
          '.....kkkk............kkkk.....',
        ],
      ],
      { B: '#7a4a24', F: '#58a84a', H: '#f4b8c8', N: '#4a7fd6', Q: '#b08850', U: '#f2b233', Z: '#6a201e', b: '#a8703a', f: '#7ec0ff', i: '#f4f1ea', j: '#f7d77a', k: '#3a2418', l: '#a8e0a0', q: '#c9a36b', t: '#9a948a', u: '#ffe38a', x: '#e0463a', z: '#8a2e2a' }
    );
    // balon kecil bertanda seru, gayanya sama dengan balon obrolan warga
    spritesheetTeks(scene, 'tanda_papan', [[
      '.kkkkkkk.',
      'kWWWxWWWk',
      'kWWWxWWWk',
      'kWWWxWWWk',
      'kWWWWWWWk',
      'kWWWxWWWk',
      '.kkWkkkk.',
      '..kWk....',
      '..kk.....',
    ]], { W: '#fbf6e6', k: '#3a2418', x: '#e0463a' });

    const { x, kaki } = UTARA.papan;
    const papan = scene.add.sprite(x, kaki, 'papan_desa').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 20, 4);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    // di atas pojok kanan atap, ekornya menunjuk ke papan
    const tanda = scene.add.image(x + 9, kaki - 33, 'tanda_papan').setOrigin(0.5, 1).setDepth(DEPTH.above + 45);
    scene.tweens.add({ targets: tanda, y: tanda.y - 3, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const projek = ((scene.cache.json.get('content') as { projects?: Projek[] } | undefined)?.projects ?? []).filter(
      (p) => p.title && p.summary
    );
    const kabar = [
      ...projek.map((p) => `${p.title}${p.year ? ` (${p.year})` : ''}: ${ringkas(p.summary)}`),
      'The full stories are inside the Projects house next door.',
    ];

    papan.setInteractive({ useHandCursor: true });
    papan.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      kertas(papan.x, papan.y - 10);
      if (tanda.active) {
        scene.tweens.killTweensOf(tanda);
        tanda.destroy();
      }
      scene.game.events.emit('mapporto:ucap', { msg: kabar[this.ke++ % kabar.length], siapa: papan, nama: 'Village board' });
    });
  }
}
