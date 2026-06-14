---
title: Generate and Publish a Software Bill of Materials (SBOM)
impact: CRITICAL
impactDescription: CWE-1104 — OWASP A06 / NIST SP 800-218 / EO 14028
tags: security, sca, sbom, cyclonedx, spdx, supply-chain, compliance, ntia
---

## Generate and Publish a Software Bill of Materials (SBOM)

**Impact: CRITICAL — CWE-1104**

A Software Bill of Materials (SBOM) is a formal, machine-readable inventory of every component in your software — direct dependencies, transitive dependencies, OS packages, and containers. SBOMs are required by US Executive Order 14028 for government software, and increasingly required by enterprise customers for vendor risk management. Without an SBOM, you cannot quickly answer "are we affected by Log4Shell?" when a new zero-day drops.

**Non-compliant (no SBOM — blind to component inventory):**

```bash
# ❌ No SBOM generated — when Log4Shell (CVE-2021-44228) dropped:
# Question: "Do we use Log4j?"
# Answer: "We need to grep every repo manually... this will take days"
# Impact: 72-hour incident response delay
```

**Secure (automated SBOM generation in CI):**

```yaml
# ✅ GitHub Actions — generate CycloneDX SBOM on every release
name: Generate SBOM
on:
  push:
    branches: [main]
  release:
    types: [created]

jobs:
  sbom:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      # ✅ CycloneDX SBOM for Node.js
      - name: Generate CycloneDX SBOM
        uses: CycloneDX/gh-node-module-generatebom@v1
        with:
          path: "./"
          output: "./bom.json"

      # ✅ Syft for richer multi-ecosystem SBOM (also supports Docker)
      - name: Generate SBOM with Syft
        uses: anchore/sbom-action@v0
        with:
          path:            "./"
          format:          "cyclonedx-json"   # or spdx-json
          output-file:     "./sbom.cyclonedx.json"
          artifact-name:   "sbom-${{ github.sha }}"

      # ✅ Attach SBOM to GitHub release
      - name: Upload SBOM to release
        if: github.event_name == 'release'
        uses: softprops/action-gh-release@v2
        with:
          files: ./sbom.cyclonedx.json

      # ✅ Publish SBOM as OCI artifact alongside container image
      - name: Attach SBOM to container
        run: |
          docker build -t myapp:${{ github.sha }} .
          docker push myapp:${{ github.sha }}
          # Attach SBOM as OCI attestation
          cosign attest --predicate sbom.cyclonedx.json \
            --type cyclonedx \
            myapp:${{ github.sha }}
```

```bash
# ✅ Generate SBOM locally

# Syft (multi-format: SPDX, CycloneDX, Syft JSON)
brew install syft
syft dir:. -o cyclonedx-json=sbom.json       # directory
syft myapp:latest -o cyclonedx-json=sbom.json # container image

# CycloneDX CLI for Node.js
npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file bom.json

# SBOM for Python
pip install cyclonedx-bom
cyclonedx-bom --requirements requirements.txt --output bom.json

# Trivy can also generate SBOMs
trivy image --format cyclonedx --output sbom.json myapp:latest
trivy fs    --format spdx-json  --output sbom.spdx.json .
```

```javascript
// ✅ Query your SBOM to answer "are we affected by CVE-X?"
// When a new zero-day drops, scan your SBOM instantly:

import { readFileSync } from 'fs'

const sbom = JSON.parse(readFileSync('./sbom.cyclonedx.json', 'utf-8'))
const components = sbom.components || []

// Find all versions of a specific package
const log4j = components.filter(c =>
  c.name?.toLowerCase().includes('log4j')
)
console.log('Log4j components found:', log4j.map(c => `${c.name}@${c.version}`))

// Cross-reference with OSV for specific CVE
async function checkSbomForCve(sbomPath: string, cveId: string) {
  const sbom = JSON.parse(readFileSync(sbomPath, 'utf-8'))
  const findings = []
  for (const component of sbom.components || []) {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: component.version,
        package: { name: component.name, ecosystem: 'npm' },
      }),
    })
    const { vulns } = await res.json()
    const match = vulns?.find(v => v.aliases?.includes(cveId) || v.id === cveId)
    if (match) findings.push({ component: `${component.name}@${component.version}`, cve: cveId })
  }
  return findings
}
```

Store SBOMs in your artifact registry (Artifactory, ECR, GHCR) alongside every release. Use CycloneDX (preferred) or SPDX 2.3 format. Update SBOMs on every build — stale SBOMs are dangerous.

Reference: [CISA SBOM Resources](https://www.cisa.gov/sbom) | [CycloneDX Specification](https://cyclonedx.org/) | [NTIA SBOM Minimum Elements](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom)
