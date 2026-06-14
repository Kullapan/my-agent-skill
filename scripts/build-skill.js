#!/usr/bin/env node
/**
 * build-skill.js
 *
 * Compiles all rule files in a skill's rules/ directory into a single AGENTS.md.
 *
 * Usage:
 *   node scripts/build-skill.js --skill <skill-dir-name>
 *   node scripts/build-skill.js --skill react-best-practices
 *
 * Options:
 *   --skill <name>   Name of the skill directory (relative to repo root)
 *   --root  <path>   Repo root path (defaults to cwd)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { parseArgs } from 'util';

// ── Argument parsing ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    skill: { type: 'string' },
    root:  { type: 'string' },
  },
});

if (!args.skill) {
  console.error('Error: --skill <name> is required');
  process.exit(1);
}

const ROOT       = resolve(args.root || process.cwd());
const SKILL_DIR  = join(ROOT, args.skill);
const RULES_DIR  = join(SKILL_DIR, 'rules');
const OUTPUT     = join(SKILL_DIR, 'AGENTS.md');
const METADATA   = join(SKILL_DIR, 'metadata.json');
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md');

if (!existsSync(SKILL_DIR)) {
  console.error(`Error: skill directory not found: ${SKILL_DIR}`);
  process.exit(1);
}
if (!existsSync(RULES_DIR)) {
  console.error(`Error: rules/ directory not found inside ${args.skill}`);
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse YAML-ish frontmatter between --- delimiters */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const raw = match[1];
  const frontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    frontmatter[key] = val;
  }
  const body = content.slice(match[0].length).trim();
  return { frontmatter, body };
}

/** Map filename prefix → section name */
function getSectionFromPrefix(prefix, sections) {
  return sections[prefix] || { title: prefix, impact: 'UNKNOWN', description: '' };
}

/** Parse _sections.md into a map of prefix → { title, impact, description } */
function parseSections(sectionsPath) {
  if (!existsSync(sectionsPath)) return {};
  const content = readFileSync(sectionsPath, 'utf-8');
  const map = {};

  // Match blocks like: ## N. Title (prefix)
  const blockRe = /^##\s+\d+\.\s+(.+?)\s+\((\w+)\)\s*$([\s\S]*?)(?=^##\s+\d+\.|$)/gm;
  let m;
  while ((m = blockRe.exec(content)) !== null) {
    const title       = m[1].trim();
    const prefix      = m[2].trim().toLowerCase();
    const blockText   = m[3];
    const impactMatch = blockText.match(/\*\*Impact:\*\*\s*(\S+)/);
    const descMatch   = blockText.match(/\*\*Description:\*\*\s*(.+)/);
    map[prefix] = {
      title,
      impact:      impactMatch ? impactMatch[1] : 'UNKNOWN',
      description: descMatch  ? descMatch[1].trim() : '',
    };
  }
  return map;
}

// ── Main logic ───────────────────────────────────────────────────────────────

console.log(`\n🔨 Building AGENTS.md for skill: ${args.skill}\n`);

// Read metadata
let meta = {};
if (existsSync(METADATA)) {
  try { meta = JSON.parse(readFileSync(METADATA, 'utf-8')); } catch {}
}

// Read sections
const sections = parseSections(join(RULES_DIR, '_sections.md'));

// Gather rule files (exclude files starting with _)
const ruleFiles = readdirSync(RULES_DIR)
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .sort();

if (ruleFiles.length === 0) {
  console.warn('Warning: no rule files found in rules/');
}

// Group rules by section prefix
const grouped = {};
for (const file of ruleFiles) {
  const prefix = file.split('-')[0];
  if (!grouped[prefix]) grouped[prefix] = [];
  grouped[prefix].push(file);
}

// Build AGENTS.md content
const lines = [];

// Document header
const skillName = args.skill
  .split('-')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

lines.push(`# ${skillName}`);
lines.push('');
if (meta.organization) lines.push(`> **Organization:** ${meta.organization}`);
if (meta.version)      lines.push(`> **Version:** ${meta.version}`);
if (meta.date)         lines.push(`> **Date:** ${meta.date}`);
lines.push('');
if (meta.abstract) {
  lines.push('## Abstract');
  lines.push('');
  lines.push(meta.abstract);
  lines.push('');
}

// Table of contents
lines.push('## Table of Contents');
lines.push('');
let sectionIdx = 1;
for (const [prefix, files] of Object.entries(grouped)) {
  const sec = getSectionFromPrefix(prefix, sections);
  lines.push(`${sectionIdx}. [${sec.title || prefix}](#section-${sectionIdx})`);
  sectionIdx++;
}
lines.push('');
lines.push('---');
lines.push('');

// Sections and rules
sectionIdx = 1;
for (const [prefix, files] of Object.entries(grouped)) {
  const sec = getSectionFromPrefix(prefix, sections);
  lines.push(`## ${sectionIdx}. ${sec.title || prefix} {#section-${sectionIdx}}`);
  lines.push('');
  if (sec.impact)      lines.push(`**Impact:** ${sec.impact}`);
  if (sec.description) lines.push(`**Description:** ${sec.description}`);
  lines.push('');

  let ruleIdx = 1;
  for (const file of files) {
    const content = readFileSync(join(RULES_DIR, file), 'utf-8');
    const { body } = parseFrontmatter(content);
    lines.push(body);
    lines.push('');
    lines.push('---');
    lines.push('');
    ruleIdx++;
  }
  sectionIdx++;
}

// References
if (meta.references && meta.references.length > 0) {
  lines.push('## References');
  lines.push('');
  for (const ref of meta.references) {
    lines.push(`- ${ref}`);
  }
  lines.push('');
}

const output = lines.join('\n');
writeFileSync(OUTPUT, output, 'utf-8');
console.log(`✅ Written: ${OUTPUT}`);
console.log(`   Sections: ${Object.keys(grouped).length}`);
console.log(`   Rules:    ${ruleFiles.length}`);
