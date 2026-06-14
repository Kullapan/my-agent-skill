---
title: Use TLS 1.2+ for All Data in Transit
impact: HIGH
impactDescription: CWE-319 — OWASP A04 Cryptographic Failures
tags: security, tls, encryption, transport, https, ssl, certificate
---

## Use TLS 1.2+ for All Data in Transit

**Impact: HIGH — CWE-319**

Data transmitted without TLS or with deprecated versions (TLS 1.0, 1.1, SSL 3.0) is vulnerable to interception, man-in-the-middle attacks, and protocol downgrade attacks (BEAST, POODLE, CRIME). All communication — between client and server, between microservices, and to databases — must use TLS 1.2 or higher. TLS 1.0 and 1.1 were officially deprecated by RFC 8996 in March 2021.

**Vulnerable (no TLS or deprecated versions):**

```typescript
// ❌ HTTP connection to database — credentials sent in plain text
import { Pool } from 'pg'
const pool = new Pool({
  host: 'db.internal.example.com',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  ssl: false,  // Plain text connection — password visible on network
})

// ❌ Internal microservice call without TLS
const response = await fetch('http://user-service.internal:3000/api/users/123')
// Authentication headers sent in plain text over the network

// ❌ Node.js HTTPS server allowing TLS 1.0
import https from 'https'
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  // No minVersion set — defaults allow TLS 1.0 and 1.1
})
```

**Secure (TLS 1.2+ enforced everywhere):**

```typescript
// ✅ Database connection with TLS required
import { Pool } from 'pg'
const pool = new Pool({
  host: 'db.internal.example.com',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,              // Verify server certificate
    ca: fs.readFileSync('/etc/ssl/db-ca.pem'),  // Pin the CA
    minVersion: 'TLSv1.2',                // Reject TLS 1.0/1.1
  },
})

// ✅ Internal service calls over HTTPS
const response = await fetch('https://user-service.internal:3000/api/users/123', {
  headers: { Authorization: `Bearer ${token}` },
})

// ✅ HTTPS server with TLS 1.2+ minimum
import https from 'https'
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  minVersion: 'TLSv1.2',     // Reject TLS 1.0 and 1.1
  ciphers: [                   // Strong cipher suites only
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
  ].join(':'),
})
```

Enforce TLS for all internal and external communication. Use `rejectUnauthorized: true` to validate server certificates. For internal services, consider mutual TLS (mTLS) where both client and server authenticate.

Reference: [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
