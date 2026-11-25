// gates.test.js — the sealed gate's constraints, run against the real main.ts
// output: determinism (two runs byte-identical), game_files caps, references
// (real reference resolution, never a substring grep), screenshots caps,
// dossier_matches, js_parses (module-aware), and the no-persistence /
// no-eval / no-network rules. TDD first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, readdirSync, readFileSync, statSync, lstatSync, mkdtempSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from '../vendor/makefun-game.ts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = join(REPO, 'main.ts');

function runMain(outDir) {
  execFileSync(process.execPath, [MAIN], {
    cwd: REPO,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    stdio: 'pipe',
    timeout: 30000,
  });
}

function treeBytes(dir, prefix = '') {
  const out = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of treeBytes(full, rel)) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(rel, readFileSync(full));
    }
  }
  return out;
}

function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out.sort();
}

// One shared output tree for the gate tests (built once, reused).
let OUT;
test.before(() => {
  OUT = mkdtempSync(join(tmpdir(), 'cooking-out-'));
  runMain(OUT);
});
test.after(() => {
  if (OUT) rmSync(OUT, { recursive: true, force: true });
});

test('main.ts runs twice and writes byte-identical trees (determinism)', () => {
  const outA = mkdtempSync(join(tmpdir(), 'cooking-a-'));
  const outB = mkdtempSync(join(tmpdir(), 'cooking-b-'));
  try {
    runMain(outA);
    runMain(outB);
    const a = treeBytes(outA);
    const b = treeBytes(outB);
    assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), 'same file lists');
    for (const [path, bytes] of a) {
      assert.ok(b.get(path).equals(bytes), `${path} is byte-identical across runs`);
    }
  } finally {
    rmSync(outA, { recursive: true, force: true });
    rmSync(outB, { recursive: true, force: true });
  }
});

test('main.ts copies only game/ + screenshots/ and writes dossier.json', () => {
  const names = readdirSync(OUT).sort();
  assert.deepEqual(names, ['dossier.json', 'game', 'screenshots'], 'output holds exactly game/, screenshots/ and dossier.json');
  assert.ok(existsSync(join(OUT, 'game', 'index.html')));
  assert.ok(!existsSync(join(OUT, 'tests')), 'tests/ must never be copied into /output');
  assert.ok(!existsSync(join(OUT, 'PLAN.md')), 'PLAN.md must never be copied into /output');
});

test('game_files: caps on entries, bytes, paths, index.html; no symlinks', () => {
  const gameDir = join(OUT, 'game');
  let entries = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      entries++;
      const full = join(dir, entry.name);
      assert.ok(!entry.isSymbolicLink(), `${full} must not be a symlink`);
      if (entry.isDirectory()) walk(full);
      else {
        bytes += statSync(full).size;
        const rel = full.slice(gameDir.length + 1);
        assert.ok(Buffer.byteLength(rel, 'utf8') <= 1000, `path ${rel} over 1,000 bytes`);
      }
    }
  };
  walk(gameDir);
  assert.ok(entries <= 993, `game/ holds ${entries} entries, cap 993`);
  assert.ok(bytes <= 48 * 1024 * 1024, `game/ is ${bytes} bytes, cap 48 MiB`);
  assert.ok(statSync(join(gameDir, 'index.html')).size <= 1024 * 1024, 'index.html over 1 MiB');
});

test('references: every real reference resolves inside game/; no import map, no bare specifiers', () => {
  const gameDir = join(OUT, 'game');
  const html = readFileSync(join(gameDir, 'index.html'), 'utf8');
  assert.ok(!html.includes('type="importmap"'), 'no import map may be present');
  const existsInGame = (rel) => {
    const full = resolve(gameDir, rel);
    return full.startsWith(gameDir) && existsSync(full) && statSync(full).isFile();
  };
  // HTML attributes: <script src>, <link href>, media src.
  const attrRefs = [...html.matchAll(/<(?:script|link|img|source|video|audio|iframe)[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1]);
  assert.ok(attrRefs.length > 0, 'the page references at least one local file');
  for (const ref of attrRefs) {
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith('//'),
      `reference ${ref} must not name an external URL`);
    assert.ok(ref.startsWith('data:') || existsInGame(ref.replace(/^[./]+/, '')) || existsInGame(ref),
      `reference ${ref} must resolve to a file inside game/`);
  }
  // Static + dynamic import specifiers in every reachable .js/.mjs file.
  const jsFiles = listFiles(gameDir).filter((f) => /\.(?:js|mjs)$/.test(f));
  assert.ok(jsFiles.length > 0, 'game/ holds scripts');
  for (const file of jsFiles) {
    const code = readFileSync(join(gameDir, file), 'utf8');
    const specifiers = [
      ...code.matchAll(/import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g),
      ...code.matchAll(/export\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g),
      ...code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.ok(!spec.startsWith('node:'), `${file}: static node: import ${spec} fails the gate`);
      assert.ok(spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('data:'),
        `${file}: bare specifier ${spec} is not allowed without an import map`);
      if (spec.startsWith('data:')) continue;
      const fromDir = dirname(file);
      const resolved = resolve(gameDir, fromDir, spec);
      assert.ok(resolved.startsWith(gameDir) && existsInGame(resolved.slice(gameDir.length + 1)),
        `${file}: import ${spec} must resolve inside game/`);
    }
  }
});

