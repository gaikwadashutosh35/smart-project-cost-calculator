import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { fillPlaceholders, writeStaticSeoFiles } from './seo.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // SITE_URL, catalogue counts and generated tables (see fillPlaceholders in seo.ts).
      { name: 'site-placeholders', transformIndexHtml: (html: string) => fillPlaceholders(html) },
      // robots.txt, sitemap.xml, llms.txt, llms-full.txt and Netlify _headers, written into dist/ after the build.
      { name: 'seo-files', apply: 'build', closeBundle: () => writeStaticSeoFiles(path.resolve(import.meta.dirname, 'dist')) },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          home: path.resolve(import.meta.dirname, 'index.html'),
          calculator: path.resolve(import.meta.dirname, 'calculator/index.html'),
          about: path.resolve(import.meta.dirname, 'about/index.html'),
          supabase: path.resolve(import.meta.dirname, 'supabase-pricing-calculator/index.html'),
          sbVsNeon: path.resolve(import.meta.dirname, 'guides/supabase-vs-neon-pricing/index.html'),
          notFound: path.resolve(import.meta.dirname, '404.html'),
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
