---
title: Use Trivy to Scan Containers and Filesystems for CVEs
impact: CRITICAL
impactDescription: CWE-1104 — OWASP A06 Vulnerable and Outdated Components
tags: security, sca, trivy, container, docker, oci, filesystem, os-packages, cve, aquasec
---

## Use Trivy to Scan Containers and Filesystems for CVEs

**Impact: CRITICAL — CWE-1104**

Container images bundle OS packages (Alpine, Debian, Ubuntu) alongside application dependencies — all of which can carry CVEs. Trivy (by Aqua Security) is the industry-standard open-source scanner for containers, filesystems, git repos, and IaC. It detects vulnerabilities in OS packages, language packages (npm, pip, gem, cargo), and misconfigurations. Scan at build time, block on HIGH/CRITICAL, and re-scan images in your registry continuously.

**Vulnerable (container deployed without CVE scan):**

```dockerfile
# ❌ Base image with hundreds of known CVEs — never scanned
FROM node:18
# node:18 (Debian bookworm) may carry 50+ OS-level CVEs at any given time
COPY . .
RUN npm install
```

**Secure (Trivy scan blocking HIGH/CRITICAL, minimal base image):**

```dockerfile
# ✅ Use minimal base images to reduce attack surface
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ✅ Final image — distroless has near-zero OS CVEs
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app .
CMD ["server.js"]
```

```yaml
# ✅ GitHub Actions — Trivy scan blocking HIGH/CRITICAL in CI
name: Container Security Scan
on: [push, pull_request]

jobs:
  trivy:
    runs-on: ubuntu-latest
    permissions:
      security-events: write   # for SARIF upload

    steps:
      - uses: actions/checkout@v4

      # ✅ Scan filesystem BEFORE building (catches npm deps early)
      - name: Trivy Filesystem Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type:       "fs"
          scan-ref:        "."
          exit-code:       "1"               # fail on findings
          severity:        "HIGH,CRITICAL"   # only block on these
          format:          "sarif"
          output:          "trivy-fs.sarif"
          ignore-unfixed:  true              # skip CVEs without a fix yet

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      # ✅ Scan the built container image
      - name: Trivy Image Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref:      "myapp:${{ github.sha }}"
          exit-code:      "1"
          severity:       "HIGH,CRITICAL"
          format:         "sarif"
          output:         "trivy-image.sarif"
          ignore-unfixed: true

      - name: Upload SARIF to GitHub Security tab
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-image.sarif
```

```bash
# ✅ Local scanning
# Install: brew install trivy  |  or  |  apt install trivy

# Scan a Docker image
trivy image --severity HIGH,CRITICAL --exit-code 1 myapp:latest

# Scan a filesystem / project directory
trivy fs --severity HIGH,CRITICAL --exit-code 1 .

# Scan a git repo
trivy repo --severity HIGH,CRITICAL https://github.com/org/repo

# Scan IaC files (Terraform, CloudFormation, Helm)
trivy config --severity HIGH,CRITICAL ./infra/

# JSON output for processing
trivy image --format json --output report.json myapp:latest
cat report.json | jq '[.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")] | length'

# ✅ Continuous registry scanning (Trivy Operator in Kubernetes)
# kubectl apply -f https://raw.githubusercontent.com/aquasecurity/trivy-operator/main/deploy/static/trivy-operator.yaml
# Auto-scans all pods and exposes VulnerabilityReport CRDs
```

```bash
# ✅ .trivyignore — suppress known false positives with documentation
# CVE-2023-12345
# Reason: Not exploitable in our usage (library function not called)
# Reviewed: 2026-01-15, re-review: 2026-07-15
CVE-2023-12345
```

Use `--ignore-unfixed` to suppress CVEs that have no available fix (reduces noise). Re-scan registry images weekly even without code changes — new CVEs are disclosed continuously.

Reference: [Trivy Documentation](https://aquasecurity.github.io/trivy/)
