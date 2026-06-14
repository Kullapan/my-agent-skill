---
title: Configure CORS to Allow Only Trusted Origins
impact: HIGH
impactDescription: CWE-346 — OWASP A01 Broken Access Control
tags: security, api, cors, cross-origin, headers, access-control
---

## Configure CORS to Allow Only Trusted Origins

**Impact: HIGH — CWE-346**

Misconfigured CORS allows untrusted websites to make authenticated cross-origin requests to your API on behalf of users (reading data, triggering actions). A wildcard `Access-Control-Allow-Origin: *` with `credentials: true` is a critical misconfiguration — browsers block it, but some setups inadvertently reflect the request origin, which has the same effect.

**Non-compliant (wildcard or reflected origin):**

```typescript
// ❌ Wildcard — any website can call your API cross-origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Credentials', 'true')  // browsers block this combination
  next()
})

// ❌ Reflecting any Origin header — effectively a wildcard
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin)  // dangerous!
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})

// ❌ Weak origin validation — untrusted client uses evil.myapp.com
const origin = req.headers.origin
if (origin.includes('myapp.com')) {  // substring match is bypassable
  res.header('Access-Control-Allow-Origin', origin)
}
```

**Secure (explicit allowlist with exact match):**

```typescript
import cors from 'cors'

// ✅ Explicit origin allowlist — exact string match
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://www.example.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean) as string[])

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin not allowed: ${origin}`))
    }
  },
  credentials: true,              // required for cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,                  // cache preflight for 24h
}

app.use(cors(corsOptions))

// ✅ For public APIs (no credentials), wildcard is safe
const publicCors = cors({ origin: '*', credentials: false })
app.use('/api/public', publicCors)
```

For APIs that only serve your own frontend, use `SameSite=Strict` cookies instead of CORS-allowed cross-origin requests. Never combine `credentials: true` with `origin: '*'`.

Reference: [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CORS_Security_Cheat_Sheet.html)
