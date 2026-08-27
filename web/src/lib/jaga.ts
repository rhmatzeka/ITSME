import type { AstroCookies } from 'astro';
import { sesiSah, NAMA_COOKIE } from './auth';

/** Kembalikan Response penolakan kalau sesinya tidak sah, atau null kalau lolos. */
export async function jaga(cookies: AstroCookies) {
  const rahasia = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  if (!rahasia) return Response.json({ error: 'ADMIN_SECRET belum diset.' }, { status: 500 });
  if (!(await sesiSah(rahasia, cookies.get(NAMA_COOKIE)?.value))) {
    return Response.json({ error: 'Sesi berakhir. Masuk lagi.' }, { status: 401 });
  }
  return null;
}
