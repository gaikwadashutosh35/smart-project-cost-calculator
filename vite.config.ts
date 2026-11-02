import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { fillPlaceholders } from './seo';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // SITE_URL, catalogue counts and generated tables (see fillPlaceholders in seo.ts).
      { name: 'site-placeholders', transformIndexHtml: (html: string) => fillPlaceholders(html) },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          home: path.resolve(__dirname, 'index.html'),
          calculator: path.resolve(__dirname, 'calculator/index.html'),
          about: path.resolve(__dirname, 'about/index.html'),
          supabase: path.resolve(__dirname, 'supabase-pricing-calculator/index.html'),
          notFound: path.resolve(__dirname, '404.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
