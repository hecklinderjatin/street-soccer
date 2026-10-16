// Local preview of the built game (npm start): serves dist/client on
// http://localhost:4173 (PORT to change it). No dependencies; the game runs
// as a guest outside Reddit. Run `npm run build` first (npm start does).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve('dist/client');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

try {
  await stat(join(root, 'index.html'));
} catch {
  console.error(`No build in ${root}: run \`npm run build\` first.`);
  process.exit(1);
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type':
        types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store', // always the latest build on refresh
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`Street Soccer: http://localhost:${port}/`);
  console.log(`  debug overlay: http://localhost:${port}/?debug`);
  console.log(`  splash card:   http://localhost:${port}/splash.html`);
  console.log('Ctrl+C to stop.');
});
