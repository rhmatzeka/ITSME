import type { APIRoute } from 'astro';
import { jaga } from '../../lib/jaga';
import { tulisBase64 } from '../../lib/repo';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  try {
    const { base64, slug } = await request.json();
    const isi = String(base64 ?? '');
    if (!isi) return Response.json({ error: 'Gambarnya kosong.' }, { status: 400 });
    // sudah dikecilkan di browser; batas ini cuma jaring pengaman
    if (isi.length > 4_000_000) {
      return Response.json({ error: 'Gambarnya terlalu besar.' }, { status: 413 });
    }

    // tanpa slug berarti foto About; dengan slug berarti gambar satu projek
    const bersih = String(slug ?? '').replace(/[^a-z0-9-]/g, '');
    const jalur = bersih ? `web/public/img/projects/${bersih}.jpg` : 'web/public/img/profile.jpg';
    const url = bersih ? `/img/projects/${bersih}.jpg` : '/img/profile.jpg';

    await tulisBase64(jalur, isi, `Admin: perbarui gambar ${bersih || 'About'}`);
    return Response.json({ ok: true, url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
};
