import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

// Относительные пути: сайт работает и на localhost, и на <user>.github.io/<repo>/
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // Little Apps — отдельные страницы рядом с основным сайтом
      input: {
        main: page('index.html'),
        apps: page('apps/index.html'),
        cabbageFarm: page('apps/cabbage-farm/index.html'),
      },
    },
  },
});
