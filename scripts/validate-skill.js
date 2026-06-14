#!/usr/bin/env node
/**
 * validate-skill.js
 *
 * Validates one or all skill packages against the required schema.
 *
 * Usage:
 *   node scripts/validate-skill.js --skill <name>   # validate one skill
 *   node scripts/validate-skill.js --all            # validate all skills
 *
 * Exit codes:
 *   0 - all validations passed
 *   1 - one or more validations failed
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
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
  if (!match) return null;

  const raw = match[1];
  const frontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    frontmatter[key] = val;
  }
  return frontmatter;
}

function error(msg)   { console.error(`  ❌ ${msg}`); }
function warn(msg)    { console.warn(`  ⚠️  ${msg}`); }
function success(msg) { console.log(`  ✅ ${msg}`); }

// ── Skill validator ──────────────────────────────────────────────────────────

function validateSkill(skillName) {
  const skillDir  = join(ROOT, skillName);
  const rulesDir  = join(skillDir, 'rules');
  let errors = 0;
  let warnings = 0;

  console.log(`\n🔍 Validating: ${skillName}`);

  // 1. Required files
  const required = ['SKILL.md', 'metadata.json', 'README.md'];
  for (const file of required) {
    if (existsSync(join(skillDir, file))) {
      success(`${file} exists`);
    } else {
      error(`Missing required file: ${file}`);
      errors++;
    }
  }

  // 2. rules/ directory
  if (existsSync(rulesDir) && statSync(rulesDir).isDirectory()) {
    success('rules/ directory exists');
  } else {
    error('Missing rules/ directory');
    errors++;
  }

  // 3. SKILL.md frontmatter
  const skillMdPath = join(skillDir, 'SKILL.md');
  if (existsSync(skillMdPath)) {
    const content = readFileSync(skillMdPath, 'utf-8');
    const fm = parseFrontmatter(content);
    if (!fm) {
      error('SKILL.md is missing frontmatter (--- block)');
      errors++;
    } else {
      const requiredFields = ['name', 'description', 'license'];
      for (const field of requiredFields) {
        if (fm[field]) {
          success(`SKILL.md has '${field}': ${fm[field].slice(0, 60)}`);
        } else {
          error(`SKILL.md missing required frontmatter field: '${field}'`);
          errors++;
        }
      }
      // Warn if name doesn't match directory
      if (fm.name && fm.name !== skillName) {
        warn(`SKILL.md 'name' (${fm.name}) doesn't match directory (${skillName})`);
        warnings++;
      }
    }
  }

  // 4. metadata.json schema
  const metaPath = join(skillDir, 'metadata.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      if (meta.version) {
        success(`metadata.json has 'version': ${meta.version}`);
      } else {
        warn('metadata.json missing "version" field');
        warnings++;
      }
    } catch {
      error('metadata.json is not valid JSON');
      errors++;
    }
  }

  // 5. Validate rule files
  if (existsSync(rulesDir)) {
    const VALID_IMPACTS = new Set([
      'CRITICAL', 'HIGH', 'MEDIUM-HIGH', 'MEDIUM', 'LOW-MEDIUM', 'LOW',
    ]);
    const ruleFiles = readdirSync(rulesDir).filter(
      f => f.endsWith('.md') && !f.startsWith('_')
    );

    if (ruleFiles.length === 0) {
      warn('No rule files found in rules/ (files starting with _ are excluded)');
      warnings++;
    } else {
      success(`Found ${ruleFiles.length} rule file(s)`);
    }

    let ruleErrors = 0;
    for (const file of ruleFiles) {
      const content = readFileSync(join(rulesDir, file), 'utf-8');
      const fm = parseFrontmatter(content);
      if (!fm) {
        error(`${file}: missing frontmatter`);
        ruleErrors++;
        continue;
      }
      if (!fm.title) {
        error(`${file}: frontmatter missing 'title'`);
        ruleErrors++;
      }
      if (!fm.impact) {
        error(`${file}: frontmatter missing 'impact'`);
        ruleErrors++;
      } else if (!VALID_IMPACTS.has(fm.impact.toUpperCase())) {
        warn(`${file}: unknown impact level '${fm.impact}' (valid: ${[...VALID_IMPACTS].join(', ')})`);
        warnings++;
      }
    }
    if (ruleErrors === 0 && ruleFiles.length > 0) {
      success('All rule files have valid frontmatter');
    }
    errors += ruleErrors;
  }

  // Summary
  if (errors === 0) {
    console.log(`\n  ✅ ${skillName}: PASSED (${warnings} warning(s))\n`);
  } else {
    console.log(`\n  ❌ ${skillName}: FAILED (${errors} error(s), ${warnings} warning(s))\n`);
  }

  return errors;
}

// ── Discover all skills ──────────────────────────────────────────────────────

function discoverSkills() {
  return readdirSync(ROOT)
    .filter(entry => {
      if (SKIP_DIRS.has(entry)) return false;
      const fullPath = join(ROOT, entry);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'SKILL.md'));
    });
}

// ── Entry point ──────────────────────────────────────────────────────────────

let skills = [];

if (args.all) {
  skills = discoverSkills();
  if (skills.length === 0) {
    console.warn('⚠️  No skill packages found.');
    process.exit(0);
  }
  console.log(`\n🔍 Validating ${skills.length} skill(s)...`);
} else if (args.skill) {
  skills = [args.skill];
} else {
  console.error('Error: provide --skill <name> or --all');
  process.exit(1);
}

let totalErrors = 0;
for (const skill of skills) {
  totalErrors += validateSkill(skill);
}

if (totalErrors > 0) {
  console.error(`❌ Validation failed: ${totalErrors} total error(s).`);
  process.exit(1);
} else {
  console.log('✅ All validations passed.');
}
