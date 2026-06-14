---
title: Run OWASP Dependency Check for CVE Scanning in CI
impact: CRITICAL
impactDescription: CWE-1104 — OWASP A06 Vulnerable and Outdated Components
tags: security, sca, owasp, dependency-check, cve, nvd, ci, multi-language
---

## Run OWASP Dependency Check for CVE Scanning in CI

**Impact: CRITICAL — CWE-1104**

OWASP Dependency Check (ODC) is a free, multi-language SCA tool that identifies project dependencies and checks if there are any known, publicly disclosed CVEs from the NVD (National Vulnerability Database). Unlike `npm audit`, ODC works across Java, .NET, Python, Ruby, Node.js, and more — making it ideal for polyglot environments and as a universal pipeline step. Configure it to **fail the build** on CVSS score ≥ 7 (HIGH/CRITICAL).

**Vulnerable (no OWASP Dependency Check in pipeline):**

```bash
# ❌ Dependencies scanned only with npm audit — language-limited, not exhaustive
npm audit --audit-level=high
# Misses: transitive jar files, Python packages bundled in Docker, .NET libs
```

**Secure (OWASP Dependency Check in CI — multi-language):**

```yaml
# ✅ GitHub Actions — OWASP Dependency Check with CVSS threshold
name: OWASP Dependency Check
on: [push, pull_request]

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project:    "${{ github.repository }}"
          path:       "."
          format:     "HTML,JSON,SARIF"
          args: >-
            --failOnCVSS 7
            --enableRetired
            --enableExperimental
            --nvdApiKey ${{ secrets.NVD_API_KEY }}
            --suppressionFile .odc-suppressions.xml
        env:
          JAVA_HOME: /opt/jdk

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: odc-report
          path: reports/

      - name: Upload SARIF to GitHub Security tab
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: reports/dependency-check-report.sarif
```

```bash
# ✅ Run locally via CLI (Docker)
docker run --rm \
  -e user=$USER \
  -u $(id -u):$(id -g) \
  -v $(pwd):/src \
  -v $(pwd)/odc-reports:/report \
  owasp/dependency-check:latest \
  --scan /src \
  --format HTML \
  --format JSON \
  --project "my-project" \
  --failOnCVSS 7 \
  --out /report

# ✅ With NVD API key (avoid rate limiting)
# Get free key at: https://nvd.nist.gov/developers/request-an-api-key
docker run --rm \
  -v $(pwd):/src \
  -v odc-data:/usr/share/dependency-check/data \
  owasp/dependency-check:latest \
  --scan /src \
  --nvdApiKey $NVD_API_KEY \
  --failOnCVSS 7 \
  --format JSON \
  --out /src/odc-reports
```

```xml
<!-- ✅ .odc-suppressions.xml — suppress false positives with documented justification -->
<?xml version="1.0" encoding="UTF-8"?>
<suppressions xmlns="https://jeremylong.github.io/DependencyCheck/dependency-suppression.1.3.xsd">
  <suppress>
    <notes>
      False positive: CVE-2021-44228 (Log4Shell) does not apply to our log4j-api usage
      which does not include the vulnerable JNDILookup class.
      Reviewed: 2026-01-15, reviewer: security-team
      Re-review date: 2026-07-15
    </notes>
    <cve>CVE-2021-44228</cve>
    <filePath regex="true">.*log4j-api-.*\.jar</filePath>
  </suppress>
</suppressions>
```

Set `--failOnCVSS 7` to block HIGH (7.0–8.9) and CRITICAL (9.0–10.0) findings. Use NVD API key to avoid the 2-hour data update rate limit. Cache the NVD database between CI runs to speed up scans.

Reference: [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
