// Entry point for the threejs-fps-02 bounty submission (Node 22, standard library only).
//
// This program hands the finished game in. The game itself is plain static files under
// game/ in this repository — ES modules the browser loads with no build step, three.js
// 0.187.0 vendored under game/vendor/three/ and wired up through the import map in
// game/index.html — plus 3 or 4 screenshots of the game in screenshots/ (the first by
// name is the cover image). Running this file copies both folders into the output
// directory and writes dossier.json there, the summary the judge reads, built with the
// kit's vendored make.fun library. The game is SALTWATCH, a night-dock tactical FPS:
// Tide vs Rust, plant/defuse, buy economy, five weapons and two grenades.
//
// The grader runs this program twice in a fresh container with no network and a
// read-only repository; both runs must write identical bytes. Nothing here depends on
// the clock, the environment beyond MAKEFUN_OUTPUT_DIR, or any file outside this repo,
// so the output is deterministic. Locally, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// The repository root is the directory this file lives in.
const root = fileURLToPath(new URL('.', import.meta.url));

// Where the finished entry goes: the grader's /output, or MAKEFUN_OUTPUT_DIR outside it.
// An empty MAKEFUN_OUTPUT_DIR is treated as unset, so a stray empty variable cannot
// turn the output path into a bare relative join.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() ? process.env.MAKEFUN_OUTPUT_DIR : '/output';

// Caps the scorer enforces on what this program writes (see the kit's RULES.txt):
// the dossier text stays under 160 KiB, at most 4 screenshots of at most 256 KiB each,
// game/ at most 993 files totalling at most 48 MiB, so the whole of /output fits the
// platform's own 1,000-entry / 64 MiB cap alongside dossier.json and screenshots/.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function copyFolder(name) {
  const source = join(root, name);
  const target = join(outputDir, name);
  if (!existsSync(source)) {
    // A missing folder would hand in an entry the gate refuses, so fail loudly
    // here instead of writing a partial /output and letting the grader find out.
    throw new Error(`cannot hand in the entry: ${name}/ is missing from ${root}`);
  }
  // Clear any stale copy first so a re-run never leaves files from an older build behind.
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

// game/index.html is what the browser opens; without it there is no entry at all.
if (!existsSync(join(root, 'game', 'index.html'))) {
  throw new Error(`cannot hand in the entry: game/index.html is missing from ${root}`);
}

mkdirSync(outputDir, { recursive: true });
copyFolder('game');
copyFolder('screenshots');

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
