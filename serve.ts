// serve.ts — a tiny static server for local play-testing only. It serves
// game/ on localhost (default port 8080, or the port given as an argument)
// and never leaves the repository. Not part of the shipped game.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'text/plain' });
      res.end('method not allowed');
      return;
    }
    const rawPath = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
    const rel = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^[/\\]+/, '');
    const full = join(root, rel);
    if (!full.startsWith(root)) {
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end('bad path');
      return;
    }
    const bytes = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving game/ at http://127.0.0.1:${port}`);
});
