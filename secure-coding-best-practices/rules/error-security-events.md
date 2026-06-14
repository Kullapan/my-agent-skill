---
title: Log All Authentication and Authorization Security Events
impact: MEDIUM
impactDescription: CWE-778 — OWASP A09 Security Logging and Monitoring Failures
tags: security, logging, monitoring, authentication, authorization, audit-trail, siem
---

## Log All Authentication and Authorization Security Events

**Impact: MEDIUM — CWE-778**

Security events that are not logged cannot be detected or investigated. Without an audit trail, breaches go undetected for months (industry average: 207 days). Log all authentication events — success and failure — with enough context to reconstruct the timeline of an attack. Feed logs to a SIEM for alerting.

**Vulnerable (no security event logging):**

```typescript
// ❌ Login endpoint with no logging
app.post('/auth/login', async (req, res) => {
  const user = await verifyCredentials(req.body.email, req.body.password)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const token = issueToken(user)
  res.json({ token })
  // No record of who logged in, from where, or when
})
```

**Secure (structured security event logging):**

```typescript
import pino from 'pino'

const securityLogger = pino({
  name: 'security',
  redact: ['body.password', 'body.token'],
})

// ✅ Log all auth events with full context
app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  const ip        = req.ip
  const userAgent = req.headers['user-agent']

  try {
    const user = await verifyCredentials(email, password)

    if (!user) {
      // ✅ Log failure — enough detail to detect brute force
      securityLogger.warn({
        event:     'auth.login.failure',
        email:     maskEmail(email),
        ip,
        userAgent,
        reason:    'invalid_credentials',
        timestamp: new Date().toISOString(),
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // ✅ Log success
    securityLogger.info({
      event:     'auth.login.success',
      userId:    user.id,
      email:     maskEmail(email),
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    })

    res.json({ token: issueToken(user) })
  } catch (err) {
    securityLogger.error({ event: 'auth.login.error', ip, error: String(err) })
    res.status(500).json({ error: 'Login failed' })
  }
})

// ✅ Security events to log:
// auth.login.success / failure
// auth.logout
// auth.token.refresh
// auth.mfa.success / failure
// auth.password.change / reset
// authz.forbidden (403 on protected resource)
// authz.suspicious (unexpected role escalation attempt)
// user.created / deleted / role_changed
// secret.accessed (for sensitive operations)
```

Forward security logs to a centralized SIEM (Splunk, Elastic, Datadog). Set alerts for: >10 failed logins from one IP in 5 min, login from new country, privilege escalation, off-hours admin access.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
