#!/usr/bin/env node
/**
 * extract-tests.js
 *
 * Extracts Incorrect/Correct code pairs from rule files and writes test-cases.json.
 *
 * Usage:
 *   node scripts/extract-tests.js --skill <name>   # one skill
 *   node scripts/extract-tests.js --all            # all skills
 *
 * Output: <skill-dir>/test-cases.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'scripts', '_templates', '.github']);

// ── Argument parsing ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    skill: { type: 'string' },
    all:   { type: 'boolean' },
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const raw = match[1];
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return { frontmatter: fm, body: content.slice(match[0].length).trim() };
}

/**
 * Extract all fenced code blocks after an "Incorrect" or "Correct" heading.
 * Returns an array of { type: 'incorrect'|'correct', lang, code, context } objects.
 */
function extractCodePairs(body) {
  const blocks = [];
  // Split body by "**Incorrect" and "**Correct" markers
  const sections = body.split(/\*\*(Incorrect|Correct)[^*]*\*\*[^\n]*\n/i);
  let currentType = null;
  for (let i = 0; i < sections.length; i++) {
    const chunk = sections[i];
    const typeMatch = chunk.match(/^(Incorrect|Correct)$/i);
    if (typeMatch) {
      currentType = typeMatch[1].toLowerCase();
      continue;
    }
    if (!currentType) continue;
    // Extract code blocks from this chunk
    const codeRe = /```(\w*)\n([\s\S]*?)```/g;
    let m;
    while ((m = codeRe.exec(chunk)) !== null) {
      blocks.push({
        type: currentType,
        lang: m[1] || 'text',
        code: m[2].trim(),
      });
    }
    currentType = null;
  }
  return blocks;
}

function extractTestCasesFromSkill(skillName) {
  const skillDir = join(ROOT, skillName);
  const rulesDir = join(skillDir, 'rules');
  if (!existsSync(rulesDir)) return [];

  const ruleFiles = readdirSync(rulesDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'));

  const testCases = [];
  for (const file of ruleFiles) {
    const content = readFileSync(join(rulesDir, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Look for pairs: **Incorrect/Vulnerable...**: followed by **Correct/Secure...**:
    // Handles CRLF + blank line between marker and code fence
    const incorrectRe = /\*\*(Incorrect|Vulnerable)[^*]*\*\*:?\s*\r?\n[\s\S]*?```(\w*)\r?\n([\s\S]*?)```/gi;
    const correctRe   = /\*\*(Correct|Secure)[^*]*\*\*:?\s*\r?\n[\s\S]*?```(\w*)\r?\n([\s\S]*?)```/gi;

    const incorrectBlocks = [...body.matchAll(incorrectRe)].map(m => ({
      lang: m[2] || 'text',
      code: m[3].trim(),
    }));
    const correctBlocks = [...body.matchAll(correctRe)].map(m => ({
      lang: m[2] || 'text',
      code: m[3].trim(),
    }));

    if (incorrectBlocks.length === 0 && correctBlocks.length === 0) continue;

    testCases.push({
      skill:    skillName,
      rule:     file.replace('.md', ''),
      title:    frontmatter.title || file,
      impact:   frontmatter.impact || 'UNKNOWN',
      tags:     frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()) : [],
      pairs:    incorrectBlocks.map((inc, idx) => ({
        incorrect: inc,
        correct:   correctBlocks[idx] || null,
      })),
    });
  }
  return testCases;
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

// ── Entry point ──────────────────────────────────────────────────────────────

let skills = [];
if (args.all) {
  skills = discoverSkills();
} else if (args.skill) {
  skills = [args.skill];
} else {
  console.error('Error: provide --skill <name> or --all');
  process.exit(1);
}

let totalCases = 0;
for (const skillName of skills) {
  console.log(`\n🧪 Extracting test cases for: ${skillName}`);
  const cases = extractTestCasesFromSkill(skillName);
  const output = {
    generated: new Date().toISOString(),
    skill:     skillName,
    total:     cases.length,
    testCases: cases,
  };
  const outPath = join(ROOT, skillName, 'test-cases.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`  ✅ Written: ${outPath} (${cases.length} rule(s) with examples)`);
  totalCases += cases.length;
}

console.log(`\n✅ Done. ${totalCases} rule(s) with test cases across ${skills.length} skill(s).`);
