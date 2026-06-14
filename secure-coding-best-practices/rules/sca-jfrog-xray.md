---
title: Integrate JFrog Xray for Deep Artifact and Container SCA
impact: CRITICAL
impactDescription: CWE-1104 — OWASP A06 Vulnerable and Outdated Components
tags: security, sca, jfrog, xray, artifacts, container, supply-chain, cve, jfrog-platform
---

## Integrate JFrog Xray for Deep Artifact and Container SCA

**Impact: CRITICAL — CWE-1104**

JFrog Xray performs recursive Software Composition Analysis (SCA) on every artifact stored in JFrog Artifactory — including transitive dependencies, container layers, and compiled binaries. Unlike `npm audit` (which only scans metadata), Xray inspects actual artifact content and matches against multiple vulnerability databases (NVD, VulnDB, GitHub Advisory). Configure Xray policies to **block downloads and promotions** when HIGH or CRITICAL CVEs are found.

**Vulnerable (no Xray policy — artifacts flow through untouched):**

```bash
# ❌ Artifactory without Xray — any artifact is served regardless of CVEs
curl -u user:password \
  "https://artifactory.example.com/artifactory/npm-local/lodash/-/lodash-4.17.4.tgz" \
  -O
# lodash 4.17.4 has CVE-2019-10744 (CRITICAL — prototype pollution)
# No scan, no block, no alert
```

**Secure (Xray security policy that blocks HIGH/CRITICAL):**

```bash
# ✅ Step 1: Create a Security Policy via Xray REST API
curl -u admin:password -X POST \
  "https://xray.example.com/api/v2/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "block-high-critical-cves",
    "type": "security",
    "rules": [
      {
        "name": "block-critical",
        "criteria": {
          "min_severity": "High",
          "fix_version_dependant": false
        },
        "actions": {
          "webhooks": [],
          "mails": ["security-team@example.com"],
          "block_download": {
            "unscanned": true,
            "active": true
          },
          "block_release_bundle_distribution": true,
          "fail_build": true,
          "notify_deployer": true,
          "notify_watch_recipients": true
        },
        "priority": 1
      }
    ]
  }'

# ✅ Step 2: Create a Watch that applies the policy to all repos
curl -u admin:password -X POST \
  "https://xray.example.com/api/v2/watches" \
  -H "Content-Type: application/json" \
  -d '{
    "general_data": {
      "name": "all-repos-watch",
      "description": "Watch all repositories for HIGH/CRITICAL CVEs",
      "active": true
    },
    "project_resources": {
      "resources": [
        {
          "type": "all_repos",
          "filters": []
        }
      ]
    },
    "assigned_policies": [
      { "name": "block-high-critical-cves", "type": "security" }
    ]
  }'
```

```yaml
# ✅ GitHub Actions — fail build if Xray scan finds HIGH/CRITICAL
- name: JFrog CLI Setup
  uses: jfrog/setup-jfrog-cli@v4
  env:
    JF_URL:      ${{ secrets.JF_URL }}
    JF_USER:     ${{ secrets.JF_USER }}
    JF_PASSWORD: ${{ secrets.JF_PASSWORD }}

- name: Build and publish to Artifactory
  run: |
    jf npm install --build-name=${{ github.repository }} --build-number=${{ github.run_number }}
    jf rt build-publish ${{ github.repository }} ${{ github.run_number }}

- name: Xray Build Scan — fail on HIGH/CRITICAL
  run: |
    jf build-scan \
      --fail=true \
      --severity=High \
      ${{ github.repository }} ${{ github.run_number }}
  # Exits non-zero if HIGH or CRITICAL CVEs found — fails the pipeline
```

```bash
# ✅ Scan a Docker image directly with Xray CLI
jf docker scan myapp:latest

# ✅ Scan a directory (e.g., build output)
jf scan ./dist/ --fail=true --severity=High

# ✅ View detailed CVE report
jf build-scan --format=json myapp 42 | jq '.violations[] | select(.severity == "Critical")'
```

Configure Xray to index all repositories immediately after upload. Use **Release Bundle** promotion policies to ensure only Xray-approved artifacts reach production registries.

Reference: [JFrog Xray Documentation](https://jfrog.com/help/r/jfrog-security-documentation/jfrog-xray)
