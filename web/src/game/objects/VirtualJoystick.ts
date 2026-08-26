import Phaser from 'phaser';
import { TOUCH, diZonaJoystick } from '../config';

/**
 * Joystick virtual dari aset `Virtual Joystick V2`:
 * cincin luar `Joystick_Virtual.png` + knob `HandleFilled2.png`.
 *
 * Sifatnya "floating": cincin pindah ke tempat jari pertama menyentuh separuh
 * kiri bawah layar, bukan terpaku di satu titik. Jempol orang tidak pernah
 * mendarat persis di tempat yang sama, dan joystick statis memaksa mereka
 * mencari — ini menghilangkan langkah itu.
 *
 * Hasilnya ditulis ke registry sebagai `stick`, yang sudah dibaca WorldScene.
 */
export class VirtualJoystick {
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private pointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private homeX = 0;
  private homeY = 0;

  constructor(private scene: Phaser.Scene) {
    const d = TOUCH.baseRadius * 2;
    this.base = scene.add.image(0, 0, 'joy_base').setDisplaySize(d, d).setAlpha(0.5).setDepth(80);
    this.knob = scene.add
      .image(0, 0, 'joy_knob')
      .setDisplaySize(TOUCH.baseRadius, TOUCH.baseRadius)
      .setAlpha(0.75)
      .setDepth(81);

    this.layout();
    scene.scale.on('resize', () => this.layout());

    scene.input.addPointer(2); // sentuhan jempol kiri + tombol kanan bersamaan
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);

    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
    });
  }

  /** Posisi istirahat: kiri bawah, sejangkauan jempol. */
  private layout() {
    this.homeX = TOUCH.homeX;
    this.homeY = this.scene.scale.height - TOUCH.homeY;
    if (this.pointerId === null) this.reset();
  }

  /** Hanya separuh kiri layar, dan hanya bagian bawah — supaya tidak bentrok
   *  dengan klik POI di dunia dan tombol menu di atas. */
  private inZone(p: Phaser.Input.Pointer) {
    return diZonaJoystick(p.x, p.y, this.scene.scale.width, this.scene.scale.height);
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.pointerId !== null || !this.inZone(p)) return;
    this.pointerId = p.id;
    this.origin.set(p.x, p.y);
    this.base.setPosition(p.x, p.y).setAlpha(0.75);
    this.knob.setPosition(p.x, p.y).setAlpha(1);
    // beri tahu WorldScene supaya sentuhan ini tidak ikut jadi tap-to-move
    this.scene.registry.set('uiPointerId', p.id);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;

    const dx = p.x - this.origin.x;
    const dy = p.y - this.origin.y;
    const dist = Math.min(Math.hypot(dx, dy), TOUCH.maxDrag);
    const ang = Math.atan2(dy, dx);

    this.knob.setPosition(this.origin.x + Math.cos(ang) * dist, this.origin.y + Math.sin(ang) * dist);

    const power = dist / TOUCH.maxDrag;
    if (power < TOUCH.deadZone) {
      this.scene.registry.set('stick', { x: 0, y: 0 });
    } else {
      this.scene.registry.set('stick', { x: Math.cos(ang) * power, y: Math.sin(ang) * power });
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    this.scene.registry.set('stick', { x: 0, y: 0 });
    if (this.scene.registry.get('uiPointerId') === p.id) this.scene.registry.set('uiPointerId', -1);
    this.reset();
  }

  private reset() {
    this.base.setPosition(this.homeX, this.homeY).setAlpha(0.5);
    this.knob.setPosition(this.homeX, this.homeY).setAlpha(0.75);
  }

  setVisible(v: boolean) {
    this.base.setVisible(v);
    this.knob.setVisible(v);
  }

  destroy() {
    this.base.destroy();
    this.knob.destroy();
  }
}
