# Sections

This file defines all sections, their ordering, severity levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Authentication & Authorization (auth)

**Impact:** CRITICAL
**Description:** Broken authentication and access control are the #1 and #2 most critical web vulnerabilities (OWASP A01/A07). Flaws here lead directly to account takeover, privilege escalation, SSRF, and full data breach.

## 2. Input Validation & Injection Prevention (input)

**Impact:** CRITICAL
**Description:** Injection vulnerabilities (SQL, command, XSS, XXE, deserialization, mass assignment) remain the most exploited class of flaws (OWASP A05). All untrusted data must be validated, sanitized, and escaped before use.

## 3. Secrets & Credentials Management (secrets)

**Impact:** CRITICAL
**Description:** Leaked credentials are the fastest path to a breach (OWASP A04). Secrets must never appear in source code, logs, or unencrypted storage. Rotation and scanning must be automated.

## 4. API Security (api)

**Impact:** HIGH
**Description:** APIs are the primary attack surface for modern applications. Rate limiting, CORS, schema validation, HTTPS enforcement, secure file uploads, and idempotency are essential first lines of defense.

## 5. Data Protection & Cryptography (data)

**Impact:** HIGH
**Description:** Sensitive data must be encrypted at rest and in transit using modern algorithms (OWASP A04). Collect only what is needed; mask PII in all non-production contexts.

## 6. Dependency & Supply Chain Security (deps)

**Impact:** MEDIUM-HIGH
**Description:** Third-party packages are a major vector for supply chain attacks (OWASP A03/A08). Audit dependencies regularly, pin versions via lock files, and minimize the attack surface.

## 7. Error Handling & Logging (error)

**Impact:** MEDIUM
**Description:** Improper error handling leaks system internals to attackers and causes resource exhaustion (OWASP A09/A10). Security events must be logged without capturing sensitive data. Resources must be cleaned up in all code paths.

## 8. Infrastructure & HTTP Hardening (infra)

**Impact:** MEDIUM
**Description:** Security headers, Content Security Policy, and least-privilege IAM roles provide defense-in-depth (OWASP A02) that limits the blast radius of other vulnerabilities.

## 9. Software Composition Analysis & CVE Scanning (sca)

**Impact:** CRITICAL
**Description:** SCA tools (JFrog Xray, OWASP Dependency Check, Trivy) scan every dependency and container layer for known CVEs (OWASP A03). HIGH and CRITICAL findings must block the build pipeline. Integrate scanning at every stage: developer local, PR, CI, and registry/artifact level.

## 10. Static Application Security Testing & Code Analysis (sast)

**Impact:** HIGH
**Description:** SAST tools (SonarQube, Semgrep, CodeQL) analyse source code for security flaws without executing it. They catch injection patterns, hardcoded secrets, insecure APIs, and code quality issues before code reaches production. Integrate in CI and as pre-merge gates.

## 11. Secure Design (design)

**Impact:** HIGH
**Description:** Insecure design cannot be fixed by code review alone (OWASP A06). Threat models, STRIDE analysis, and abuse case documentation during the design phase prevent architectural flaws that no amount of secure coding can fix.
