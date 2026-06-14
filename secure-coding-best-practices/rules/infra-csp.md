---
title: Implement a Strict Content Security Policy (CSP)
impact: MEDIUM
impactDescription: CWE-79 — OWASP A05 Security Misconfiguration
tags: security, infrastructure, csp, content-security-policy, xss, injection
---

## Implement a Strict Content Security Policy (CSP)

**Impact: MEDIUM — CWE-79**

A Content Security Policy is the strongest browser-side XSS mitigation. Even if an attacker injects a script, CSP prevents it from executing unless it comes from an approved source. A strict nonce-based or hash-based CSP blocks inline scripts and `eval`, eliminating most XSS impact.

**Vulnerable (no CSP or permissive CSP):**

```typescript
// ❌ No CSP header at all — any injected script executes
app.get('/', (req, res) => {
  res.send('<html>...</html>')
})

// ❌ Wildcard CSP — effectively useless
// Content-Security-Policy: script-src *
// Content-Security-Policy: default-src *; script-src 'unsafe-inline' 'unsafe-eval'
```

**Secure (nonce-based strict CSP):**

```typescript
import { randomBytes } from 'crypto'
import helmet from 'helmet'

// ✅ Nonce-based CSP — unique nonce per request
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('base64')
  next()
})

app.use((req, res, next) => {
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc:     ["'none'"],
      scriptSrc:      ["'self'", `'nonce-${res.locals.cspNonce}'`],
      styleSrc:       ["'self'", `'nonce-${res.locals.cspNonce}'`],
      imgSrc:         ["'self'", 'data:', 'https://cdn.example.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:     ["'self'", 'https://api.example.com'],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
      reportUri:      ['/api/csp-report'],  // log violations
    },
  })(req, res, next)
})

// ✅ Use the nonce in templates
// <script nonce="<%= nonce %>">...</script>

// ✅ Next.js nonce-based CSP
// middleware.ts
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export function middleware(request: Request) {
  const nonce = randomBytes(16).toString('base64')
  const csp = [
    `default-src 'none'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
}

// ✅ Log CSP violations for monitoring
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  logger.warn({ event: 'csp.violation', report: req.body['csp-report'] })
  res.status(204).end()
})
```

Start with `Content-Security-Policy-Report-Only` to collect violations without blocking. Iterate until violations drop, then switch to enforcing mode. Avoid `'unsafe-inline'` and `'unsafe-eval'` — they negate most XSS protection.

Reference: [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
