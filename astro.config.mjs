import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { EXCLUDED_PATH_PREFIXES } from './src/lib/trackedPaths.ts';

export default defineConfig({
  site: 'https://tie-break.it',

  output: 'server',

  adapter: netlify(),

  integrations: [
    svelte(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  devToolbar: {
    enabled: false,
  },
});
