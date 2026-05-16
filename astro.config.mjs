import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',

  adapter: netlify(),

  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()],
  },

  devToolbar: {
    enabled: false,
  },
});