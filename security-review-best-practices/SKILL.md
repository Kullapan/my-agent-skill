---
name: security-review-best-practices
description: "Static Application Security Testing (SAST) guidelines for web applications and APIs, aligned to OWASP Top 10:2025. Use this skill when writing, reviewing, or auditing source code for security vulnerabilities — covering authentication, input validation, injection prevention, secrets management, API security, data protection, dependency analysis, error handling, infrastructure hardening, SCA/CVE scanning, SAST tooling, and secure design."
license: MIT
metadata:
  author: "Security Engineering"
  version: "2.0.0"
  tags: [security, owasp, owasp-top-10, owasp-2025, sast, authentication, authorization, injection, secrets, api, cryptography, jfrog-xray, sonarqube, semgrep, codeql, trivy, sca, cve, threat-modeling]
---

# Security Review Best Practices — SAST & OWASP Top 10

Static Application Security Testing (SAST) guide for web applications and APIs. Contains 50 rules across 11 categories — all evaluable through **static code review, configuration inspection, and CI pipeline analysis** without running the application. Aligned to the **OWASP Top 10:2025** vulnerability taxonomy.

> **Focus: SAST (Static Analysis)** — Every rule in this skill can be assessed by reading source code, configuration files, dependency manifests, and CI/CD pipeline definitions. No dynamic scanning, penetration testing, or runtime analysis is required.

## OWASP Top 10:2025 Mapping

| OWASP 2025 | Category | Key Rules |
|------------|----------|-----------|
| **A01** Broken Access Control | auth, input | `auth-rbac`, `auth-ssrf-prevention`, `input-path-traversal`, `input-mass-assignment` |
| **A02** Security Misconfiguration | infra | `infra-security-headers`, `infra-csp`, `infra-least-privilege` |
| **A03** Supply Chain Failures | deps, sca | `deps-audit`, `deps-lock-files`, `sca-jfrog-xray`, `sca-trivy-scan`, `sca-sbom-generation` |
| **A04** Cryptographic Failures | data, secrets | `auth-password-hashing`, `data-encryption-at-rest`, `data-tls-in-transit`, `secrets-rotation` |
| **A05** Injection | input, api | `input-parameterized-queries`, `input-xss-prevention`, `input-command-injection`, `input-deserialization`, `api-file-upload` |
| **A06** Insecure Design | design, api | `design-threat-modeling`, `api-idempotency`, `data-minimal-collection` |
| **A07** Authentication Failures | auth | `auth-jwt-validation`, `auth-session-management`, `auth-password-hashing`, `auth-mfa` |
| **A08** Data Integrity Failures | deps, input | `deps-lock-files`, `input-deserialization`, `sca-sbom-generation` |
| **A09** Logging & Alerting Failures | error | `error-security-events`, `error-no-sensitive-logs`, `data-pii-masking` |
| **A10** Mishandling Exceptions | error | `error-no-stack-traces`, `error-graceful-degradation`, `error-resource-cleanup` |

## When to Apply

Reference these guidelines when:
- Writing authentication or authorization logic
- Handling user input or building database queries
- Storing or transmitting sensitive data
- Designing API endpoints or file upload features
- Managing secrets, credentials, or environment configuration
- Reviewing third-party dependencies or container images
- Setting up CI/CD security scanning gates (SCA, SAST, CVE checks)
- Integrating JFrog Xray, OWASP Dependency Check, SonarQube, Semgrep, or CodeQL
- Creating threat models for new features
- Configuring error handling, logging, and resilience patterns
- Setting up infrastructure or HTTP headers

## Rule Categories by Priority

| Priority | Category | Severity | Prefix | OWASP |
|----------|----------|----------|--------|-------|
| 1 | Authentication & Authorization | CRITICAL | `auth-` | A01, A07 |
| 2 | Input Validation & Injection Prevention | CRITICAL | `input-` | A05, A08 |
| 3 | Secrets & Credentials Management | CRITICAL | `secrets-` | A04 |
| 4 | Software Composition Analysis & CVE Scanning | CRITICAL | `sca-` | A03, A08 |
| 5 | API Security | HIGH | `api-` | A05, A06 |
| 6 | Data Protection & Cryptography | HIGH | `data-` | A04 |
| 7 | Static Application Security Testing | HIGH | `sast-` | — |
| 8 | Secure Design | HIGH | `design-` | A06 |
| 9 | Dependency & Supply Chain Security | MEDIUM-HIGH | `deps-` | A03, A08 |
| 10 | Error Handling & Logging | MEDIUM | `error-` | A09, A10 |
| 11 | Infrastructure & HTTP Hardening | MEDIUM | `infra-` | A02 |

## Quick Reference

