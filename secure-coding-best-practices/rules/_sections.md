# Sections

This file defines all sections, their ordering, severity levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Authentication & Authorization (auth)

**Impact:** CRITICAL
**Description:** Defines standards for user authentication, access control lists, and authorization verification (OWASP A01/A07). Promotes robust identity check patterns to prevent unauthorized access or privilege issues.

## 2. Input Validation & Injection Prevention (input)

**Impact:** CRITICAL
**Description:** Covers input sanitation, data parameterization, and output escaping standards (OWASP A05). Ensures that all external input is validated and handled safely before processing or rendering.

## 3. Secrets & Credentials Management (secrets)

**Impact:** CRITICAL
**Description:** Guidelines for managing configuration keys, credentials, and cryptographic secrets (OWASP A04). Restricts hardcoding of sensitive configuration parameters and ensures proper storage using environment variables or vault systems.

## 4. API Security (api)

**Impact:** HIGH
**Description:** Guidelines for designing robust and compliant web APIs. Focuses on rate limiting, schema validation, cross-origin configuration (CORS), secure transmission, and request idempotency.

## 5. Data Protection & Cryptography (data)

**Impact:** HIGH
**Description:** Encryption and data minimization guidelines (OWASP A04). Focuses on protecting data at rest and in transit using strong cryptographic algorithms, plus masking personal identifiable information (PII).

## 6. Dependency & Supply Chain Security (deps)

**Impact:** MEDIUM-HIGH
**Description:** Standards for managing third-party libraries and packages (OWASP A03/A08). Focuses on auditing dependencies, locking versions, and minimizing external code footprint.

## 7. Error Handling & Logging (error)

**Impact:** MEDIUM
**Description:** Guidelines for robust error management and event logging (OWASP A09/A10). Prevents exposing stack traces or internal implementation details, and ensures clean resource release in all scenarios.

## 8. Infrastructure & HTTP Hardening (infra)

**Impact:** MEDIUM
**Description:** Configuration standards for HTTP headers, Content Security Policy (CSP), and permission boundaries (OWASP A02). Promotes secure default environments and defense-in-depth principles.

## 9. Software Composition Analysis & CVE Scanning (sca)

**Impact:** CRITICAL
**Description:** Standards for integrating software composition analysis (SCA) tools (e.g., JFrog Xray, Trivy) in development pipelines (OWASP A03). Focuses on monitoring dependencies and container layers for known security alerts and package updates.

## 10. Static Application Security Testing & Code Analysis (sast)

**Impact:** HIGH
**Description:** Static code analysis (SAST) guidelines and tool integrations (e.g., SonarQube, Semgrep, CodeQL). Focuses on scanning codebase structure and programming style patterns during the continuous integration (CI) pipeline.

## 11. Secure Design (design)

**Impact:** HIGH
**Description:** Architectural review guidelines and threat modeling standards (OWASP A06). Promotes secure design principles, access control planning, and threat assessments during the design phase of new features.
