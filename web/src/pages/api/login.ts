import type { APIRoute } from 'astro';
import { buatSesi, passwordCocok, NAMA_COOKIE } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const benar = import.meta.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
  const rahasia = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  if (!benar || !rahasia) {
    return Response.json({ error: 'ADMIN_PASSWORD / ADMIN_SECRET belum diset.' }, { status: 500 });
  }

  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!passwordCocok(String(password ?? ''), benar)) {
    return Response.json({ error: 'Password salah.' }, { status: 401 });
  }

  cookies.set(NAMA_COOKIE, await buatSesi(rahasia), {
    httpOnly: true,      // tidak terbaca JavaScript mana pun
    secure: true,
    sameSite: 'strict',  // tidak ikut terkirim dari situs lain
    path: '/',
    maxAge: 12 * 3600,
  });
  return Response.json({ ok: true });
};
