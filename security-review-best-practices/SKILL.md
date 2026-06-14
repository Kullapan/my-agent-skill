---
name: security-review-best-practices
description: Security review guidelines for web applications and APIs. Use this skill when writing, reviewing, or auditing code for security vulnerabilities — covering authentication, input validation, secrets management, API security, data protection, SCA/CVE scanning (JFrog Xray, OWASP Dependency Check, Trivy), SAST (SonarQube, Semgrep, CodeQL), and infrastructure hardening.
license: MIT
metadata:
  author: "Security Engineering"
  version: "1.1.0"
  tags: [security, owasp, authentication, authorization, injection, secrets, api, cryptography, jfrog-xray, sonarqube, semgrep, codeql, trivy, sca, sast, cve]
---

# Security Review Best Practices

Comprehensive security review guide for web applications and APIs. Contains 40+ rules across 10 categories — from critical vulnerabilities (injection, broken auth) to automated scanning pipelines (JFrog Xray, OWASP Dependency Check, Trivy, SonarQube, Semgrep, CodeQL). Each rule includes real-world vulnerable vs. secure code and CI/CD integration examples.

## When to Apply

Reference these guidelines when:
- Writing authentication or authorization logic
- Handling user input or building database queries
- Storing or transmitting sensitive data
- Designing API endpoints
- Managing secrets, credentials, or environment configuration
- Reviewing third-party dependencies or container images
- Setting up CI/CD security scanning gates (SCA, SAST, CVE checks)
- Integrating JFrog Xray, OWASP Dependency Check, SonarQube, Semgrep, or CodeQL
- Configuring error handling and logging
- Setting up infrastructure or HTTP headers

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Authentication & Authorization | CRITICAL | `auth-` |
| 2 | Input Validation & Injection Prevention | CRITICAL | `input-` |
| 3 | Secrets & Credentials Management | CRITICAL | `secrets-` |
| 4 | Software Composition Analysis & CVE Scanning | CRITICAL | `sca-` |
| 5 | API Security | HIGH | `api-` |
| 6 | Data Protection & Cryptography | HIGH | `data-` |
| 7 | Static Application Security Testing | HIGH | `sast-` |
| 8 | Dependency & Supply Chain Security | MEDIUM-HIGH | `deps-` |
| 9 | Error Handling & Logging | MEDIUM | `error-` |
| 10 | Infrastructure & HTTP Hardening | MEDIUM | `infra-` |

## Quick Reference

### 1. Authentication & Authorization (CRITICAL)

- `auth-password-hashing` — Use bcrypt/Argon2 for password storage
- `auth-jwt-validation` — Fully validate JWT signature, algorithm, and claims
- `auth-session-management` — Use secure, HttpOnly, SameSite cookies
- `auth-rbac` — Enforce role-based access control on every endpoint
- `auth-token-expiry` — Set short-lived access tokens, rotate refresh tokens
- `auth-oauth-state` — Use state + PKCE in OAuth/OIDC flows
- `auth-mfa` — Enforce MFA for privileged operations

### 2. Input Validation & Injection Prevention (CRITICAL)

- `input-parameterized-queries` — Always use parameterized queries to prevent SQL injection
- `input-validate-server-side` — Validate and sanitize all input server-side
- `input-xss-prevention` — Escape all output rendered as HTML
- `input-path-traversal` — Sanitize file paths, never construct from user input
- `input-command-injection` — Never construct shell commands from user input
- `input-deserialization` — Avoid unsafe deserialization of untrusted data
- `input-xml-xxe` — Disable external entity processing in XML parsers

### 3. Secrets & Credentials Management (CRITICAL)

- `secrets-no-hardcoded` — Never hardcode secrets, API keys, or credentials
- `secrets-env-management` — Use a secrets manager, not plain env files
- `secrets-rotation` — Implement and test automatic secret rotation
- `secrets-scanning` — Scan commits and CI for leaked secrets

### 4. API Security (HIGH)

- `api-rate-limiting` — Apply rate limiting and throttling on all endpoints
- `api-cors` — Configure CORS to allow only trusted origins
- `api-https-only` — Enforce HTTPS; redirect HTTP and set HSTS
- `api-schema-validation` — Validate request body/query against a schema
- `api-idempotency` — Use idempotency keys for mutating endpoints

### 5. Data Protection & Cryptography (HIGH)

- `data-encryption-at-rest` — Encrypt sensitive data at rest with AES-256
- `data-tls-in-transit` — Use TLS 1.2+ for all data in transit
- `data-minimal-collection` — Collect only the data you actually need
- `data-pii-masking` — Mask or redact PII in logs and error messages

### 6. Dependency & Supply Chain Security (MEDIUM-HIGH)

- `deps-audit` — Run dependency audits in CI on every build
- `deps-lock-files` — Always commit and verify lock files
- `deps-minimal-surface` — Prefer narrow, well-maintained packages

### 9. Error Handling & Logging (MEDIUM)

- `error-no-stack-traces` — Never expose stack traces or internal errors to clients
- `error-security-events` — Log all authentication and authorization events
- `error-no-sensitive-logs` — Never log passwords, tokens, or PII

### 10. Infrastructure & HTTP Hardening (MEDIUM)

- `infra-security-headers` — Set all critical security HTTP headers
- `infra-csp` — Implement a strict Content Security Policy
- `infra-least-privilege` — Apply least-privilege to all service accounts and IAM roles

### 4. Software Composition Analysis & CVE Scanning (CRITICAL)

- `sca-jfrog-xray` — Integrate JFrog Xray for deep artifact and container SCA
- `sca-owasp-dependency-check` — Run OWASP Dependency Check for CVE scanning in CI
- `sca-trivy-scan` — Use Trivy to scan containers and filesystems for CVEs
- `sca-cve-version-blocking` — Block builds when HIGH/CRITICAL CVE versions are detected
- `sca-sbom-generation` — Generate and publish a Software Bill of Materials (SBOM)

### 7. Static Application Security Testing & Code Analysis (HIGH)

- `sast-sonarqube` — Integrate SonarQube/SonarCloud as a PR quality gate
- `sast-semgrep` — Use Semgrep for custom security rule enforcement
- `sast-codeql` — Enable GitHub CodeQL for automated vulnerability discovery

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/sca-jfrog-xray.md
rules/sca-cve-version-blocking.md
rules/sast-sonarqube.md
rules/sast-semgrep.md
rules/sast-codeql.md
```

Each rule file contains:
- Why it matters (threat model and impact)
- Vulnerable / misconfigured code or pipeline example
- Secure / correctly configured example
- References to OWASP, NVD, or tool documentation

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
