import Phaser from 'phaser';
import { gumam } from '../bunyi';
import { PLAYER, kedalaman, type Dir } from '../config';
import { alamatWs, type PesanTamu } from '../../desa/alamat';
import { Player } from './Player';
import { buatRupa } from './Rupa';
import { bayanganKaki } from './piksel';
import { tanganTerangkat } from './Warga';

/** Arah hadap di kabel: 0 bawah, 1 kiri, 2 kanan, 3 atas. */
const ARAH: Dir[] = ['down', 'left', 'right', 'up'];

/**
 * Delapan rupa pengunjung: warna rambut, kulit, dan baju ditukar dari
 * karakter dasar (blonde_man), seperti warga lain. Nomor rupanya dipilih
 * acak sekali per browser dan disimpan, jadi orang yang sama tampil sama.
 */
const RUPA: [rambut: [string, string, string], kulit: [string, string], baju: [string, string], celana: [string, string]][] = [
  [['#2d2a33', '#1b1920', '#4d4857'], ['#c68b5e', '#a46d45'], ['#2a9d8f', '#1d6f65'], ['#3b3d48', '#262831']],
  [['#6b4226', '#4a2c18', '#8a5a36'], ['#f2c29a', '#d9a079'], ['#8a4ab0', '#62337e'], ['#2b3a6b', '#1d284d']],
  [['#1b1920', '#0f0e12', '#3a3640'], ['#a0693f', '#7e5030'], ['#f08a24', '#b8661a'], ['#4b3f36', '#332a24']],
  [['#4a2c18', '#2e1a0e', '#6b4226'], ['#c68b5e', '#a46d45'], ['#4caf50', '#2e7d32'], ['#3b3d48', '#262831']],
  [['#2d2a33', '#1b1920', '#4d4857'], ['#f2c29a', '#d9a079'], ['#e08ab0', '#b0607e'], ['#2b3a6b', '#1d284d']],
  [['#6b4226', '#4a2c18', '#8a5a36'], ['#c68b5e', '#a46d45'], ['#2a4a8a', '#1c3360'], ['#7a4a2a', '#553220']],
  [['#1b1920', '#0f0e12', '#3a3640'], ['#a0693f', '#7e5030'], ['#f2c94c', '#c8a02a'], ['#3b3d48', '#262831']],
  [['#8a3a20', '#5e2614', '#a8502e'], ['#f2c29a', '#d9a079'], ['#8a8e9c', '#5d616c'], ['#2b3a6b', '#1d284d']],
];

function nomorRupa() {
  try {
    const ada = Number(localStorage.getItem('mapporto:rupa'));
    if (Number.isInteger(ada) && ada >= 0 && ada < RUPA.length) return ada;
    const n = Math.floor(Math.random() * RUPA.length);
    localStorage.setItem('mapporto:rupa', String(n));
    return n;
  } catch {
    return Math.floor(Math.random() * RUPA.length);
  }
}

function siapkanRupa(scene: Phaser.Scene, r: number) {
  const key = `pengunjung_${r}`;
  const [rambut, kulit, baju, celana] = RUPA[r];
  buatRupa(scene, 'player', key, {
    tukar: {
      '#f79617': rambut[0],
      '#fb6b1d': rambut[1],
      '#f9c22b': rambut[2],
      '#fdcbb0': kulit[0],
      '#fca790': kulit[1],
      '#e83b3b': baju[0],
      '#ae2334': baju[1],
      '#ffffff': '#f4f1ea',
      '#cd683d': celana[0],
      '#9e4539': celana[1],
    },
  });
  Player.registerAnimations(scene, key);
  tanganTerangkat(scene, key, `${key}_lambai`, kulit[0], baju[0]);
  if (!scene.anims.exists(`${key}_lambai`) && scene.textures.exists(`${key}_lambai`)) {
    scene.anims.create({ key: `${key}_lambai`, frames: scene.anims.generateFrameNumbers(`${key}_lambai`, { start: 0, end: 1 }), frameRate: 5, repeat: 4 });
  }
  return key;
}

/** Seberapa samar pengunjung lain: jelas manusia, tapi bukan warga desa. */
const SAMAR = 0.6;

interface Hantu {
  id: number;
  s: Phaser.GameObjects.Sprite;
  b: Phaser.GameObjects.Image;
  key: string;
  tx: number;
  ty: number;
  a: number;
  j: number;
  lambai: number;
}

