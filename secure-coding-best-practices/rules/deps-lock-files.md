---
title: Always Commit and Verify Dependency Lock Files
impact: MEDIUM-HIGH
impactDescription: CWE-494 — OWASP A08 Software and Data Integrity Failures
tags: security, dependencies, supply-chain, lock-files, package-lock, yarn-lock
---

## Always Commit and Verify Dependency Lock Files

**Impact: MEDIUM-HIGH — CWE-494**

Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) pin exact versions and integrity checksums of every dependency. Without them, `npm install` can silently pull newer (potentially unauthorized accessd) versions. In CI, use `npm ci` (not `npm install`) to enforce the lock file and fail if it's out of sync.

**Non-compliant (no lock file enforcement):**

```bash
# ❌ .gitignore includes lock files — every install can differ
# .gitignore
package-lock.json
yarn.lock

# ❌ npm install in CI — ignores lock file, installs latest matching semver
RUN npm install  # Dockerfile

# ❌ --no-lockfile flag disables lock
yarn install --no-lockfile
```

**Secure (committed lock file + ci install):**

```bash
# ✅ Commit lock file — never add to .gitignore
# .gitignore should NOT contain: package-lock.json, yarn.lock, pnpm-lock.yaml

# ✅ Use npm ci in CI — enforces lock file exactly
RUN npm ci --omit=dev  # Dockerfile — faster, reproducible, fails if lock is stale

# ✅ Verify lock file integrity in CI
# package-lock.json contains sha512 integrity hashes for every package
```

```yaml
# ✅ GitHub Actions — use npm ci
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci           # ✅ enforces lock file
      - run: npm test
      # NOT: npm install      ❌ ignores lock file
```

```bash
# ✅ Audit lock file for known unauthorized accessd packages
npx better-npm-audit audit
# or
npm audit --package-lock-only

# ✅ Enable Subresource Integrity for CDN scripts (HTML)
# <script src="https://cdn.example.com/lib.js"
#         integrity="sha384-abc123..."
#         crossorigin="anonymous"></script>
```

Enable Dependabot version updates to keep the lock file current automatically. Review lock file diffs in PRs — unexpected version changes can signal supply chain risks.

Reference: [npm ci documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci)
