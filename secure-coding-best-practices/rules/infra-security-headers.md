---
title: Set All Critical Security HTTP Headers
impact: MEDIUM
impactDescription: CWE-693 — OWASP A05 Security Misconfiguration
tags: security, infrastructure, headers, helmet, x-frame-options, xss-protection, csp
---

## Set All Critical Security HTTP Headers

**Impact: MEDIUM — CWE-693**

Missing security headers leave browsers without important defense-in-depth protections. Headers like `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` prevent clickjacking, MIME sniffing, and information leakage. Use the `helmet` middleware to set all recommended headers in a single line.

**Non-compliant (no security headers):**

```typescript
// ❌ No security headers — browser uses defaults that are permissive
const app = express()
app.use(express.json())
// Missing: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, etc.
```

**Secure (all headers set with helmet):**

```typescript
import helmet from 'helmet'
import express from 'express'

const app = express()

// ✅ Helmet sets all recommended headers with secure defaults
app.use(helmet())
// Sets: X-Frame-Options: SAMEORIGIN
//       X-Content-Type-Options: nosniff
//       X-XSS-Protection: 0 (modern approach — rely on CSP)
//       Referrer-Policy: no-referrer
//       Strict-Transport-Security: max-age=15552000; includeSubDomains
//       Permissions-Policy: (limits camera, mic, geolocation)
//       Cross-Origin-Embedder-Policy: require-corp
//       Cross-Origin-Opener-Policy: same-origin
//       Cross-Origin-Resource-Policy: same-origin

// ✅ Custom configuration for specific needs
app.use(helmet({
  frameguard:          { action: 'deny' },              // block all framing (stricter than SAMEORIGIN)
  hsts:                { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy:      { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: false,  // configure CSP separately (see infra-csp rule)
}))

// ✅ Verify your headers at:
// https://securityheaders.com
// https://observatory.mozilla.org

// ✅ For Next.js — set in next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
```

| Header | Purpose |
|---|---|
| `X-Frame-Options: DENY` | Prevents clickjacking via iframes |
| `X-Content-Type-Options: nosniff` | Prevents MIME type confusion risks |
| `Referrer-Policy: strict-origin` | Limits URL leakage in Referer header |
| `Permissions-Policy` | Restricts browser feature access (camera, mic) |
| `HSTS` | Enforces HTTPS at the browser level |
| `X-XSS-Protection: 0` | Disables legacy XSS auditor (modern browsers use CSP) |

Reference: [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
