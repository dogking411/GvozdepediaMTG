import { defineConfig } from 'vite';

// Относительные пути: сайт работает и на localhost, и на <user>.github.io/<repo>/
export default defineConfig({
  base: './',
});
