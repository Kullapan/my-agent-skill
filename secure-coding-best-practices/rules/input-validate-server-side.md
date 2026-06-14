---
title: Validate and Sanitize All Input Server-Side
impact: CRITICAL
impactDescription: CWE-20 — OWASP A03 Injection / A04 Insecure Design
tags: security, validation, sanitization, input, schema, zod
---

## Validate and Sanitize All Input Server-Side

**Impact: CRITICAL — CWE-20**

Client-side validation is a UX convenience, not a security control. Untrusted clients bypass it trivially with curl or browser DevTools. All data from HTTP requests (body, query, params, headers) must be validated and typed server-side before use. Use a schema validation library — manual checks miss edge cases.

**Non-compliant (trusting client input):**

```typescript
// ❌ Using req.body directly — no type or shape validation
app.post('/api/users', async (req, res) => {
  const { email, age, role } = req.body
  // untrusted client can send: { role: 'admin', age: -1, email: null }
  await db.users.create({ email, age, role })
})

// ❌ No range or type check on numeric params
app.get('/api/items', async (req, res) => {
  const limit = req.query.limit  // string, could be 'DROP TABLE users'
  const items = await db.items.findMany({ take: limit })
})
```

**Secure (schema validation with Zod):**

```typescript
import { z } from 'zod'

// ✅ Define schema — explicit shape, types, ranges, and safe defaults
const CreateUserSchema = z.object({
  email:    z.string().email().max(254),
  age:      z.number().int().min(0).max(150),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  // role is NOT accepted from client — set server-side
})

app.post('/api/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() })
  }
  const { email, age, username } = result.data
  await db.users.create({ email, age, username, role: 'user' }) // role set by server
})

// ✅ Query params with safe coercion and limits
const ListSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
})

app.get('/api/items', async (req, res) => {
  const { limit, offset, search } = ListSchema.parse(req.query)
  const items = await db.items.findMany({ take: limit, skip: offset })
  res.json(items)
})
```

Never trust fields like `role`, `isAdmin`, `price`, or `userId` from the client. Derive privilege and ownership from the authenticated session, not from request data.

Reference: [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
