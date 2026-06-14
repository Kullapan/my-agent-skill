# Security Review Best Practices

A structured repository of security review rules optimized for agents and LLMs. Covers OWASP Top 10, API security, secrets management, and infrastructure hardening.

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (categories, severities, descriptions)
  - `_template.md` - Template for creating new rules
  - `prefix-description.md` - Individual rule files
- `metadata.json` - Document metadata (version, organization, abstract)
- **`AGENTS.md`** - Compiled output (generated)
- **`test-cases.json`** - Test cases for LLM evaluation (generated)

## Getting Started

> **From the repo root**, use the shared npm scripts:
> ```bash
> node ../scripts/build-skill.js --skill security-review-best-practices
> node ../scripts/validate-skill.js --skill security-review-best-practices
> node ../scripts/extract-tests.js --skill security-review-best-practices
> ```

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> security-review-best-practices
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/prefix-description.md`
2. Choose the appropriate prefix:
   - `auth-` for Authentication & Authorization (Section 1)
   - `input-` for Input Validation & Injection Prevention (Section 2)
   - `secrets-` for Secrets & Credentials Management (Section 3)
   - `api-` for API Security (Section 4)
   - `data-` for Data Protection & Cryptography (Section 5)
   - `deps-` for Dependency & Supply Chain Security (Section 6)
   - `error-` for Error Handling & Logging (Section 7)
   - `infra-` for Infrastructure & HTTP Hardening (Section 8)
3. Fill in the frontmatter and content
4. Include a clear Vulnerable / Secure code example
5. Run `node ../scripts/build-skill.js --skill security-review-best-practices` to regenerate `AGENTS.md`

## Rule File Structure

```markdown
---
title: Rule Title Here
impact: CRITICAL
impactDescription: CWE-xxx or OWASP A0x
tags: security, auth, injection
---

## Rule Title Here

**Impact: CRITICAL — CWE-xxx**

Brief explanation of the vulnerability and why it matters.

**Vulnerable (description of the flaw):**

\`\`\`typescript
// Insecure code
\`\`\`

**Secure (description of the fix):**

\`\`\`typescript
// Safe code
\`\`\`

Reference: [OWASP link](https://cheatsheetseries.owasp.org/)
```

## Severity Levels

| Level | Meaning |
|-------|---------|
| `CRITICAL` | Exploitable — direct data breach, RCE, account takeover |
| `HIGH` | Significant security risk — privilege escalation, data exposure |
| `MEDIUM-HIGH` | Moderate risk — supply chain, information disclosure |
| `MEDIUM` | Defense-in-depth — improves posture, limits blast radius |
| `LOW` | Best practice — hardening and hygiene |

## OWASP Coverage

| OWASP Top 10 | Covered By |
|---|---|
| A01 Broken Access Control | `auth-rbac`, `auth-token-expiry` |
| A02 Cryptographic Failures | `data-encryption-*`, `data-tls-*`, `auth-password-hashing` |
| A03 Injection | `input-parameterized-queries`, `input-command-injection`, `input-xml-xxe` |
| A04 Insecure Design | `auth-mfa`, `api-idempotency`, `data-minimal-collection` |
| A05 Security Misconfiguration | `infra-security-headers`, `infra-csp`, `infra-least-privilege` |
| A06 Vulnerable Components | `deps-audit`, `deps-lock-files`, `deps-minimal-surface` |
| A07 Auth & Session Failures | `auth-session-management`, `auth-jwt-validation`, `auth-oauth-state` |
| A08 Software Integrity Failures | `deps-lock-files`, `secrets-scanning` |
| A09 Logging & Monitoring | `error-security-events`, `error-no-sensitive-logs` |
| A10 SSRF | `input-validate-server-side`, `api-cors` |

## Contributing

1. Use the correct prefix for the security category
2. Always reference a CWE, CVE, or OWASP link
3. Show a clear vulnerable → secure example
4. Add appropriate tags
5. Run build to regenerate `AGENTS.md` and `test-cases.json`
