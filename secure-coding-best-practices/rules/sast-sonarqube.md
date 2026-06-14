---
title: Integrate SonarQube or SonarCloud as a PR Quality Gate
impact: HIGH
impactDescription: CWE-1006 — OWASP A05 Security Misconfiguration / OWASP A03 Injection
tags: security, sast, sonarqube, sonarcloud, code-quality, pr-gate, static-analysis, security-hotspots
---

## Integrate SonarQube or SonarCloud as a PR Quality Gate

**Impact: HIGH — CWE-1006**

SonarQube (self-hosted) and SonarCloud (SaaS) perform SAST — scanning source code without executing it — to detect injection code gaps, hardcoded secrets, insecure APIs, SQL injection, XSS, SSRF, path traversal, and 2,000+ other security rules across 30+ languages. Configured as a **PR quality gate**, it blocks merges when new Security Hotspots or Code gaps of severity HIGH/CRITICAL are introduced.

**Non-compliant (no SAST gate — insecure code merged):**

```typescript
// ❌ This code gets merged with no SAST check:
app.get('/user', async (req, res) => {
  // SQL injection — SonarQube rule: S3649 "SQL queries should not be non-compliant to injection risks"
  const result = await db.query(`SELECT * FROM users WHERE id = ${req.query.id}`)
  res.json(result)
})

// ❌ Hardcoded password — SonarQube rule: S2068 "Credentials should not be hard-coded"
const password = 'admin123'

// ❌ Path traversal — SonarQube rule: S6096
const file = fs.readFileSync('./uploads/' + req.params.name)
```

**Secure (SonarQube integrated as a blocking PR gate):**

```yaml
# ✅ sonar-project.properties — project configuration
sonar.projectKey=my-org_my-project
sonar.projectName=My Project
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
sonar.typescript.lcov.reportPaths=coverage/lcov.info

# Security-focused quality gate settings (configure in SonarQube UI):
# Gate: "Security Gate"
# Condition 1: New Code gaps = 0        (blocks on any new vuln)
# Condition 2: New Security Hotspots = 0      (requires hotspot review)
# Condition 3: Security Rating on New Code: A  (no critical/high vulns)
```

```yaml
# ✅ GitHub Actions — SonarCloud integration (free for open source)
name: SonarCloud SAST
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonarcloud:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # Shallow clones disable blame/history analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install and test (with coverage)
        run: |
          npm ci
          npm test -- --coverage --coverageReporters=lcov

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # PR decoration
          SONAR_TOKEN:  ${{ secrets.SONAR_TOKEN }}    # SonarCloud auth
        with:
          args: >
            -Dsonar.qualitygate.wait=true
            -Dsonar.qualitygate.timeout=300

      # ✅ qualitygate.wait=true — fails the action if gate is not passed
      # This blocks the PR merge via required status checks
```

```yaml
# ✅ Self-hosted SonarQube (Docker)
# docker-compose.yml
services:
  sonarqube:
    image: sonarqube:community
    ports:
      - "9000:9000"
    environment:
      SONAR_JDBC_URL:      jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    volumes:
      - sonar_data:/opt/sonarqube/data
      - sonar_extensions:/opt/sonarqube/extensions

# ✅ GitHub Actions — self-hosted SonarQube
- name: SonarQube Scan
  uses: SonarSource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
  with:
    args: >
      -Dsonar.qualitygate.wait=true
```

```bash
# ✅ Key SonarQube security rules to enable (OWASP Top 10 mapped)
# S3649 — SQL Injection                    → OWASP A03
# S5131 — XSS Reflected                   → OWASP A03
# S2631 — ReDoS                           → OWASP A03
# S4790 — Weak cryptographic hash         → OWASP A02
# S5542 — Weak encryption mode            → OWASP A02
# S2068 — Hardcoded credentials           → OWASP A02
# S5144 — SSRF                            → OWASP A10
# S6096 — Path traversal                  → OWASP A01
# S5443 — Temp file creation with insecure permissions → OWASP A01
# S4784 — Command injection               → OWASP A03
```

Enable the **OWASP Top 10** security profile in SonarQube. Use branch analysis (Developer Edition+) so PRs show only *new* issues. Require the "Sonar Way Security" quality gate in your branch protection rules.

Reference: [SonarQube Security Rules](https://rules.sonarsource.com/typescript/tag/owasp-top10/) | [SonarCloud](https://sonarcloud.io)
