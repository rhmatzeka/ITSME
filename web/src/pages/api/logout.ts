import type { APIRoute } from 'astro';
import { NAMA_COOKIE } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(NAMA_COOKIE, { path: '/' });
  return Response.json({ ok: true });
};