test('screenshots: exactly 4, named right, each a whole JPEG/PNG in cap and size', () => {
  const shotsDir = join(OUT, 'screenshots');
  const names = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  assert.deepEqual(names, ['1-cover.jpg', '2-play.jpg', '3-rush.jpg', '4-serve.jpg']);
  const seen = new Set();
  for (const name of names) {
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name), `name ${name} matches the gate pattern`);
    const bytes = readFileSync(join(shotsDir, name));
    assert.ok(bytes.length <= 256 * 1024, `${name} is ${bytes.length} bytes, cap 256 KiB`);
    const dims = imageDimensions(bytes);
    assert.ok(dims, `${name} parses as a whole PNG or JPEG`);
    const long = Math.max(dims.width, dims.height);
    const short = Math.min(dims.width, dims.height);
    assert.ok(long <= 1280, `${name} long side ${long} over 1280`);
    assert.ok(short >= 480, `${name} short side ${short} under 480`);
    assert.equal(long, 1280, `${name} is 1280 on its long side`);
    assert.equal(short, 720, `${name} is 720 on its short side`);
    seen.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(seen.size, 4, 'the four shots are mutually different renders');
});

// Parse PNG IHDR or JPEG SOF0/SOF2 dimensions from raw bytes (no image library).
function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

test('dossier_matches: fresh buildDossier output is byte-identical to dossier.json', () => {
  const written = readFileSync(join(OUT, 'dossier.json'));
  assert.ok(written.length <= 1.5 * 1024 * 1024, `dossier.json is ${written.length} bytes, cap 1.5 MiB`);
  const fresh = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  assert.ok(Buffer.from(fresh).equals(written), 'dossier.json is byte for byte what buildDossier writes');
  const doc = JSON.parse(written.toString('utf8'));
  assert.equal(doc.schema, 'makefun/dossier/v1');
  assert.ok(Buffer.byteLength(doc.text, 'utf8') <= 163840,
    `dossier text is ${Buffer.byteLength(doc.text, 'utf8')} bytes, cap 163,840`);
  assert.equal(doc.images.length, 4, 'the dossier carries all 4 screenshots');
  assert.equal(doc.images[0].name, '1-cover.jpg', 'the cover is first');
});

test('js_parses: every game script parses as an ES module', () => {
  const gameDir = join(OUT, 'game');
  const jsFiles = listFiles(gameDir).filter((f) => /\.(?:js|mjs)$/.test(f));
  assert.ok(jsFiles.length >= 10, `expected 10+ scripts, found ${jsFiles.length}`);
  for (const file of jsFiles) {
    const code = readFileSync(join(gameDir, file), 'utf8');
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: code, encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${file} must parse as an ES module: ${result.stderr}`);
  }
});

test('no persistence, no eval, no network calls anywhere in game/', () => {
  const gameDir = join(OUT, 'game');
  const forbidden = [
    'localStorage', 'sessionStorage', 'document.cookie', 'indexedDB',
    'eval(', 'new Function', 'fetch(', 'XMLHttpRequest', 'new Worker',
    'importScripts', 'WebSocket',
  ];
  const files = listFiles(gameDir);
  for (const file of files) {
    const text = readFileSync(join(gameDir, file), 'utf8');
    for (const needle of forbidden) {
      assert.ok(!text.includes(needle), `game/${file} must not contain ${needle}`);
    }
  }
});

test('game source stays small enough for the whole dossier text to fit', () => {
  const gameDir = join(OUT, 'game');
  const sources = listFiles(gameDir).filter((f) => /\.(?:html|js|mjs|css|json)$/.test(f));
  let total = 0;
  for (const file of sources) {
    const size = statSync(join(gameDir, file)).size;
    assert.ok(size <= 30 * 1024, `game/${file} is ${size} bytes, budget ~30 KiB per module`);
    total += size;
  }
  assert.ok(total <= 120 * 1024, `total game source is ${total} bytes, budget 120 KiB`);
});
