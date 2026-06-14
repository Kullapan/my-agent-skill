---
title: Use Semgrep for Custom Security Rule Enforcement
impact: HIGH
impactDescription: CWE-1006 — OWASP A03 Injection / A07 Auth Failures
tags: security, sast, semgrep, custom-rules, pattern-matching, ci, enforcement
---

## Use Semgrep for Custom Security Rule Enforcement

**Impact: HIGH — CWE-1006**

Semgrep is a lightweight, fast SAST tool that finds bugs and security issues using pattern-matching rules. Unlike SonarQube (which is heavy and general), Semgrep excels at **custom org-specific rules**: enforce that every `db.query()` call uses parameterized queries, that `jwt.verify()` always specifies an algorithm, that `res.send()` never interpolates user input, and so on. Run in CI and as a pre-commit hook.

**Vulnerable (patterns Semgrep would catch and block):**

```typescript
// ❌ Semgrep rule: ban-string-concat-sql
const user = await db.query("SELECT * FROM users WHERE id = " + req.params.id)

// ❌ Semgrep rule: require-jwt-algorithm
const decoded = jwt.verify(token, secret)  // no algorithm specified

// ❌ Semgrep rule: ban-eval
const result = eval(userInput)

// ❌ Semgrep rule: ban-dangerously-set-inner-html-raw
<div dangerouslySetInnerHTML={{ __html: content }} />

// ❌ Semgrep rule: no-math-random-for-crypto
const token = Math.random().toString(36)  // not cryptographically secure
```

**Secure (Semgrep rules enforcing org security patterns):**

```yaml
# ✅ .semgrep/security.yml — custom org rules
rules:
  # Ban string-concatenated SQL queries
  - id: ban-string-concat-sql
    patterns:
      - pattern: $DB.query("..." + ...)
      - pattern: $DB.query(`...${...}...`)
    message: "SQL string concatenation detected. Use parameterized queries: db.query('...', [params])"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-89"
      owasp: "A03:2021"

  # Require algorithm option in jwt.verify
  - id: require-jwt-algorithm
    pattern: jwt.verify($TOKEN, $SECRET)
    pattern-not: jwt.verify($TOKEN, $SECRET, {algorithms: [...]})
    message: "jwt.verify() must specify an algorithms array to prevent algorithm confusion attacks"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-347"

  # Ban eval() usage
  - id: ban-eval
    pattern: eval(...)
    message: "eval() is a security risk. Use JSON.parse() for data or refactor to avoid dynamic code execution."
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-95"

  # Ban Math.random() for security-sensitive values
  - id: no-math-random-crypto
    patterns:
      - pattern: Math.random()
      - pattern-inside: |
          $TOKEN = ...
    message: "Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.randomUUID()"
    languages: [typescript, javascript]
    severity: WARNING
    metadata:
      cwe: "CWE-338"

  # Detect unvalidated redirects
  - id: unvalidated-redirect
    patterns:
      - pattern: res.redirect($URL)
      - pattern-not: res.redirect("/...")
      - pattern-not-inside: |
          if (ALLOWED_URLS.includes($URL)) { ... }
    message: "Open redirect detected. Validate redirect URLs against an allowlist."
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-601"

  # Ensure all express routes have auth middleware
  - id: express-missing-auth-middleware
    patterns:
      - pattern: app.$METHOD('/api/...', $HANDLER)
      - pattern-not: app.$METHOD('/api/...', requireAuth, ...)
      - pattern-not: app.$METHOD('/api/public/...', ...)
    message: "API route missing requireAuth middleware. Add authentication or move to /api/public/"
    languages: [typescript, javascript]
    severity: WARNING
```

```yaml
# ✅ GitHub Actions — Semgrep in CI
name: Semgrep SAST
on:
  push:
    branches: [main]
  pull_request:

jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep

    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep — custom + OWASP rules
        run: |
          semgrep \
            --config .semgrep/security.yml \
            --config "p/owasp-top-ten" \
            --config "p/nodejs-security" \
            --config "p/secrets" \
            --sarif \
            --output semgrep.sarif \
            --error              # exit non-zero on findings
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif
```

```bash
# ✅ Run locally
pip install semgrep

# Run org rules + OWASP Top 10 ruleset
semgrep --config .semgrep/security.yml --config "p/owasp-top-ten" .

# Run against a specific file
semgrep --config "p/nodejs-security" src/routes/auth.ts

# Available rulesets: https://semgrep.dev/r
# p/owasp-top-ten, p/secrets, p/nodejs-security,
# p/react, p/typescript, p/jwt, p/sql-injection

# ✅ Pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.70.0
    hooks:
      - id: semgrep
        args: ['--config', '.semgrep/security.yml', '--error']
```

Start with Semgrep's official rulesets (`p/owasp-top-ten`, `p/nodejs-security`). Then add custom rules for your specific patterns and frameworks. Use `# nosemgrep: rule-id` with a comment to suppress false positives with documented justification.

Reference: [Semgrep Documentation](https://semgrep.dev/docs/) | [Semgrep Registry](https://semgrep.dev/r)
