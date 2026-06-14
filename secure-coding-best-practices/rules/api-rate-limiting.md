---
title: Apply Rate Limiting and Throttling on All Endpoints
impact: HIGH
impactDescription: CWE-770 — OWASP A04 Insecure Design
tags: security, api, rate-limiting, throttling, brute-force, dos
---

## Apply Rate Limiting and Throttling on All Endpoints

**Impact: HIGH — CWE-770**

Without rate limiting, untrusted clients can brute-force passwords, enumerate accounts, scrape data, or overwhelm your service. Rate limiting is especially critical on authentication endpoints, password reset, and any resource-expensive operation. Apply different limits per endpoint type.

**Non-compliant (no rate limiting):**

```typescript
// ❌ No limit — untrusted client can try millions of passwords
app.post('/auth/login', async (req, res) => {
  const user = await verifyCredentials(req.body.email, req.body.password)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  res.json({ token: issueToken(user) })
})

// ❌ Password reset — untrusted client enumerates valid emails at will
app.post('/auth/forgot-password', async (req, res) => {
  await sendResetEmail(req.body.email)
  res.json({ success: true })
})
```

**Secure (tiered rate limiting per endpoint sensitivity):**

```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// ✅ Strict limit for auth endpoints — per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  message: { error: 'Too many login attempts, try again in 15 minutes' },
})

// ✅ General API limit — per authenticated user
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,                  // 100 requests/min per IP
  keyGenerator: (req) => req.user?.id || req.ip,  // per-user when authenticated
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
})

// ✅ Apply tiered limits
app.post('/auth/login',            authLimiter, loginHandler)
app.post('/auth/forgot-password',  authLimiter, forgotPasswordHandler)
app.post('/auth/register',         authLimiter, registerHandler)
app.use('/api',                    apiLimiter)

// ✅ Account lockout after N failed attempts (complement to rate limiting)
async function trackFailedLogin(userId: string) {
  const key = `failed_logins:${userId}`
  const attempts = await redis.incr(key)
  await redis.expire(key, 15 * 60)  // 15 min window
  if (attempts >= 5) {
    await db.users.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } })
  }
}
```

Use Redis-backed stores so rate limits survive process restarts and work across multiple instances. Add Captcha for high-value auth endpoints as a second layer.

Reference: [OWASP Blocking Brute Force Risks](https://owasp.org/www-community/controls/Blocking_Brute_Force_Risks)
