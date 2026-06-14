# React Best Practices

A structured repository for creating and maintaining React Best Practices optimized for agents and LLMs.

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (titles, impacts, descriptions)
  - `_template.md` - Template for creating new rules
  - `area-description.md` - Individual rule files
- `src/` - Build scripts and utilities
- `metadata.json` - Document metadata (version, organization, abstract)
- __`AGENTS.md`__ - Compiled output (generated)
- __`test-cases.json`__ - Test cases for LLM evaluation (generated)

## Getting Started

> **From the repo root**, use the shared npm scripts:
> ```bash
> npm run build:skill -- --skill react-best-practices
> npm run validate -- --skill react-best-practices
> npm run extract-tests -- --skill react-best-practices
> ```

Or run the shared scripts directly from this directory:

1. Build AGENTS.md from rules:
   ```bash
   node ../scripts/build-skill.js --skill react-best-practices
   ```

2. Validate rule files:
   ```bash
   node ../scripts/validate-skill.js --skill react-best-practices
   ```

3. Extract test cases:
   ```bash
   node ../scripts/extract-tests.js --skill react-best-practices
   ```

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> react-best-practices
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/area-description.md`
2. Choose the appropriate area prefix:
   - `async-` for Eliminating Waterfalls (Section 1)
   - `bundle-` for Bundle Size Optimization (Section 2)
   - `server-` for Server-Side Performance (Section 3)
   - `client-` for Client-Side Data Fetching (Section 4)
   - `rerender-` for Re-render Optimization (Section 5)
   - `rendering-` for Rendering Performance (Section 6)
   - `js-` for JavaScript Performance (Section 7)
   - `advanced-` for Advanced Patterns (Section 8)
3. Fill in the frontmatter and content
4. Ensure you have clear examples with explanations
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json

## Rule File Structure

Each rule file should follow this structure:

```markdown
---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional description
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of the rule and why it matters.

**Incorrect (description of what's wrong):**

```typescript
// Bad code example
```

**Correct (description of what's right):**

```typescript
// Good code example
```

Optional explanatory text after examples.

Reference: [Link](https://example.com)

## File Naming Convention

- Files starting with `_` are special (excluded from build)
- Rule files: `area-description.md` (e.g., `async-parallel.md`)
- Section is automatically inferred from filename prefix
- Rules are sorted alphabetically by title within each section
- IDs (e.g., 1.1, 1.2) are auto-generated during build

## Impact Levels

- `CRITICAL` - Highest priority, major performance gains
- `HIGH` - Significant performance improvements
- `MEDIUM-HIGH` - Moderate-high gains
- `MEDIUM` - Moderate performance improvements
- `LOW-MEDIUM` - Low-medium gains
- `LOW` - Incremental improvements

## Scripts (via repo root)

- `npm run build:skill -- --skill react-best-practices` — Compile rules into AGENTS.md
- `npm run validate -- --skill react-best-practices` — Validate all rule files
- `npm run extract-tests -- --skill react-best-practices` — Extract test cases for LLM evaluation
- `npm run dev` — Build all skills, validate, and generate catalog

## Contributing

When adding or modifying rules:

1. Use the correct filename prefix for your section
2. Follow the `_template.md` structure
3. Include clear bad/good examples with explanations
4. Add appropriate tags
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json
6. Rules are automatically sorted by title - no need to manage numbers!

## Acknowledgments

Originally created by [@shuding](https://x.com/shuding) at [Vercel](https://vercel.com).