### 1. Authentication & Authorization (CRITICAL)

- `auth-password-hashing` — Use bcrypt/Argon2 for password storage
- `auth-jwt-validation` — Fully validate JWT signature, algorithm, and claims
- `auth-session-management` — Use secure, HttpOnly, SameSite cookies
- `auth-rbac` — Enforce role-based access control on every endpoint
- `auth-token-expiry` — Set short-lived access tokens, rotate refresh tokens
- `auth-oauth-state` — Use state + PKCE in OAuth/OIDC flows
- `auth-mfa` — Enforce MFA for privileged operations
- `auth-ssrf-prevention` — Prevent SSRF with URL allowlists and private IP blocking

### 2. Input Validation & Injection Prevention (CRITICAL)

- `input-parameterized-queries` — Always use parameterized queries to prevent SQL injection
- `input-validate-server-side` — Validate and sanitize all input server-side
- `input-xss-prevention` — Escape all output rendered as HTML
- `input-path-traversal` — Sanitize file paths, never construct from user input
- `input-command-injection` — Never construct shell commands from user input
- `input-deserialization` — Avoid unsafe deserialization of untrusted data
- `input-xml-xxe` — Disable external entity processing in XML parsers
- `input-mass-assignment` — Prevent mass assignment with explicit field allowlists

### 3. Secrets & Credentials Management (CRITICAL)

- `secrets-no-hardcoded` — Never hardcode secrets, API keys, or credentials
- `secrets-env-management` — Use a secrets manager, not plain env files
- `secrets-rotation` — Implement and test automatic secret rotation
- `secrets-scanning` — Scan commits and CI for leaked secrets

### 4. Software Composition Analysis & CVE Scanning (CRITICAL)

- `sca-jfrog-xray` — Integrate JFrog Xray for deep artifact and container SCA
- `sca-owasp-dependency-check` — Run OWASP Dependency Check for CVE scanning in CI
- `sca-trivy-scan` — Use Trivy to scan containers and filesystems for CVEs
- `sca-cve-version-blocking` — Block builds when HIGH/CRITICAL CVE versions are detected
- `sca-sbom-generation` — Generate and publish a Software Bill of Materials (SBOM)

### 5. API Security (HIGH)

- `api-rate-limiting` — Apply rate limiting and throttling on all endpoints
- `api-cors` — Configure CORS to allow only trusted origins
- `api-https-only` — Enforce HTTPS; redirect HTTP and set HSTS
- `api-schema-validation` — Validate request body/query against a schema
- `api-idempotency` — Use idempotency keys for mutating endpoints
- `api-file-upload` — Secure file uploads with type validation and safe storage

### 6. Data Protection & Cryptography (HIGH)

- `data-encryption-at-rest` — Encrypt sensitive data at rest with AES-256
- `data-tls-in-transit` — Use TLS 1.2+ for all data in transit
- `data-minimal-collection` — Collect only the data you actually need
- `data-pii-masking` — Mask or redact PII in logs and error messages

### 7. Static Application Security Testing (HIGH)

- `sast-sonarqube` — Integrate SonarQube/SonarCloud as a PR quality gate
- `sast-semgrep` — Use Semgrep for custom security rule enforcement
- `sast-codeql` — Enable GitHub CodeQL for automated vulnerability discovery

### 8. Secure Design (HIGH)

- `design-threat-modeling` — Require threat models for new features and services

### 9. Dependency & Supply Chain Security (MEDIUM-HIGH)

- `deps-audit` — Run dependency audits in CI on every build
- `deps-lock-files` — Always commit and verify lock files
- `deps-minimal-surface` — Prefer narrow, well-maintained packages

### 10. Error Handling & Logging (MEDIUM)

- `error-no-stack-traces` — Never expose stack traces or internal errors to clients
- `error-security-events` — Log all authentication and authorization events
- `error-no-sensitive-logs` — Never log passwords, tokens, or PII
- `error-graceful-degradation` — Implement circuit breakers and graceful fallbacks
- `error-resource-cleanup` — Ensure exception-safe resource cleanup

### 11. Infrastructure & HTTP Hardening (MEDIUM)

- `infra-security-headers` — Set all critical security HTTP headers
- `infra-csp` — Implement a strict Content Security Policy
- `infra-least-privilege` — Apply least-privilege to all service accounts and IAM roles

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/auth-ssrf-prevention.md
rules/input-deserialization.md
rules/design-threat-modeling.md
rules/error-graceful-degradation.md
```

Each rule file contains:
- Why it matters (CWE reference, OWASP category, and impact)
- Vulnerable / misconfigured code example
- Secure / correctly configured example
- References to OWASP, CWE, or tool documentation

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
