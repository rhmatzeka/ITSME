import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

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

  return new Response(
    JSON.stringify({
      projects: projects
        .sort((a, b) => a.data.order - b.data.order)
        .map((p) => ({ slug: p.id, ...p.data, body: p.body })),
      memos: memos.map((m) => ({ slug: m.id, ...m.data, body: m.body })),
      pages: pages.map((p) => ({ slug: p.id, ...p.data, body: p.body })),
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
