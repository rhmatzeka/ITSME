import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Halaman tetap statis; hanya route /api yang berjalan sebagai fungsi
  // serverless — dipilih lewat `export const prerender = false` di berkasnya.
  output: 'static',
  adapter: vercel(),
  vite: {
    plugins: [tailwind()],
    build: {
      // Phaser besar; pisahkan supaya sisa halaman tetap ringan
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
        },
      },
    },
  },
});
