import type { APIRoute } from 'astro';
import { jaga } from '../../lib/jaga';
import { tulisBase64 } from '../../lib/repo';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  try {
    const { base64 } = await request.json();
    const isi = String(base64 ?? '');
    if (!isi) return Response.json({ error: 'Gambarnya kosong.' }, { status: 400 });
    // sudah dipotong 512x512 di browser; batas ini cuma jaring pengaman
    if (isi.length > 3_000_000) {
      return Response.json({ error: 'Gambarnya terlalu besar.' }, { status: 413 });
    }
    await tulisBase64('web/public/img/profile.jpg', isi, 'Admin: perbarui foto About');
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
};
