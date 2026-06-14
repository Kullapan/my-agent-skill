# My Skill Name

A structured repository for creating and maintaining [Domain] best practices optimized for agents and LLMs.

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (titles, impacts, descriptions)
  - `_template.md` - Template for creating new rules
  - `prefix-description.md` - Individual rule files
- `metadata.json` - Document metadata (version, organization, abstract)
- **`AGENTS.md`** - Compiled output (generated)
- **`test-cases.json`** - Test cases for LLM evaluation (generated)

## Getting Started

1. Build AGENTS.md from rules:
   ```bash
   node ../scripts/build-skill.js --skill .
   ```

2. Validate rule files:
   ```bash
   node ../scripts/validate-skill.js --skill .
   ```

3. Extract test cases:
   ```bash
   node ../scripts/extract-tests.js --skill .
   ```

> **Tip:** From the repo root you can also use the shared scripts:
> ```bash
> npm run build:skill -- --skill my-skill-name
> npm run validate -- --skill my-skill-name
> ```

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> my-skill-name
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).
- Replace `my-skill-name` with the directory name of your skill.

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/prefix-description.md`
2. Choose the appropriate prefix (defined in `rules/_sections.md`)
3. Fill in the frontmatter and content
4. Ensure you have clear Incorrect / Correct examples
5. Run `node ../scripts/build-skill.js --skill .` to regenerate `AGENTS.md`

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

\`\`\`typescript
// Bad code example
\`\`\`

**Correct (description of what's right):**

\`\`\`typescript
// Good code example
\`\`\`

Reference: [Link](https://example.com)
```

## Impact Levels

| Level | Meaning |
|-------|---------|
| `CRITICAL` | Highest priority — major gains |
| `HIGH` | Significant improvements |
| `MEDIUM-HIGH` | Moderate-high gains |
| `MEDIUM` | Moderate improvements |
| `LOW-MEDIUM` | Low-moderate gains |
| `LOW` | Incremental improvements |

## File Naming Convention

- Files starting with `_` are special (excluded from build)
- Rule files: `prefix-description.md` (e.g., `async-parallel.md`)
- Section is inferred from the filename prefix
- Rules are sorted alphabetically by title within each section

## Contributing

1. Use the correct filename prefix for your section
2. Follow the `_template.md` structure
3. Include clear Incorrect/Correct examples with explanations
4. Add appropriate tags
5. Run build to regenerate `AGENTS.md` and `test-cases.json`
