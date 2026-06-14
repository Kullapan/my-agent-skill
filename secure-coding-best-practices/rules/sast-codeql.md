---
title: Enable GitHub CodeQL for Automated Vulnerability Discovery
impact: HIGH
impactDescription: CWE-1006 — OWASP A03 Injection / A01 Broken Access Control
tags: security, sast, codeql, github, vulnerability-scanning, code-scanning, dataflow-analysis
---

## Enable GitHub CodeQL for Automated Vulnerability Discovery

**Impact: HIGH — CWE-1006**

CodeQL is GitHub's semantic code analysis engine that builds a queryable database of your code and finds vulnerabilities through **dataflow analysis** — tracking untrusted input from sources (HTTP request, env vars, user input) through your code to dangerous sinks (SQL queries, HTML output, shell commands). Unlike pattern-matching tools, CodeQL understands code semantics and catches vulnerabilities across function call chains. It is free for open-source repositories and included in GitHub Advanced Security for private repos.

**Vulnerable (code that CodeQL's dataflow analysis catches):**

```typescript
// ❌ CodeQL: js/sql-injection — tracks req.query.id → db.query
app.get('/user', async (req, res) => {
  const id = req.query.id                        // Source: HTTP input
  const user = await db.raw(`SELECT * FROM users WHERE id = ${id}`)  // Sink: SQL query
  res.json(user)
})

// ❌ CodeQL: js/reflected-xss — tracks req.query.name → res.send
app.get('/hello', (req, res) => {
  const name = req.query.name                    // Source: HTTP input
  res.send(`<h1>Hello ${name}</h1>`)             // Sink: HTML response
})

// ❌ CodeQL: js/path-injection — tracks req.params.file → readFileSync
app.get('/download', (req, res) => {
  const file = req.params.filename               // Source: HTTP input
  const content = fs.readFileSync('./files/' + file)  // Sink: file system
  res.send(content)
})
```

**Secure (CodeQL enabled as a blocking PR check):**

```yaml
# ✅ .github/workflows/codeql.yml — recommended setup
name: CodeQL Security Analysis
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * 1'  # Weekly full scan on Monday 6am

jobs:
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions:         read
      contents:        read
      security-events: write   # required to upload SARIF results

    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]
        # Add: python, java, csharp, go, ruby as needed

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          # ✅ Use security-extended for broader coverage (includes experimental queries)
          queries: security-extended
          # queries: security-and-quality  # even more rules

      - name: Setup Node.js (for autobuild)
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
        # Or replace with manual build steps for complex projects:
        # - run: npm ci && npm run build

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
          upload: true            # uploads SARIF to GitHub Security tab
          # Results appear in: Security → Code scanning alerts
```

```yaml
# ✅ Make CodeQL a required PR check (branch protection)
# Settings → Branches → main → Require status checks:
# ✓ "CodeQL Analysis (javascript-typescript)"
# This blocks merges until CodeQL passes
```

```javascript
// ✅ Custom CodeQL query — find all Express routes missing auth middleware
// .github/codeql/custom-queries/missing-auth.ql

/**
 * @name Express route missing authentication middleware
 * @description Finds Express route handlers that don't include an auth check
 * @kind problem
 * @problem.severity warning
 * @id js/express-missing-auth
 * @tags security
 */

import javascript
import semmle.javascript.frameworks.Express

from Express::RouteHandler handler
where
  not exists(Express::RouteSetup setup |
    setup.getARouteHandler() = handler and
    setup.getARouteHandler() instanceof AuthMiddleware
  ) and
  handler.getFile().getRelativePath().matches("src/routes/%")
select handler, "Express route handler may be missing authentication middleware"
```

```bash
# ✅ Run CodeQL locally with the CLI
# Install: https://github.com/github/codeql-action/releases
codeql pack download codeql/javascript-queries

# Create database
codeql database create ./codeql-db --language=javascript-typescript --source-root=./src

# Run security-extended queries
codeql database analyze ./codeql-db \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=sarif-latest \
  --output=results.sarif

# View results
codeql database analyze ./codeql-db \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=csv \
  --output=results.csv
cat results.csv
```

| CodeQL Suite | Coverage |
|---|---|
| `security-extended` | OWASP Top 10 + experimental high-confidence queries |
| `security-and-quality` | All security + code quality rules |
| `security-experimental` | Cutting-edge, higher false-positive rate |

Use `security-extended` for PR gates. Review all HIGH/CRITICAL alerts before marking as dismissed — GitHub tracks dismissal reasons and audits them.

Reference: [CodeQL Documentation](https://codeql.github.com/docs/) | [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning)
