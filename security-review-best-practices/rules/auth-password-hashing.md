---
title: Use bcrypt or Argon2 for Password Hashing
impact: CRITICAL
impactDescription: CWE-916 — OWASP A02 Cryptographic Failures
tags: security, authentication, passwords, hashing, bcrypt, argon2
---

## Use bcrypt or Argon2 for Password Hashing

**Impact: CRITICAL — CWE-916**

Passwords must never be stored in plaintext or with fast hash functions (MD5, SHA-1, SHA-256). Fast hashes allow attackers to crack millions of passwords per second with GPU hardware after a database breach. bcrypt, Argon2id, or scrypt are intentionally slow and memory-hard, making brute-force infeasible.

**Vulnerable (plaintext or weak hash):**

```typescript
// ❌ Storing plaintext password
await db.users.create({ email, password: plaintext })

// ❌ Fast hash — cracks at ~10 billion/sec on modern GPU
import { createHash } from 'crypto'
const hash = createHash('sha256').update(password).digest('hex')
await db.users.create({ email, password: hash })
```

**Secure (Argon2id — recommended, or bcrypt):**

```typescript
import argon2 from 'argon2'

// ✅ Hash on registration
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4,
})
await db.users.create({ email, passwordHash: hash })

// ✅ Verify on login
const isValid = await argon2.verify(user.passwordHash, password)
if (!isValid) throw new AuthError('Invalid credentials')

// ✅ Alternative: bcrypt (cost factor >= 12)
import bcrypt from 'bcrypt'
const hash = await bcrypt.hash(password, 12)
const isValid = await bcrypt.compare(password, user.passwordHash)
```

Use Argon2id as the first choice (winner of Password Hashing Competition). Use bcrypt with cost ≥ 12 as a widely-supported alternative. Never use MD5, SHA-1, SHA-2, or any unsalted hash for passwords.

Reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
