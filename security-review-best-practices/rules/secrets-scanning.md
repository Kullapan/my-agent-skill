---
title: Scan Commits and CI for Leaked Secrets
impact: CRITICAL
impactDescription: CWE-312 — OWASP A02 Cryptographic Failures
tags: security, secrets, scanning, ci, git, pre-commit, trufflehog
---

## Scan Commits and CI for Leaked Secrets

**Impact: CRITICAL — CWE-312**

Secrets committed to git are often discovered within minutes by automated scanners (GitHub Secret Scanning, bots). Pre-commit hooks catch secrets before they ever hit the remote. CI scanning provides a second safety net. Both layers are required.

**Vulnerable (no secret scanning in place):**

```bash
# ❌ No pre-commit hook — secret committed without warning
git add .env.production
git commit -m "add config"
git push origin main
# Automated bot finds stripe key within 60 seconds
```

**Secure (pre-commit + CI scanning):**

```bash
# ✅ Install gitleaks as a pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

# Install and enable:
# pip install pre-commit
# pre-commit install

# ✅ Or use detect-secrets for baseline approach
# pip install detect-secrets
# detect-secrets scan > .secrets.baseline
# detect-secrets audit .secrets.baseline

# ✅ CI step (GitHub Actions)
# .github/workflows/security.yml
```

```yaml
# ✅ GitHub Actions secret scanning step
name: Security Scan
on: [push, pull_request]
jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history for gitleaks
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
```

Enable GitHub's built-in Secret Scanning for public repositories (free) and GitHub Advanced Security for private repos. Configure push protection to block pushes containing known secret patterns.

Reference: [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
