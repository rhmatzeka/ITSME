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
    /** Gambar projek, diunggah lewat halaman admin. */
    image: z.string().optional(),
    order: z.number().default(99),
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
    linkedin: z.string().url().optional(),
    /** Daftar berkelompok (Tech Stack): dirender jadi chip, bukan paragraf
        panjang yang dipisah titik tengah — pemenggalan barisnya selalu jelek. */
    groups: z
      .array(z.object({ title: z.string(), items: z.array(z.string()) }))
      .optional(),
    /** Halaman Contact: kartu tautan berikon, bukan daftar Markdown. */
    intro: z.string().optional(),
    outro: z.string().optional(),
    links: z
      .array(
        z.object({
          icon: z.enum(['mail', 'whatsapp', 'linkedin', 'github', 'doc']),
          label: z.string(),
          value: z.string(),
          url: z.string(),
        })
      )
      .optional(),
  }),
});

export const collections = { projects, pages };
