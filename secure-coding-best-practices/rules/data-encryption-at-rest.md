---
title: Encrypt Sensitive Data at Rest with AES-256
impact: HIGH
impactDescription: CWE-311 — OWASP A02 Cryptographic Failures
tags: security, data-protection, encryption, aes, at-rest, database, pii
---

## Encrypt Sensitive Data at Rest with AES-256

**Impact: HIGH — CWE-311**

A database breach exposes unencrypted PII (SSNs, health records, payment data) in plaintext. Encrypt sensitive fields at the application layer with AES-256-GCM, so even a full database dump is useless without the encryption key. This is distinct from TLS in transit — encryption at rest protects against database exfiltration, backup theft, and insider threats.

**Non-compliant (PII stored in plaintext):**

```typescript
// ❌ SSN, card number, health data stored in plaintext
await db.patients.create({
  data: {
    name:          req.body.name,
    ssn:           req.body.ssn,           // plaintext — breach exposes millions of SSNs
    healthRecord:  req.body.healthRecord,
    cardNumber:    req.body.cardNumber,
  }
})
```

**Secure (field-level encryption with AES-256-GCM):**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex')  // 32-byte key
const ALGORITHM = 'aes-256-gcm'

// ✅ Encrypt a field value
function encryptField(plaintext: string): string {
  const iv  = randomBytes(12)                        // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()                    // authentication tag (16 bytes)
  // Store: iv + tag + ciphertext, base64-encoded
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

// ✅ Decrypt a field value
function decryptField(encoded: string): string {
  const buf  = Buffer.from(encoded, 'base64')
  const iv   = buf.subarray(0, 12)
  const tag  = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ✅ Encrypt before storing, decrypt after fetching
await db.patients.create({
  data: {
    name:         req.body.name,
    ssnEncrypted: encryptField(req.body.ssn),
    healthRecord: encryptField(req.body.healthRecord),
    // cardNumber: DO NOT store — use Stripe/payment vault instead
  }
})

const patient = await db.patients.findById(id)
const ssn = decryptField(patient.ssnEncrypted)
```

Store the encryption key in a secrets manager, not alongside the data. For payment card data, use a PCI-DSS compliant vault (Stripe, Braintree) — never store card numbers yourself. Rotate encryption keys annually using envelope encryption.

Reference: [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
