// main.ts — the entrypoint: hand the game in. It copies game/ and
// screenshots/ from this repository to the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22 standard library only; deterministic: the same tree in, the same
// bytes out, on every run. MAKEFUN_OUTPUT_DIR stands in for /output
// outside the grader.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// Never wipe the repository itself: the output directory must live outside it.
if (outDir === repoRoot || outDir.startsWith(`${repoRoot}/`)) {
  throw new Error(`MAKEFUN_OUTPUT_DIR must be outside the repository, not ${outDir}`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`wrote ${outDir} (game/ + screenshots/ + dossier.json, ${dossier.length} bytes)`);
