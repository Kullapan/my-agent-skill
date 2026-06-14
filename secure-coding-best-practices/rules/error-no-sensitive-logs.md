---
title: Never Log Passwords, Tokens, or PII
impact: MEDIUM
impactDescription: CWE-532 — OWASP A09 Logging & Alerting Failures
tags: security, logging, pii, secrets, redaction, privacy, gdpr
---

## Never Log Passwords, Tokens, or PII

**Impact: MEDIUM — CWE-532**

Log files are often stored with weaker access controls than production databases — aggregated in centralized logging systems, backed up to less secure storage, and accessible to broader engineering teams. Logging passwords, API keys, JWTs, credit card numbers, or PII gives attackers who gain access to logs a direct path to credentials and personal data. It also creates GDPR/PCI-DSS compliance violations.

**Vulnerable (sensitive data in logs):**

```typescript
// ❌ Logging the entire request body — includes passwords and tokens
app.post('/api/login', async (req, res) => {
  logger.info('Login attempt', { body: req.body })
  // Logs: { body: { email: "user@example.com", password: "MyS3cret!" } }

  const user = await authenticate(req.body.email, req.body.password)
  logger.info('Login successful', { user })
  // Logs: { user: { id: 1, email: "user@example.com", ssn: "123-45-6789" } }
})

// ❌ Logging authorization headers — exposes JWT/API keys
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    url: req.url,
    headers: req.headers,  // Includes Authorization: Bearer eyJhbGci...
  })
  next()
})
```

**Secure (structured logging with redaction):**

```typescript
import pino from 'pino'

// ✅ Configure logger with automatic redaction of sensitive fields
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.confirmPassword',
      'body.token',
      'body.creditCard',
      'body.ssn',
      'user.ssn',
      'user.password',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
})

// ✅ Log only safe, non-sensitive identifiers
app.post('/api/login', async (req, res) => {
  logger.info({ email: req.body.email }, 'Login attempt')
  // Logs: { email: "user@example.com", msg: "Login attempt" }

  const user = await authenticate(req.body.email, req.body.password)
  logger.info({ userId: user.id, role: user.role }, 'Login successful')
  // Logs: { userId: 1, role: "user", msg: "Login successful" }
})

// ✅ Mask PII helper for when logging is necessary
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local[0]}***@${domain}`  // "u***@example.com"
}
```

Configure your logging framework to automatically redact sensitive fields. Never log `req.body` or `req.headers` without filtering. Use structured loggers (Pino, Winston) with built-in redaction support.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
