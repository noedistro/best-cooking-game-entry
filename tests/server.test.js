// server.test.js — the local static server serves game/ on localhost and every
// src/href in the served HTML resolves to a 200 inside game/. References are
// resolved as attributes, never by grepping the body for substrings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18081;

function get(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolvePromise({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

async function waitForServer(server, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await get('/');
      if (res.status === 200) return;
    } catch {
      // Not up yet; keep waiting.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('serve.ts did not answer on 127.0.0.1:18081 within 5 s');
}

test('serve.ts serves index.html and every local reference resolves', async () => {
  const server = spawn(process.execPath, ['serve.ts', String(PORT)], { cwd: REPO, stdio: 'pipe' });
  try {
    await waitForServer(server);
    const home = await get('/');
    assert.equal(home.status, 200, 'GET / returns 200');
    assert.ok(home.body.includes('<canvas'), 'the page carries the game canvas');
    assert.ok(home.body.includes('src/main.js') || home.body.includes('./src/main.js'), 'the page loads its entry script');
    // Resolve every real reference: script src, link href, media src.
    const refs = [...home.body.matchAll(/<(?:script|link|img|source|video|audio|iframe)[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1]);
    assert.ok(refs.length > 0, 'the page has references to check');
    for (const ref of refs) {
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith('//'),
        `reference ${ref} must be relative or a data: URI, never an external URL`);
      if (ref.startsWith('data:')) continue;
      const path = ref.startsWith('/') ? ref : `/${ref.replace(/^\.\//, '')}`;
      const res = await get(path);
      assert.equal(res.status, 200, `${ref} resolves to a 200 inside game/`);
    }
    const missing = await get('/no-such-file.js');
    assert.equal(missing.status, 404, 'a missing file answers 404, not a crash');
    const traversal = await get('/..%2f..%2fetc%2fpasswd');
    assert.ok(traversal.status === 404 || traversal.status === 400, 'path traversal is refused');
  } finally {
    server.kill('SIGTERM');
  }
});
