---
title: Avoid Unsafe Deserialization of Untrusted Data
impact: CRITICAL
impactDescription: CWE-502 — OWASP A05 Injection / A08 Data Integrity
tags: security, deserialization, injection, rce, input-validation, prototype-pollution
---

## Avoid Unsafe Deserialization of Untrusted Data

**Impact: CRITICAL — CWE-502**

Unsafe deserialization converts untrusted client-controlled bytes or strings into live objects, potentially executing arbitrary code, escalating privileges, or corrupting application state. In JavaScript/Node.js, this manifests as prototype pollution via `JSON.parse` of unvalidated input, `eval`-based deserializers, or libraries like `node-serialize` that execute functions during deserialization. In Java, `ObjectInputStream` on untrusted data has caused some of the most severe RCE code gaps in history.

**Non-compliant (unsafe deserialization):**

```typescript
// ❌ node-serialize executes functions embedded in serialized data
import { unserialize } from 'node-serialize'

app.post('/api/session', (req, res) => {
  // Serialized payload executes an operation during parsing
  // {"rce":"_$$ND_FUNC$$_function(){require('child_process').spawnSync('id')}()"}
  const session = unserialize(req.body.data)
  res.json(session)
})

// ❌ eval-based deserialization
function parseConfig(raw: string): Config {
  return eval('(' + raw + ')')  // Executes arbitrary code!
}

// ❌ Unvalidated JSON.parse — prototype pollution
const userInput = JSON.parse(body)
// If body = '{"__proto__":{"isAdmin":true}}', every object now has isAdmin=true
Object.assign(defaults, userInput)
```

**Secure (safe deserialization with validation):**

```typescript
import { z } from 'zod'

// ✅ Parse JSON then immediately validate against a strict schema
const SessionSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
  expiresAt: z.string().datetime(),
})

app.post('/api/session', (req, res) => {
  const parsed = SessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid session data' })
  }
  // parsed.data is typed and validated — no extra properties
  res.json(parsed.data)
})

// ✅ Prevent prototype pollution with Object.create(null) or explicit property checks
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue  // Block prototype pollution vectors
    }
    target[key] = source[key]
  }
  return target
}
```

Never use `eval`, `Function()`, `node-serialize`, or `vm.runInNewContext` on untrusted input. Always validate deserialized data against a strict schema with an explicit allowlist of expected fields.

Reference: [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
