---
title: Mask or Redact PII in Logs and Error Messages
impact: HIGH
impactDescription: CWE-532 — OWASP A09 Security Logging and Monitoring Failures
tags: security, data-protection, pii, logging, masking, gdpr, privacy
---

## Mask or Redact PII in Logs and Error Messages

**Impact: HIGH — CWE-532**

Logs are frequently shared with third parties (Datadog, Splunk, Sentry), stored insecurely, or accessed by developers who should not see production PII. Logging full email addresses, SSNs, card numbers, or tokens creates privacy and compliance violations (GDPR, HIPAA, PCI-DSS). Mask or redact before any log output.

**Non-compliant (PII in logs):**

```typescript
// ❌ Full PII logged
console.log(`User login: email=${req.body.email}, password=${req.body.password}`)
console.log(`Processing payment for card: ${cardNumber}, cvv: ${cvv}`)
console.log(`Error for user ${user.ssn}:`, error)

// ❌ Entire request body logged (includes passwords, tokens)
app.use((req, res, next) => {
  console.log('Request body:', JSON.stringify(req.body))
  next()
})
```

**Secure (masking and selective logging):**

```typescript
// ✅ Mask helpers
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.charAt(0)}***@${domain}`  // j***@example.com
}

function maskCard(cardNumber: string): string {
  return `****-****-****-${cardNumber.slice(-4)}`  // ****-****-****-1234
}

function maskSsn(ssn: string): string {
  return `***-**-${ssn.slice(-4)}`  // ***-**-6789
}

function redactSensitiveKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = new Set(['password', 'token', 'secret', 'cvv', 'ssn', 'cardNumber'])
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE.has(k.toLowerCase()) ? [k, '[REDACTED]'] : [k, v]
    )
  )
}

// ✅ Structured logging with selective fields
logger.info('user.login', {
  userId:    user.id,              // OK — internal ID
  email:     maskEmail(user.email), // masked
  ip:        req.ip,               // OK for audit
  userAgent: req.headers['user-agent'],
  // NO password, NO full email
})

// ✅ Redact body before logging
app.use((req, res, next) => {
  const safeBody = redactSensitiveKeys(req.body)
  logger.debug('request', { method: req.method, path: req.path, body: safeBody })
  next()
})

// ✅ Use Pino with redact option
import pino from 'pino'
const logger = pino({
  redact: {
    paths: ['req.body.password', 'req.body.token', '*.ssn', '*.cardNumber'],
    censor: '[REDACTED]',
  },
})
```

Configure your logging library's redaction at the library level — not only in individual log calls — so accidental PII leaks are caught centrally. Test log output in staging with real-looking fake data.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
