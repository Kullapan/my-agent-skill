# Shared Skill Library

A curated, multi-skill library designed for AI agents and LLMs. Each **skill package** contains a structured collection of rules, guidelines, and best practices optimized for automated code generation, review, and refactoring.

## What is a Skill?

A skill is a self-contained knowledge package that an AI agent can load to gain expertise in a specific domain. Skills follow a strict schema so agents can reliably parse, index, and apply them.

Each skill contains:
- **`SKILL.md`** — Agent-facing entry point (frontmatter + summary)
- **`AGENTS.md`** — Compiled single-file output for agent consumption
- **`metadata.json`** — Machine-readable metadata
- **`README.md`** — Contributor documentation
- **`rules/`** — Individual rule files with structured frontmatter

## Available Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [react-best-practices](./react-best-practices/) | React & Next.js performance optimization guidelines by Vercel Engineering | 1.0.0 |
| [security-review-best-practices](./security-review-best-practices/) | Security review guidelines (OWASP, SAST/SCA scanners, dependency checks) | 1.0.0 |
| [kotlin-webflux-best-practices](./kotlin-webflux-best-practices/) | Best practices for building highly scalable, non-blocking Kotlin WebFlux APIs | 1.0.0 |
| [kotlin-restful-best-practices](./kotlin-restful-best-practices/) | Best practices for building standard Kotlin Spring MVC REST APIs | 1.0.0 |
| [java-restful-best-practices](./java-restful-best-practices/) | Best practices for building standard Java Spring MVC REST APIs | 1.0.0 |
| [frontend-frameworks-best-practices](./frontend-frameworks-best-practices/) | Modern component and styling practices using React, Vue, and TailwindCSS | 1.0.0 |
| [openshift-docker-best-practices](./openshift-docker-best-practices/) | Containerization and deployment guidelines for Red Hat OpenShift security | 1.0.0 |

> See [CATALOG.md](./CATALOG.md) for the full auto-generated skill catalog.

## Installing Skills in Other Projects

You can install any of the skills in this library directly into another project repository using the GitHub CLI (`gh`):

```bash
gh skill install <OWNER>/<REPO> <SKILL-DIR-NAME>
```

For example, to install the React Best Practices skill:

```bash
gh skill install <OWNER>/<REPO> react-best-practices
```

### Prerequisites

- GitHub CLI (`gh`) version `v2.90.0` or later must be installed and authenticated.
- Run the command from the root directory of the target project where you want to use the skill.
- Replace `<OWNER>/<REPO>` with the path to the GitHub repository hosting this skill library (e.g., `your-org/shared-skills`).

## Quick Start

### Install

```bash
npm install
```

### Build all skills

```bash
npm run build
```

### Validate all skills

```bash
npm run validate
```

### Generate skill catalog

```bash
npm run catalog
```

### Build a single skill

```bash
npm run build:skill -- --skill react-best-practices
```

### Extract test cases

```bash
npm run extract-tests
```

---

## Adding a New Skill

1. Copy the template:

   ```bash
   cp -r _templates/skill-template my-new-skill
   ```

2. Edit `my-new-skill/SKILL.md` — fill in the `name`, `description`, `license`, and `metadata`.

3. Edit `my-new-skill/metadata.json` — set version, organization, and abstract.

4. Edit `my-new-skill/rules/_sections.md` — define your rule categories.

5. Add rule files to `my-new-skill/rules/` following the `_template.md` format.

6. Build and validate:

   ```bash
   npm run build:skill -- --skill my-new-skill
   npm run validate -- --skill my-new-skill
   ```

7. Regenerate the catalog:

   ```bash
   npm run catalog
   ```

---

## Skill Package Schema

### SKILL.md Frontmatter

```yaml
---
name: kebab-case-skill-name
description: "One-sentence description used for agent routing"
license: MIT
metadata:
  author: "Org or author name"
  version: "1.0.0"
  tags: [tag1, tag2, tag3]
---
```

### Rule File Frontmatter

```yaml
---
title: Rule Title Here
impact: MEDIUM        # CRITICAL | HIGH | MEDIUM-HIGH | MEDIUM | LOW-MEDIUM | LOW
impactDescription: "Optional quantified impact"
tags: tag1, tag2
---
```

### Impact Levels

| Level | Meaning |
|-------|---------|
| `CRITICAL` | Highest priority — major gains |
| `HIGH` | Significant improvements |
| `MEDIUM-HIGH` | Moderate-high gains |
| `MEDIUM` | Moderate improvements |
| `LOW-MEDIUM` | Low-moderate gains |
| `LOW` | Incremental improvements |

---

## Repository Structure

```
githup-copilot-skill/
│
├── README.md                   ← This file
├── CATALOG.md                  ← Auto-generated skill index
├── catalog.json                ← Machine-readable skill catalog
├── package.json                ← Shared npm scripts
│
├── scripts/                    ← Shared tooling for all skills
│   ├── build-skill.js          ← Compile rules/ → AGENTS.md
│   ├── build-all.js            ← Build every skill
│   ├── validate-skill.js       ← Validate skill schema
│   ├── generate-catalog.js     ← Generate catalog.json & CATALOG.md
│   └── extract-tests.js        ← Extract test cases for LLM evaluation
│
├── _templates/                 ← Scaffolding templates
│   ├── rule-template.md        ← Standalone rule template
│   └── skill-template/         ← Copy to create a new skill
│       ├── SKILL.md
│       ├── metadata.json
│       ├── README.md
│       └── rules/
│           ├── _sections.md
│           └── _template.md
│
└── react-best-practices/       ← Skill packages...
```

---

## Contributing

1. Follow the rule file format defined in `_templates/rule-template.md`
2. Use `kebab-case` for all file and directory names
3. Run `npm run validate` before submitting
4. Run `npm run catalog` to keep `CATALOG.md` and `catalog.json` up to date

## License

Each skill package declares its own license in its `SKILL.md` frontmatter. See individual skill directories for details.
