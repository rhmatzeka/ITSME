import type { APIRoute } from 'astro';
import { jaga } from '../../lib/jaga';
import { daftar, baca, tulis, hapus, keSlug, keMarkdown } from '../../lib/repo';

export const prerender = false;

const FOLDER = 'web/src/content/projects';

export const GET: APIRoute = async ({ cookies, url }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  try {
    const slug = url.searchParams.get('slug');
    if (slug) {
      const md = await baca(`${FOLDER}/${slug}.md`);
      return md === null
        ? Response.json({ error: 'Tidak ditemukan.' }, { status: 404 })
        : Response.json({ slug, md });
    }
    const berkas = (await daftar(FOLDER)).filter((n) => n.endsWith('.md'));
    return Response.json({ items: berkas.map((n) => n.replace(/\.md$/, '')) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
};

export const PUT: APIRoute = async ({ cookies, request }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  try {
    const b = await request.json();
    const judul = String(b.title ?? '').trim();
    if (!judul) return Response.json({ error: 'Judul wajib diisi.' }, { status: 400 });

    const slug = String(b.slug || keSlug(judul)).replace(/[^a-z0-9-]/g, '');
    if (!slug) return Response.json({ error: 'Nama berkasnya tidak valid.' }, { status: 400 });

    const md = keMarkdown({
      title: judul,
      summary: String(b.summary ?? '').trim(),
      stack: Array.isArray(b.stack) ? b.stack.map(String) : [],
      year: Number(b.year) || undefined,
      repo: b.repo ? String(b.repo) : undefined,
      demo: b.demo ? String(b.demo) : undefined,
      image: b.image ? String(b.image) : undefined,
      order: Number(b.order) || 10,
      body: String(b.body ?? ''),
    });
    await tulis(`${FOLDER}/${slug}.md`, md, `Admin: simpan projek ${slug}`);
    return Response.json({ ok: true, slug });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const tolak = await jaga(cookies);
  if (tolak) return tolak;
  try {
    const slug = (url.searchParams.get('slug') ?? '').replace(/[^a-z0-9-]/g, '');
    if (!slug) return Response.json({ error: 'Slug tidak valid.' }, { status: 400 });
    await hapus(`${FOLDER}/${slug}.md`, `Admin: hapus projek ${slug}`);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
};
