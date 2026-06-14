#!/usr/bin/env node
/**
 * build-all.js
 *
 * Discovers all skill packages in the repo root and runs build-skill.js for each.
 * A skill package is any top-level directory that contains a SKILL.md file.
 *
 * Usage:
 *   node scripts/build-all.js
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Directories to always skip
const SKIP_DIRS = new Set(['node_modules', '.git', 'scripts', '_templates', '.github']);

function discoverSkills(root) {
  const entries = readdirSync(root);
  const skills = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(root, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (existsSync(join(fullPath, 'SKILL.md'))) {
      skills.push(entry);
    }
  }
  return skills;
}

const skills = discoverSkills(ROOT);

if (skills.length === 0) {
  console.warn('⚠️  No skill packages found (directories with SKILL.md).');
  process.exit(0);
}

console.log(`\n🚀 Building ${skills.length} skill(s):\n`);
skills.forEach(s => console.log(`   • ${s}`));
console.log('');

let failed = 0;
for (const skill of skills) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, 'build-skill.js'), '--skill', skill],
    { cwd: ROOT, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    console.error(`❌ Build failed for: ${skill}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n❌ ${failed} skill(s) failed to build.`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${skills.length} skill(s) built successfully.`);
}
