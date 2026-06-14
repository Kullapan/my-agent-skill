---
title: Audit Dependencies and Run Security Checks in CI
impact: MEDIUM-HIGH
impactDescription: CWE-1104 — OWASP A06 Vulnerable and Outdated Components
tags: security, dependencies, supply-chain, audit, npm-audit, ci, snyk
---

## Audit Dependencies and Run Security Checks in CI

**Impact: MEDIUM-HIGH — CWE-1104**

Third-party packages are a major breach vector — the 2020 SolarWinds attack and thousands of npm package hijacks demonstrate that dependencies must be treated as untrusted code. Automated auditing in CI ensures known vulnerabilities are caught before deployment.

**Vulnerable (no dependency auditing):**

```bash
# ❌ Never auditing dependencies
npm install
# old lodash with prototype pollution — undetected for months
# old express with ReDoS — never flagged
```

**Secure (automated auditing in CI):**

```yaml
# ✅ GitHub Actions — audit on every push and weekly
name: Dependency Security Audit
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: npm audit (fail on high+)
        run: npm audit --audit-level=high

      - name: Snyk vulnerability scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Check for outdated packages
        run: npx npm-check-updates --errorLevel 2
```

```bash
# ✅ Local development — add to pre-commit hook or Makefile
npm audit --audit-level=high

# ✅ For yarn
yarn audit --level high

# ✅ For pnpm
pnpm audit --audit-level high
```

```bash
# ✅ Review and fix
npm audit fix              # auto-fix compatible updates
npm audit fix --force      # semver-major updates (review manually)
npm audit                  # list all issues without fixing
```

Set a policy: CRITICAL/HIGH vulnerabilities block deployment; MEDIUM vulnerabilities have a 30-day SLA. Use Dependabot or Renovate for automatic dependency update PRs.

Reference: [OWASP Vulnerable and Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)
