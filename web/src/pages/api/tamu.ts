import type { APIRoute } from 'astro';
import { jaga } from '../../lib/jaga';

export const prerender = false;

/**
 * Buku tamu untuk /admin: daftar pesan dan penghapusannya. Pesannya tinggal
 * di layanan desa (terminal-server/desa), bukan di repo; menghapus butuh
 * DESA_ADMIN_KEY yang sama dengan di server itu, dan kunci itu hanya ada di
 * sini (server Vercel), tidak pernah dikirim ke browser.
 */
const env = (k: string) => ((import.meta.env[k] as string | undefined) ?? process.env[k] ?? '').trim();
function alamat() {
  const u = env('PUBLIC_DESA_URL') || env('PUBLIC_TERMINAL_URL');
  try {
    return u ? new URL(u).origin : '';
  } catch {
    return '';
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  const a = alamat();
  if (!a) return Response.json({ error: 'PUBLIC_TERMINAL_URL is not set.' }, { status: 500 });
  try {
    const r = await fetch(`${a}/desa/tamu`, { signal: AbortSignal.timeout(8000) });
    return Response.json(await r.json(), { status: r.status });
  } catch {
    return Response.json({ error: 'The guestbook server is not answering.' }, { status: 502 });
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  const a = alamat();
  const kunci = env('DESA_ADMIN_KEY');
  if (!a || !kunci) return Response.json({ error: 'DESA_ADMIN_KEY is not set on Vercel.' }, { status: 500 });
  const { id } = await request.json().catch(() => ({ id: '' }));
  try {
    const r = await fetch(`${a}/desa/tamu/hapus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${kunci}` },
      body: JSON.stringify({ id: String(id ?? '') }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401) return Response.json({ error: 'The guestbook server rejected the admin key.' }, { status: 502 });
    if (!r.ok) return Response.json({ error: 'Message not found (maybe already deleted).' }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'The guestbook server is not answering.' }, { status: 502 });
  }
};
