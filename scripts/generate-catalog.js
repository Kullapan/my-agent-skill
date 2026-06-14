#!/usr/bin/env node
/**
 * generate-catalog.js
 *
 * Crawls all skill packages and generates:
 *   - catalog.json  (machine-readable skill index)
 *   - CATALOG.md    (human-readable skill index)
 *
 * Usage:
 *   node scripts/generate-catalog.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'scripts', '_templates', '.github']);

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const raw = match[1];
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return fm;
}

/** Parse multi-line SKILL.md metadata block (handles nested metadata:) */
function parseSkillMd(content) {
  const fm = parseFrontmatter(content);
  // Try to extract tags array from nested metadata block
  const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
  if (tagsMatch) {
    fm.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
  }
  // Extract author from nested metadata:
  const authorMatch = content.match(/^\s+author:\s*["']?(.+?)["']?\s*$/m);
  if (authorMatch) fm.author = authorMatch[1];
  return fm;
}

function countRules(skillDir) {
  const rulesDir = join(skillDir, 'rules');
  if (!existsSync(rulesDir)) return 0;
  return readdirSync(rulesDir).filter(f => f.endsWith('.md') && !f.startsWith('_')).length;
}

function discoverSkills() {
  return readdirSync(ROOT)
    .filter(entry => {
      if (SKIP_DIRS.has(entry)) return false;
      const fullPath = join(ROOT, entry);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'SKILL.md'));
    })
    .sort();
}

// ── Build catalog entries ────────────────────────────────────────────────────

const skills = discoverSkills();
console.log(`\n📚 Generating catalog for ${skills.length} skill(s)...\n`);

const catalog = [];

for (const skillName of skills) {
  const skillDir  = join(ROOT, skillName);
  const skillMd   = join(skillDir, 'SKILL.md');
  const metaFile  = join(skillDir, 'metadata.json');

  const fm = existsSync(skillMd)
    ? parseSkillMd(readFileSync(skillMd, 'utf-8'))
    : {};

  let meta = {};
  if (existsSync(metaFile)) {
    try { meta = JSON.parse(readFileSync(metaFile, 'utf-8')); } catch {}
  }

  const entry = {
    name:         fm.name        || skillName,
    directory:    skillName,
    description:  fm.description || meta.abstract?.slice(0, 120) || '',
    license:      fm.license     || 'UNKNOWN',
    author:       fm.author      || meta.organization || '',
    version:      meta.version   || fm['metadata.version'] || '0.0.0',
    tags:         fm.tags        || [],
    ruleCount:    countRules(skillDir),
    skillFile:    `./${skillName}/SKILL.md`,
    agentsFile:   existsSync(join(skillDir, 'AGENTS.md')) ? `./${skillName}/AGENTS.md` : null,
  };

  catalog.push(entry);
  console.log(`  ✅ ${entry.name} (${entry.ruleCount} rules)`);
}

// ── Write catalog.json ───────────────────────────────────────────────────────

const catalogJson = {
  generated:    new Date().toISOString(),
  totalSkills:  catalog.length,
  totalRules:   catalog.reduce((sum, s) => sum + s.ruleCount, 0),
  skills:       catalog,
};

writeFileSync(
  join(ROOT, 'catalog.json'),
  JSON.stringify(catalogJson, null, 2),
  'utf-8'
);
console.log(`\n✅ Written: catalog.json`);

// ── Write CATALOG.md ─────────────────────────────────────────────────────────

const lines = [];
const now = new Date().toUTCString();

lines.push('# Skill Catalog');
lines.push('');
lines.push(`> **Auto-generated** on ${now}. Do not edit manually — run \`npm run catalog\` to regenerate.`);
lines.push('');
lines.push(`**${catalog.length} skill(s)** · **${catalogJson.totalRules} total rules**`);
lines.push('');
lines.push('---');
lines.push('');

// Summary table
lines.push('## Skills at a Glance');
lines.push('');
lines.push('| Skill | Description | Rules | Version | License |');
lines.push('|-------|-------------|-------|---------|---------|');
for (const s of catalog) {
  const desc = s.description.length > 80
    ? s.description.slice(0, 77) + '...'
    : s.description;
  lines.push(`| [${s.name}](./${s.directory}/) | ${desc} | ${s.ruleCount} | ${s.version} | ${s.license} |`);
}
lines.push('');
lines.push('---');
lines.push('');

// Detailed entries
lines.push('## Skill Details');
lines.push('');
for (const s of catalog) {
  lines.push(`### ${s.name}`);
  lines.push('');
  if (s.author) lines.push(`**Author:** ${s.author}`);
  lines.push(`**Version:** ${s.version}`);
  lines.push(`**License:** ${s.license}`);
  lines.push(`**Rules:** ${s.ruleCount}`);
  if (s.tags?.length > 0) lines.push(`**Tags:** ${s.tags.join(', ')}`);
  lines.push('');
  lines.push(s.description);
  lines.push('');
  lines.push('**Files:**');
  lines.push(`- [SKILL.md](${s.skillFile}) — Agent entry point`);
  if (s.agentsFile) {
    lines.push(`- [AGENTS.md](${s.agentsFile}) — Compiled rules (agent-optimized)`);
  }
  lines.push(`- [README.md](./${s.directory}/README.md) — Contributor guide`);
  lines.push('');
  lines.push('---');
  lines.push('');
}

// Footer
lines.push('*To add a new skill, see the [README](./README.md#adding-a-new-skill).*');

writeFileSync(join(ROOT, 'CATALOG.md'), lines.join('\n'), 'utf-8');
console.log('✅ Written: CATALOG.md');
console.log(`\n📊 Summary: ${catalog.length} skill(s), ${catalogJson.totalRules} total rules.`);
