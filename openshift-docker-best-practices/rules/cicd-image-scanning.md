---
title: Scan container images for vulnerabilities in CI/CD pipelines
impact: HIGH
impactDescription: Unscanned images ship known CVEs to production, exposing the application to exploits that have public proof-of-concept code.
tags: security, docker, cicd, vulnerability-scanning, trivy, supply-chain
---

## Scan container images for vulnerabilities in CI/CD pipelines

**Impact: HIGH**

Container images inherit vulnerabilities from their base OS packages, language runtimes, and application dependencies. Without scanning, known CVEs with public exploits ship directly to production. Integrating image scanning into the CI/CD pipeline catches critical vulnerabilities before deployment and provides an auditable record of the security posture of every image.

**Incorrect (build and push without scanning):**

```yaml
# ❌ GitHub Actions pipeline that builds and deploys without any security scanning
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t registry.example.com/app:${{ github.sha }} .

      # No scanning step — CVEs ship directly to production!

      - name: Push image
        run: docker push registry.example.com/app:${{ github.sha }}

      - name: Deploy to OpenShift
        run: oc set image deployment/app app=registry.example.com/app:${{ github.sha }}
```

**Correct (scan with Trivy and fail on critical vulnerabilities):**

```yaml
# ✅ GitHub Actions pipeline with Trivy vulnerability scanning
name: Build, Scan, and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t registry.example.com/app:${{ github.sha }} .

      # ✅ Scan the image for OS and library vulnerabilities
      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: registry.example.com/app:${{ github.sha }}
          format: table
          exit-code: 1               # Fail the build if vulnerabilities found
          severity: CRITICAL,HIGH     # Only fail on CRITICAL and HIGH CVEs
          ignore-unfixed: true        # Skip CVEs with no available fix

      - name: Push image
        run: docker push registry.example.com/app:${{ github.sha }}

      - name: Deploy to OpenShift
        run: oc set image deployment/app app=registry.example.com/app:${{ github.sha }}
```

```bash
# ✅ Local/generic scanning with Trivy CLI
trivy image --severity CRITICAL,HIGH --exit-code 1 registry.example.com/app:latest

# ✅ Alternative: Grype scanner
grype registry.example.com/app:latest --fail-on high
```

Scan images in CI before pushing to the registry. Consider also scanning at admission time using OpenShift's image policy or Kubernetes admission controllers (Kyverno, OPA Gatekeeper).
