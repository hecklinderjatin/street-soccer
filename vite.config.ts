import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';
import { resolve } from 'node:path';

export default defineConfig({
  publicDir: resolve('public-release'),
  plugins: [
    devvit({
      client: { build: { sourcemap: false } },
      server: { build: { sourcemap: false } },
    }),
  ],
});