/**
 * Pengunjung lain yang sedang membuka portfolio di saat yang sama: tampil
 * sebagai warga samar berbaju warna-warni yang berjalan di desa ini juga.
 * Ketuk salah satunya untuk melambai — di layarnya, karakter kita melambai
 * balik dan berkata "Hi!".
 *
 * Yang dikirim ke server cuma posisi, arah hadap, dan nomor rupa; tidak ada
 * nama atau apa pun yang bisa mengenali orangnya. Kalau servernya mati atau
 * tidak diisi (PUBLIC_DESA_URL / PUBLIC_TERMINAL_URL), desanya tetap jalan
 * seperti biasa — cuma tanpa tetangga. Bisa dimatikan di Setelan.
 */
export class Tetangga {
  private ws?: WebSocket;
  private saya = 0;
  private hantu = new Map<number, Hantu>();
  private kirimLagi = 0;
  private terakhir = { x: -1, y: -1, a: -1, j: -1, t: 0 };
  private coba = 0;
  private sambungJeda?: ReturnType<typeof setTimeout>;
  private putusJeda?: ReturnType<typeof setTimeout>;
  private readonly rupa = nomorRupa();
  private nyala = true;

  constructor(
    private scene: Phaser.Scene,
    private pemain: () => Player | undefined
  ) {
    try {
      this.nyala = localStorage.getItem('mapporto:tetangga') !== '0';
    } catch {
      /* bawaan: nyala */
    }
    for (let r = 0; r < RUPA.length; r++) siapkanRupa(scene, r);
    const game = scene.game;
    const atur = (on: boolean) => {
      this.nyala = on;
      if (on) this.sambung();
      else this.putus();
    };
    game.events.on('mapporto:tetangga', atur);
    // tab disembunyikan semenit: lepaskan tempatnya; kembali: sambung lagi
    const lihat = () => {
      clearTimeout(this.putusJeda);
      if (document.hidden) this.putusJeda = setTimeout(() => this.putus(), 60_000);
      else if (!this.ws) this.sambung();
    };
    document.addEventListener('visibilitychange', lihat);
    scene.events.once('shutdown', () => {
      game.events.off('mapporto:tetangga', atur);
      document.removeEventListener('visibilitychange', lihat);
      this.putus();
    });
    scene.events.on('update', this.detak, this);
  }

