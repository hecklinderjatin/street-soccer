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

// Rolldown can emit identical empty JS proxies for distinct CSS files. Devvit
// deduplicates their bytes but loses the other URL aliases on a fresh upload.
// Keep generated proxies addressable without changing their imports or CSS.
function distinctWebviewScripts(): Plugin {
  return {
    name: 'distinct-webview-scripts',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const scripts = new Map<string, string[]>();
        for (const entry of Object.values(bundle)) {
          if (entry.type !== 'chunk' || !entry.fileName.endsWith('.js'))
            continue;
          const names = scripts.get(entry.code) ?? [];
          names.push(entry.fileName);
          scripts.set(entry.code, names);
        }
        for (const names of scripts.values()) {
          if (names.length < 2) continue;
          for (const name of names) {
            const entry = bundle[name];
            if (entry?.type === 'chunk')
              entry.code += `\n/* Devvit upload path: ${encodeURIComponent(name)} */\n`;
          }
        }
      },
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
    distinctWebviewScripts(),
  ],
});
