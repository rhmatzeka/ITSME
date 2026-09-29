import Phaser from 'phaser';
import { PLAYER, type Dir } from '../config';

let ambilPemain: () => Phaser.GameObjects.Sprite | undefined = () => undefined;

/** Karakter pemain yang ditatap warga. Dipasang WorldScene, sama seperti telinga bunyi. */
export function pasangPemain(f: () => Phaser.GameObjects.Sprite | undefined) {
  ambilPemain = f;
}

/** Sedekat apa pemain harus lewat supaya warga menoleh, px dunia. */
export const JANGKAU_TOLEH = 44;

/**
 * Ke arah mana warga di (x, kaki) harus menghadap untuk menatap pemain —
 * atau null kalau pemainnya tidak cukup dekat. Dipakai semua warga yang
 * punya pose empat arah: mereka menoleh selagi pemain lewat, lalu kembali
 * ke kesibukannya sendiri.
 *
 * Jangkauan tegaknya lebih pendek dari mendatarnya: kamera menatap tanah
 * dengan sudut, jadi jarak tegak di layar terasa lebih jauh.
 */
export function arahKePemain(
  x: number,
  kaki: number,
  jangkau = JANGKAU_TOLEH
): Dir | null {
  const pemain = ambilPemain();
  if (!pemain?.visible) return null;
  const dx = pemain.x - x;
  const dy = pemain.y + PLAYER.baseY - kaki;
  if (Math.abs(dx) > jangkau || Math.abs(dy) > jangkau * 0.75) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

/**
 * Yang duduk menghadap depan cuma bisa menoleh ke kiri atau kanan: -1, 1,
 * atau 0 kalau pemainnya jauh (atau tepat di depannya).
 */
export function sisiPemain(x: number, kaki: number, jangkau = JANGKAU_TOLEH) {
  const a = arahKePemain(x, kaki, jangkau);
  const pemain = ambilPemain();
  if (!a || !pemain) return 0;
  if (Math.abs(pemain.x - x) < 3) return 0;
  return pemain.x < x ? -1 : 1;
}
