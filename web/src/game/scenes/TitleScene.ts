import Phaser from 'phaser';
import { mulai } from '../suara';
import { pakaiKontrolSentuh } from '../config';
import { RUTE } from '../../rute';
import type { WorldScene } from './WorldScene';

/**
 * Layar judul. Latarnya desa itu sendiri: WorldScene sudah dibangun di balik
 * layar loading, jadi di sini ia dibangunkan dan dipakai apa adanya — warga,
 * hewan, awan, lampu, dan jam pengunjung — di bawah tirai gelap tipis.
 *
 * Scene ini cuma memegang judul dan tombolnya, dengan kamera tanpa zoom, dan
 * dinaikkan ke atas daftar scene supaya digambar di atas desa.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.ui = this.cameras.main;

    const world = this.scene.get('World') as WorldScene;
    let gelap = 0;
    if (world.menunggu) {
      this.scene.wake('World');
      world.latarJudul();
      this.scene.bringToTop();
      gelap = world.suasana?.gelap ?? 0;
    } else {
      // desanya belum dibangun (tidak lewat layar loading): latar rumput polos
      this.ui.setBackgroundColor('#4a7c3f');
    }
    // malam hari desanya sudah gelap sendiri: tirainya ditipiskan supaya tetap terlihat
    this.add.rectangle(w / 2, h / 2, w, h, 0x0d1409, 0.5 - 0.28 * gelap);

    const title = this.add
      .text(w / 2, h * 0.3, 'RAHMAT\nPORTFOLIO', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: `${Math.round(Math.min(w * 0.093, 66))}px`,
        color: '#ffffff',
        align: 'center',
        stroke: '#1b2416',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(w / 2, title.y + title.height * 0.62, 'WEB · MOBILE · WEB3', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '20px',
        color: '#e7ecdc',
      })
      .setOrigin(0.5);

    // ---- tombol PLAY ----
    const bw = 260;
    const bh = 74;
    const btn = this.add.container(w / 2, h * 0.66);
    const shadow = this.add.rectangle(5, 5, bw, bh, 0x1b2416).setOrigin(0.5);
    const face = this.add.rectangle(0, 0, bw, bh, 0xe0563f).setOrigin(0.5).setStrokeStyle(3, 0x1b2416);
    const text = this.add
      .text(0, 0, 'PLAY', { fontFamily: 'Silkscreen, monospace', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    btn.add([shadow, face, text]);

    face.on('pointerover', () => face.setFillStyle(0xe86c56));
    face.on('pointerout', () => face.setFillStyle(0xe0563f));
    face.on('pointerdown', () => btn.setPosition(btn.x + 3, btn.y + 3));
    face.on('pointerup', () => this.start());
    // Papan ketik menyala sejak detik pertama, tidak menunggu animasi masuk
    // selesai: yang sudah pernah ke sini boleh langsung menekan Enter.
    this.input.keyboard?.once('keydown-ENTER', () => this.start());
    this.input.keyboard?.once('keydown-SPACE', () => this.start());

    /*
     * Satu baris tentang apa yang menunggu di balik PLAY: berapa tempat yang
     * bisa didatangi dan cara berjalan. Cara jalannya ikut perangkatnya — di
     * ponsel tidak ada WASD, yang ada joystick. Di layar sempit dipecah dua
     * baris supaya tidak terpotong tepi layar.
     */
    const caraJalan = pakaiKontrolSentuh() ? 'joystick to walk' : 'WASD / click to walk';
    const pemisah = w < 600 ? '\n' : '  ·  ';
    const info = this.add
      .text(w / 2, h * 0.66 + 70, `${RUTE.length} places to visit${pemisah}${caraJalan}`, {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '14px',
        color: '#f2e9c9',
        align: 'center',
        stroke: '#1b2416',
        strokeThickness: 4,
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    const petunjuk = this.add
      .text(w / 2, info.y + info.height + 12, 'Enter / Space works too', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '12px',
        color: '#c6cfb6',
      })
      .setOrigin(0.5, 0);

    this.masuk(title, sub, btn, face, info, petunjuk);
  }

  /** Kamera tanpa zoom untuk judul, tombol, dan tirai — digambar di atas desa. */
  private ui!: Phaser.Cameras.Scene2D.Camera;

  /**
   * Animasi masuk, dipentaskan berurutan: tirainya rontok dulu, baru isinya
   * dipasang satu per satu.
   *
   * Sebelum ini layar judul muncul begitu saja di frame yang sama saat bar
   * loading mencapai 100% — dua gambar yang sama sekali berbeda bertukar tanpa
   * sesuatu pun di antaranya, dan yang terbaca cuma layar yang berkedip.
   */
  private masuk(
    judul: Phaser.GameObjects.Text,
    sub: Phaser.GameObjects.Text,
    btn: Phaser.GameObjects.Container,
    face: Phaser.GameObjects.Rectangle,
    info: Phaser.GameObjects.Text,
    petunjuk: Phaser.GameObjects.Text
  ) {
    const isi = [judul, sub, btn, info, petunjuk];
    for (const o of isi) o.setAlpha(0);

    // Yang minta gerakannya dikurangi langsung dapat layarnya, utuh.
    const kurangGerak = this.game.device.os.desktop
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    if (kurangGerak) {
      for (const o of isi) o.setAlpha(1);
      face.setInteractive({ useHandCursor: true });
      return;
    }

    const asalY = judul.y;
    judul.setY(asalY - 90);
    btn.setScale(0.55);

    this.tiraiPixel();

    // Judulnya berangkat sebelum tirainya habis: menunggu giliran dengan rapi
    // membuat dua gerakan yang sebenarnya satu kejadian terasa seperti antrean.
    this.tweens.add({ targets: judul, y: asalY, alpha: 1, duration: 380, delay: 430, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 240, delay: 700 });
    this.tweens.add({
      targets: btn,
      alpha: 1,
      scale: 1,
      duration: 320,
      delay: 780,
      ease: 'Back.easeOut',
      // Baru bisa ditekan setelah benar-benar terlihat: tombol tembus pandang
      // yang sudah menerima klik adalah jebakan, bukan pintasan.
      onComplete: () => face.setInteractive({ useHandCursor: true }),
    });
    // hentakan kecil tepat saat tombolnya mendarat — bukan getaran hias,
    // melainkan yang membuat "pop"-nya terasa punya berat
    this.time.delayedCall(970, () => this.ui.shake(90, 0.004));
    this.tweens.add({ targets: info, alpha: 1, duration: 260, delay: 1020 });
    this.tweens.add({ targets: petunjuk, alpha: 1, duration: 260, delay: 1120 });
  }

  /**
   * Tirai pixel: layarnya rontok kotak demi kotak.
   *
   * Warnanya sama persis dengan layar loading yang baru ditinggalkan
   * (--color-paper), jadi yang terlihat bukan tirai baru yang datang menutup,
   * melainkan layar sebelumnya yang hancur. Pita di tepi yang sedang runtuh
   * diberi warna kilat — warna yang sama dengan petir yang sebentar lagi
   * mengantar karakternya masuk.
   */
  private tiraiPixel() {
    const { width: w, height: h } = this.scale;

    /*
     * Ukuran kotaknya ikut ukuran layar, bukan angka tetap. Pada layar 1920px
     * kotak 24px cuma jadi butiran halus yang tidak terbaca sebagai pixel;
     * pada ponsel 390px kotak 48px cuma menyisakan delapan kolom dan terlihat
     * seperti pintu geser. Yang tetap adalah JUMLAH kotaknya, kira-kira, jadi
     * kesannya sama di layar mana pun.
     */
    const sisi = Math.max(16, Math.round(Math.max(w, h) / 44));
    const kolom = Math.ceil(w / sisi) + 1;
    const baris = Math.ceil(h / sisi) + 1;

    const kotak: { x: number; y: number; urut: number }[] = [];
    for (let ky = 0; ky < baris; ky++) {
      for (let kx = 0; kx < kolom; kx++) {
        /*
         * Sapuan miring dari sudut kiri atas, tapi diberi derau. Tanpa derau
         * tepinya jadi garis lurus sempurna, dan yang terbaca cuma sesuatu
         * yang digeser — bukan kotak-kotak yang rontok satu per satu.
         */
        const maju = (kx + ky) / (kolom + baris);
        kotak.push({ x: kx * sisi, y: ky * sisi, urut: maju + Math.random() * 0.34 });
      }
    }
    kotak.sort((a, b) => a.urut - b.urut);

    const g = this.add.graphics().setDepth(50);
    const TEPI = Math.ceil(kotak.length * 0.08); // tebal pita kilat di garis runtuh
    let hilang = -1;

    const gambar = (n: number) => {
      g.clear();
      g.fillStyle(0xeff1e8, 1);
      for (let i = n + TEPI; i < kotak.length; i++) g.fillRect(kotak[i].x, kotak[i].y, sisi, sisi);
      g.fillStyle(0xf2c438, 1);
      for (let i = n; i < Math.min(n + TEPI, kotak.length); i++) g.fillRect(kotak[i].x, kotak[i].y, sisi, sisi);
    };
    gambar(0);

    this.tweens.addCounter({
      from: 0,
      to: kotak.length,
      duration: 620,
      // mulai pelan supaya kotak pertamanya sempat terbaca satu-satu,
      // lalu menderas — bukan laju rata yang terasa seperti tirai mekanis
      ease: 'Quad.easeIn',
      onUpdate: (t) => {
        const n = Math.floor(t.getValue() ?? 0);
        // digambar ulang hanya kalau jumlahnya benar-benar berubah: satu
        // gambar ulang berarti seribu kotak, tidak perlu tiap frame
        if (n === hilang) return;
        hilang = n;
        gambar(n);
      },
      onComplete: () => g.destroy(),
    });
  }

  private start() {
    /*
     * Satu-satunya tempat yang benar untuk menyalakan suara.
     *
     * Browser cuma memberi izin berbunyi di dalam penanganan sentuhan atau
     * tekan tombol, dan tombol PLAY adalah gerbang yang memang sudah ada:
     * yang menekannya jelas sedang bersiap main, bukan kebetulan lewat.
     */
    mulai();
    // Kamera UI yang digelapkan: ia digambar paling atas dan selebar layar,
    // jadi tirai hitamnya menutup dunia di bawahnya juga.
    this.ui.fadeOut(220, 0, 0, 0);
    this.ui.once('camerafadeoutcomplete', () => {
      // desanya sudah berjalan sebagai latar: tinggal menurunkan karakternya
      const world = this.scene.get('World') as WorldScene;
      if (world.menunggu) {
        world.tampilkan();
        this.scene.stop();
      } else {
        this.scene.start('World');
      }
    });
  }
}
