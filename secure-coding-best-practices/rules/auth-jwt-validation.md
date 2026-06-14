---
title: Fully Validate JWT Signature, Algorithm, and Claims
impact: CRITICAL
impactDescription: CWE-347 — OWASP A07 Identification and Authentication Failures
tags: security, authentication, jwt, tokens, signature, algorithm
---

## Fully Validate JWT Signature, Algorithm, and Claims

**Impact: CRITICAL — CWE-347**

JWTs must be validated on every request: verify the signature, reject the `none` algorithm, enforce `alg` allowlist, and check `exp`, `iss`, and `aud` claims. Skipping any step allows untrusted clients to forge tokens, elevate privileges, or reuse expired tokens.

**Non-compliant (incomplete validation):**

```typescript
// ❌ Only decodes — does NOT verify signature
import jwt from 'jsonwebtoken'
const payload = jwt.decode(token) // trusts token blindly

// ❌ Accepts 'none' algorithm — untrusted client can forge any payload
const payload = jwt.verify(token, secret) // if alg not locked down

// ❌ No expiry, issuer, or audience check
const payload = jwt.verify(token, secret, {})
```

**Secure (strict validation with allowlist):**

```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET  = process.env.JWT_SECRET!
const JWT_ISSUER  = 'https://auth.example.com'
const JWT_AUDIENCE = 'https://api.example.com'

function verifyToken(token: string): JwtPayload {
  // ✅ Allowlist algorithm — rejects 'none' and RS256/HS256 confusion
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],   // explicit allowlist only
    issuer:    JWT_ISSUER,
    audience:  JWT_AUDIENCE,
    // exp is checked automatically by jsonwebtoken
  })
  return payload as JwtPayload
}

// ✅ Use on every protected route
app.get('/api/resource', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = verifyToken(token)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
})
```

Never trust `jwt.decode()` for authorization. Always specify an algorithm allowlist. Validate `iss` and `aud` to prevent token reuse across services.

Reference: [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
