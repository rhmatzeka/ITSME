import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

/**
 * Jembatan Astro ↔ Phaser.
 *
 * Content Collections cuma bisa dibaca saat build (server-side), sedangkan game
 * jalan di browser. Endpoint ini di-prerender jadi file statis, lalu di-fetch
 * sekali oleh PreloadScene — jadi ikut kehitung di loading bar.
 *
 * Satu sumber Markdown, dua konsumen: halaman statis dan game.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const [projects, memos, pages] = await Promise.all([
    getCollection('projects'),
    getCollection('memos'),
    getCollection('pages'),
  ]);

  // Markdown diubah jadi HTML DI SINI, saat build. Panel di dalam game cuma
  // menempelkan hasilnya — tidak ada parser markdown yang ikut ke browser.
  const html = (md: string) => marked.parse(md, { async: false }) as string;

  return new Response(
    JSON.stringify({
      projects: projects
        .sort((a, b) => a.data.order - b.data.order)
        .map((p) => ({ slug: p.id, ...p.data, html: html(p.body ?? '') })),
      memos: memos.map((m) => ({ slug: m.id, ...m.data, html: html(m.body ?? '') })),
      pages: pages.map((p) => ({ slug: p.id, ...p.data, html: html(p.body ?? '') })),
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
