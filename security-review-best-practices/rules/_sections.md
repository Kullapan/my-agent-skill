# Sections

This file defines all sections, their ordering, severity levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Authentication & Authorization (auth)

**Impact:** CRITICAL
**Description:** Broken authentication and access control are the #1 and #2 most critical web vulnerabilities (OWASP A01/A07). Flaws here lead directly to account takeover, privilege escalation, and full data breach.

## 2. Input Validation & Injection Prevention (input)

**Impact:** CRITICAL
**Description:** Injection vulnerabilities (SQL, command, XSS, XXE) remain the most exploited class of flaws. All untrusted data must be validated, sanitized, and escaped before use.

## 3. Secrets & Credentials Management (secrets)

**Impact:** CRITICAL
**Description:** Leaked credentials are the fastest path to a breach. Secrets must never appear in source code, logs, or unencrypted storage. Rotation and scanning must be automated.

## 4. API Security (api)

**Impact:** HIGH
**Description:** APIs are the primary attack surface for modern applications. Rate limiting, CORS, schema validation, and HTTPS enforcement are essential first lines of defense.

## 5. Data Protection & Cryptography (data)

**Impact:** HIGH
**Description:** Sensitive data must be encrypted at rest and in transit using modern algorithms. Collect only what is needed; mask PII in all non-production contexts.

## 6. Dependency & Supply Chain Security (deps)

**Impact:** MEDIUM-HIGH
**Description:** Third-party packages are a major vector for supply chain attacks. Audit dependencies regularly, pin versions via lock files, and minimize the attack surface.

## 7. Error Handling & Logging (error)

**Impact:** MEDIUM
**Description:** Improper error handling leaks system internals to attackers. Security events must be logged without capturing sensitive data, enabling detection and incident response.

## 8. Infrastructure & HTTP Hardening (infra)

**Impact:** MEDIUM
**Description:** Security headers, Content Security Policy, and least-privilege IAM roles provide defense-in-depth that limits the blast radius of other vulnerabilities.

## 9. Software Composition Analysis & CVE Scanning (sca)

**Impact:** CRITICAL
**Description:** SCA tools (JFrog Xray, OWASP Dependency Check, Trivy) scan every dependency and container layer for known CVEs. HIGH and CRITICAL findings must block the build pipeline. Integrate scanning at every stage: developer local, PR, CI, and registry/artifact level.

## 10. Static Application Security Testing & Code Analysis (sast)

**Impact:** HIGH
**Description:** SAST tools (SonarQube, Semgrep, CodeQL) analyse source code for security flaws without executing it. They catch injection patterns, hardcoded secrets, insecure APIs, and code quality issues before code reaches production. Integrate in CI and as pre-merge gates.
