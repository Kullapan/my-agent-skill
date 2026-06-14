---
title: Enforce HTTPS and Set HTTP Strict Transport Security (HSTS)
impact: HIGH
impactDescription: CWE-319 — OWASP A02 Cryptographic Failures
tags: security, api, https, hsts, tls, transport-security, http-redirect
---

## Enforce HTTPS and Set HTTP Strict Transport Security (HSTS)

**Impact: HIGH — CWE-319**

Plaintext HTTP exposes all traffic — credentials, session tokens, and data — to network-level interception (MITM attacks). HSTS tells browsers to only connect via HTTPS, preventing downgrade attacks even when a user types `http://`. Redirect all HTTP traffic to HTTPS server-side.

**Vulnerable (HTTP allowed, no HSTS):**

```typescript
// ❌ No redirect from HTTP to HTTPS
app.listen(80)  // serves plaintext HTTP

// ❌ No HSTS header — browser may use HTTP first
app.get('/', (req, res) => {
  res.send('Hello')  // no HSTS header set
})
```

**Secure (HTTPS-only with HSTS):**

```typescript
import helmet from 'helmet'
import express from 'express'

const app = express()

// ✅ Force HTTPS redirect — HTTP → HTTPS
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  }
  next()
})

// ✅ HSTS — strict transport security with long max-age and subdomains
app.use(helmet.hsts({
  maxAge:            365 * 24 * 60 * 60,  // 1 year (recommended: 2 years)
  includeSubDomains: true,
  preload:           true,                // submit to HSTS preload list
}))

// ✅ Full helmet setup (includes HSTS + other security headers)
app.use(helmet())

// ✅ NGINX config — redirect HTTP and set HSTS
// server {
//   listen 80;
//   return 301 https://$host$request_uri;
// }
// server {
//   listen 443 ssl;
//   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
//   ssl_protocols TLSv1.2 TLSv1.3;
//   ssl_prefer_server_ciphers off;
// }
```

Submit your domain to the [HSTS preload list](https://hstspreload.org) for the strongest protection. Use TLS 1.2+ only — disable TLS 1.0 and 1.1. Obtain certificates from Let's Encrypt (free) or your CA.

Reference: [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
