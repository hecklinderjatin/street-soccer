import { defineConfig, type Plugin } from 'vite';
import { devvit } from '@devvit/start/vite';
import { resolve } from 'node:path';

// Phaser's source decides features with `typeof FLAG` checks that its own
// build replaces; do the same for the trimmed Phaser (tools/phaser-trim.cjs):
// WebGL only (the court needs it), sound kept, no debug or extra plugins.
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: false,
  WEBGL_RENDERER: true,
  WEBGL_DEBUG: false,
  EXPERIMENTAL: false,
  PLUGIN_3D: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
  FEATURE_SOUND: true,
};
const FLAG_PATTERN = new RegExp(
  `typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`,
  'g'
);

function phaserFlags(): Plugin {
  return {
    name: 'phaser-flags',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('/node_modules/phaser/src/'))
        return null;
      if (!FLAG_PATTERN.test(code)) return null;
      FLAG_PATTERN.lastIndex = 0;
      return {
        code: code.replace(FLAG_PATTERN, (_, flag: string) =>
          String(PHASER_FLAGS[flag] ?? false)
        ),
        map: null,
      };
    },
  };
}

export default defineConfig({
  publicDir: resolve('public-release'),
  define: {
    __JOURNEYS_ENABLED__: JSON.stringify(
      process.env.STREET_SOCCER_JOURNEYS_ENABLED !== 'false'
    ),
  },
  resolve: {
    alias: [
      { find: /^phaser$/, replacement: resolve('tools/phaser-trim.cjs') },
    ],
  },
  plugins: [
    phaserFlags(),
    devvit({
      client: { build: { sourcemap: false } },
      server: { build: { sourcemap: false } },
    }),
  ],
});
