import Phaser from 'phaser';
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
      [[
        '..kkkkkkkkkkkkkkkkkkkkkk..',
        '.kbbbbbbbbbbbbbbbbbbbbbbk.',
        '.kbBBBBBBBBBBBBBBBBBBBBbk.',
        '.kbBkkkkkkBkkkkkkBkkkkBbk.',
        '.kbBkuruukBkqqrqkBkhrkBbk.',
        '.kbBkuuuukBkqqqqkBkhhkBbk.',
        '.kbBkuKKukBkqKKqkBkKhkBbk.',
        '.kbBkuuuukBkqqqqkBkhhkBbk.',
        '.kbBkuKKukBkqKqqkBkKhkBbk.',
        '.kbBkuuuukBkqqqqkBkhhkBbk.',
        '.kbBkuKuukBkkkkkkBkkkkBbk.',
        '.kbBkuuuukBBBBBBBBBBBBBbk.',
        '.kbBkkkkkkBBkkkkkkkkkBBbk.',
        '.kbBBBBBBBBBksssrsssskBbk.',
        '.kbBBkkkkkkBksKKsKKsskBbk.',
        '.kbBBkiirikBkssssssssBBbk.',
        '.kbBBkiiiikBksKKKsKsskBbk.',
        '.kbBBkiKKikBkssssssssBBbk.',
        '.kbBBkiiiikBkkkkkkkkkkBbk.',
        '.kbBBkkkkkkBBBBBBBBBBBBbk.',
        '.kbbbbbbbbbbbbbbbbbbbbbbk.',
        '..kkkbkkkkkkkkkkkkkkbkkk..',
        '....kbk............kbk....',
        '....kbk............kbk....',
        '....kBk............kBk....',
        '....kkk............kkk....',
      ]],
      {
        k: '#3a2418', K: '#1b2416', b: '#8a5a2a', B: '#5e3a1a', r: '#e0463a',
        u: '#f7d77a', q: '#a8e0a0', h: '#f4b8c8', s: '#f4f1ea', i: '#f2b233',
      }
    );
    spritesheetTeks(scene, 'tanda_papan', [['.kkk.', 'kyyyk', 'kykyk', 'kykyk', 'kykyk', 'kyyyk', 'kykyk', '.kkk.']], {
      k: '#3a2418',
      y: '#f7d77a',
    });

    const { x, kaki } = UTARA.papan;
    const papan = scene.add.sprite(x, kaki, 'papan_desa').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    if (blocked) {
      const r = scene.add.rectangle(x, kaki - 2, 20, 4);
      scene.physics.add.existing(r, true);
      blocked.add(r);
    }
    const tanda = scene.add.image(x, kaki - 30, 'tanda_papan').setDepth(DEPTH.above + 45);
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
      if (tanda.active) {
        scene.tweens.killTweensOf(tanda);
        tanda.destroy();
      }
      scene.game.events.emit('mapporto:ucap', { msg: kabar[this.ke++ % kabar.length], siapa: papan, nama: 'Village board' });
    });
  }
}
