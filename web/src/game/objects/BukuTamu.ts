import Phaser from 'phaser';
import { kertas } from '../bunyi';
import { BUKU_TAMU, kedalaman } from '../config';
import { ALAMAT_DESA, type PesanTamu } from '../../desa/alamat';
import { spritesheetTeks } from './piksel';

/**
 * Buku tamu desa: mimbar kayu dengan buku terbuka dan pena bulu di seberang
 * jalan rumah Contact. Diketuk = halaman membuka jendela buku tamu (tulis
 * nama + satu kalimat, baca pesan pengunjung lain — Desa.astro).
 *
 * Pesannya juga hidup di desa: sesekali warga yang sedang terlihat di layar
 * membacakan salah satunya ("Dina wrote in the guestbook: …"), dan pesan
 * yang baru masuk saat ada pengunjung lain di desa dikabarkan MATS-BOT.
 */
export class BukuTamu {
  private pesan: PesanTamu[] = [];
  private bacaLagi = 0;
  private mimbar: Phaser.GameObjects.Image;
  private milikku = new Set<string>();

  constructor(
    private scene: Phaser.Scene,
    /** Warga yang bisa membacakan pesan. */
    private warga: () => Phaser.GameObjects.Sprite[]
  ) {
    // digambar di skrip pratinjau Python: meja baca kayu miring,
    // buku terbuka bergaris tulisan, pita pembatas merah, pena bulu di botol
    // tinta, tiang berukir di atas kaki bersilang
    spritesheetTeks(
      scene,
      'mimbar_tamu',
      [
        [
          '....................ab',
          '...................acb',
          '...................aba',
          '...aaaa.......aaaaaaba',
          '..abbbbaaaaaaabbbadba.',
          '..abbbbbbbccbbbbbadda.',
          '.aabeeebeecceebeeeaaa.',
          'afabeebeeecceeeeebaffa',
          'agabeeeebbccbbbbbbaga.',
          'ggaccccccccccccccccaga',
          'gggaaaaaaachaaaaaaagga',
          'iiiiiiiiiiahiiiiiiiiii',
          'iiiiiiiiiiihiiiiiiiiii',
          'aaaaaaaaaaahaaaaaaaaaa',
          '........afghia........',
          '........afggia........',
          '.......aiiiiiia.......',
          '........afggia........',
          '........afggia........',
          '........afggia........',
          '........afggia........',
          '........afggia........',
          '.......aiiiiiia.......',
          '........afggia........',
          '......aaafggiaaa......',
          '.....agggggggggga.....',
          '....aiiiiiiiiiiiia....',
          '....aiiiiiiiiiiiia....',
        ],
      ],
      { a: '#2a1c14', b: '#fbf6e6', c: '#d9d2c2', d: '#2d2a33', e: '#9a9080', f: '#b07a40', g: '#8a5a30', h: '#e0463a', i: '#5a3a1e' }
    );
    const { x, kaki } = BUKU_TAMU;
    this.mimbar = scene.add.image(x, kaki + 1, 'mimbar_tamu').setOrigin(0.5, 1).setDepth(kedalaman(kaki));
    this.mimbar.setInteractive({ useHandCursor: true });
    this.mimbar.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event.preventDefault();
      kertas(x, kaki - 16);
      scene.game.events.emit('mapporto:buka-tamu');
    });

    const game = scene.game;
    const baru = (p: PesanTamu) => {
      if (this.pesan.some((x) => x.id === p.id)) return;
      this.pesan.unshift(p);
      // pesan orang lain yang baru masuk: diumumkan; pesan sendiri cukup terima
      // kasih. Siaran WebSocket bisa tiba sebelum jawaban kiriman kita sendiri,
      // jadi ditunggu sebentar sebelum diputuskan pesan siapa.
      scene.time.delayedCall(1500, () => {
        if (!this.milikku.has(p.id)) game.events.emit('mapporto:matsbot-ucap', `New in the guestbook — ${p.nama}: "${p.isi}"`);
      });
    };
    const sendiri = (p: PesanTamu) => {
      this.milikku.add(p.id);
      if (!this.pesan.some((x) => x.id === p.id)) this.pesan.unshift(p);
      game.events.emit('mapporto:ucap', { msg: 'Thanks for signing the guestbook! Your message is up for everyone to read.', siapa: this.mimbar, nama: 'Guestbook' });
    };
    const hapus = (id: string) => (this.pesan = this.pesan.filter((p) => p.id !== id));
    game.events.on('mapporto:tamu-baru', baru);
    game.events.on('mapporto:tamu-kirim', sendiri);
    game.events.on('mapporto:tamu-hapus', hapus);
    scene.events.once('shutdown', () => {
      game.events.off('mapporto:tamu-baru', baru);
      game.events.off('mapporto:tamu-kirim', sendiri);
      game.events.off('mapporto:tamu-hapus', hapus);
    });

    void this.muat();
    this.bacaLagi = scene.time.now + Phaser.Math.Between(40000, 60000);
    scene.events.on('update', this.detak, this);
  }

  private async muat() {
    if (!ALAMAT_DESA) return;
    try {
      const r = await fetch(`${ALAMAT_DESA}/desa/tamu`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const isi = (await r.json()) as { pesan?: PesanTamu[] };
      this.pesan = Array.isArray(isi.pesan) ? isi.pesan : [];
    } catch {
      /* server sedang istirahat: warga tidak membacakan apa pun */
    }
  }

  /** Titik gantung label "GUESTBOOK", atau undefined kalau server buku tamunya tidak diisi. */
  get puncak() {
    return ALAMAT_DESA ? { x: this.mimbar.x, y: this.mimbar.y - this.mimbar.height - 2 } : undefined;
  }

  /** Sesekali warga yang terlihat di layar membacakan pesan buku tamu. */
  private detak(t: number) {
    if (t < this.bacaLagi || !this.pesan.length) return;
    this.bacaLagi = t + Phaser.Math.Between(55000, 95000);
    const kamera = this.scene.cameras.main.worldView;
    const calon = this.warga().filter((s) => s.visible && s.active && kamera.contains(s.x, s.y));
    if (!calon.length) return;
    // pesan terbaru lebih sering dibacakan
    const p = this.pesan[Math.floor(Math.random() ** 2 * Math.min(this.pesan.length, 15))];
    this.scene.game.events.emit('mapporto:ucap', {
      msg: `${p.nama} wrote in the guestbook: "${p.isi}"`,
      siapa: Phaser.Utils.Array.GetRandom(calon),
      nama: 'Villager',
    });
  }
}
