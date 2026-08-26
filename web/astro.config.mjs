import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
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
