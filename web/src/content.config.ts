import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Nambah projek = nambah satu file .md di src/content/projects/.
 * Tidak perlu menyentuh kode. Zod memvalidasi frontmatter saat build,
 * jadi salah ketik ketahuan sebelum deploy.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    stack: z.array(z.string()).default([]),
    year: z.number().optional(),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    order: z.number().default(99),
  }),
});

const memos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/memos' }),
  schema: z.object({
    title: z.string(),
    /** POI mana yang membuka memo ini, mis. "bangku_1". */
    poi: z.string(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    /** Slug panel yang dibuka game, mis. "about" / "cv". */
    panel: z.string(),
    /** Kartu profil di atas isi — dipakai halaman About. */
    name: z.string().optional(),
    role: z.string().optional(),
    photo: z.string().optional(),
  }),
});

export const collections = { projects, memos, pages };