  /** Dipanggil saat desa mulai tampil (setelah PLAY). */
  sambung() {
    const url = alamatWs();
    if (!url || !this.nyala || this.ws || document.hidden) return;
    clearTimeout(this.sambungJeda);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.coba = 0;
      ws.send(JSON.stringify({ t: 'halo', r: this.rupa }));
      this.terakhir.x = -1;
    };
    ws.onmessage = (e) => this.terima(e.data);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = undefined;
      this.saya = 0;
      this.kosongkan();
      // sambung lagi pelan-pelan: 5 dtk, 15 dtk, lalu tiap menit
      if (this.nyala && !document.hidden) {
        const jeda = [5000, 15000, 60000][Math.min(this.coba++, 2)];
        this.sambungJeda = setTimeout(() => this.sambung(), jeda);
      }
    };
    ws.onerror = () => ws.close();
  }

  putus() {
    clearTimeout(this.sambungJeda);
    const ws = this.ws;
    this.ws = undefined;
    this.saya = 0;
    ws?.close();
    this.kosongkan();
  }

  private kosongkan() {
    for (const h of this.hantu.values()) this.hapus(h);
    this.hantu.clear();
    this.scene.game.events.emit('mapporto:ramai', 0);
  }

  private kirim(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private terima(teks: string) {
    let m: { t: string; [k: string]: unknown };
    try {
      m = JSON.parse(teks);
    } catch {
      return;
    }
    switch (m.t) {
      case 'kamu':
        this.saya = m.id as number;
        for (const w of m.warga as { id: number; x: number; y: number; a: number; j: number; r: number }[]) this.tambah(w);
        break;
      case 'masuk':
        this.tambah(m as unknown as { id: number; x: number; y: number; a: number; j: number; r: number });
        break;
      case 'keluar': {
        const h = this.hantu.get(m.id as number);
        if (h) {
          this.hantu.delete(h.id);
          this.scene.tweens.add({ targets: [h.s, h.b], alpha: 0, duration: 500, onComplete: () => this.hapus(h) });
        }
        break;
      }
      case 'p':
        for (const [id, x, y, a, j] of m.d as number[][]) {
          const h = this.hantu.get(id);
          if (!h) continue;
          h.tx = x;
          h.ty = y;
          h.a = a;
          h.j = j;
        }
        break;
      case 'jumlah':
        this.scene.game.events.emit('mapporto:ramai', m.n as number);
        break;
      case 'lambai':
        this.dilambai(m.dari as number, m.ke as number);
        break;
      case 'tamu':
        this.scene.game.events.emit('mapporto:tamu-baru', m.p as PesanTamu);
        break;
      case 'tamu-hapus':
        this.scene.game.events.emit('mapporto:tamu-hapus', m.id as string);
        break;
    }
  }

  private tambah(w: { id: number; x: number; y: number; a: number; j: number; r: number }) {
    if (w.id === this.saya || this.hantu.has(w.id)) return;
    const key = `pengunjung_${(w.r ?? 0) % RUPA.length}`;
    const s = this.scene.add.sprite(w.x, w.y, key, 0).setAlpha(0);
    const b = this.scene.add.image(w.x, w.y + PLAYER.baseY - 1, bayanganKaki(this.scene)).setAlpha(0);
    const { width: fw, height: fh } = s.frame;
    s.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(fw * 0.2, fh * 0.25, fw * 0.6, fh * 0.75),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const h: Hantu = { id: w.id, s, b, key, tx: w.x, ty: w.y, a: w.a, j: w.j, lambai: 0 };
    s.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      this.lambaiKe(h);
    });
    this.scene.tweens.add({ targets: s, alpha: SAMAR, duration: 600 });
    this.scene.tweens.add({ targets: b, alpha: 0.15, duration: 600 });
    this.hantu.set(w.id, h);
  }

  private hapus(h: Hantu) {
    h.s.destroy();
    h.b.destroy();
  }

  /** Ketuk pengunjung lain: Rahmat menyapa, di layar orang itu ia melambai. */
  private lambaiKe(h: Hantu) {
    const p = this.pemain();
    if (!p) return;
    if (Phaser.Math.Distance.Between(p.x, p.y, h.s.x, h.s.y) > 110) {
      this.scene.game.events.emit('mapporto:ucap', { msg: 'Another visitor! Walk a little closer to wave hello.', siapa: h.s, nama: 'Visitor' });
      return;
    }
    this.kirim({ t: 'lambai', ke: h.id });
    this.scene.game.events.emit('mapporto:ucap', { msg: 'Hi there!', siapa: p, nama: 'Rahmat', lama: 2500 });
    this.scene.game.events.emit('mapporto:jejak', 'lambai');
  }

  private dilambai(dari: number, ke: number) {
    const h = this.hantu.get(dari);
    if (!h) return;
    // pengunjung itu melambai — ke kita, atau ke orang lain di dekatnya
    h.lambai = this.scene.time.now + 2000;
    if (this.scene.anims.exists(`${h.key}_lambai`)) h.s.play(`${h.key}_lambai`);
    const untukKita = ke === this.saya;
    this.scene.game.events.emit('mapporto:ucap', { msg: untukKita ? 'Hi! *waves*' : '*waves*', siapa: h.s, nama: 'Visitor', lama: 2500 });
    if (untukKita) gumam(h.s.x, h.s.y, 'pria', 2, 0.8, 'seru');
  }

  private detak(t: number, delta: number) {
    // kirim posisi sendiri: paling sering 8× per detik, dan tiap 20 dtk walau diam
    const p = this.pemain();
    if (p && this.saya && t > this.kirimLagi) {
      this.kirimLagi = t + 125;
      const body = p.body as Phaser.Physics.Arcade.Body | undefined;
      const j = body && (body.velocity.x || body.velocity.y) ? 1 : 0;
      const a = Math.max(0, ARAH.indexOf(p.direction));
      const x = Math.round(p.x * 2) / 2;
      const y = Math.round(p.y * 2) / 2;
      const L = this.terakhir;
      if (x !== L.x || y !== L.y || a !== L.a || j !== L.j || t - L.t > 20000) {
        this.kirim({ t: 'pos', x, y, a, j });
        Object.assign(L, { x, y, a, j, t });
      }
    }
    const dt = Math.min(delta, 100) / 1000;
    for (const h of this.hantu.values()) {
      const dx = h.tx - h.s.x;
      const dy = h.ty - h.s.y;
      const jarak = Math.hypot(dx, dy);
      if (jarak > 90) {
        // berpindah jauh (petir ke rumah lain): langsung muncul di sana
        h.s.setPosition(h.tx, h.ty);
      } else if (jarak > 0.3) {
        const langkah = Math.min(jarak, Math.max(PLAYER.speed * 1.15, jarak * 6) * dt);
        h.s.x += (dx / jarak) * langkah;
        h.s.y += (dy / jarak) * langkah;
      }
      const jalan = h.j || jarak > 2;
      if (t > h.lambai) {
        const arah = jarak > 2 ? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down') : ARAH[h.a] ?? 'down';
        h.s.play(`${h.key}_${jalan ? 'walk' : 'idle'}_${arah}`, true);
      }
      const kaki = h.s.y + PLAYER.baseY;
      h.s.setDepth(kedalaman(kaki));
      h.b.setPosition(h.s.x, kaki - 1).setDepth(kedalaman(kaki) - 0.5);
    }
  }
}
