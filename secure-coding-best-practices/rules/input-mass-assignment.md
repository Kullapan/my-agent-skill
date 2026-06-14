---
title: Prevent Mass Assignment by Using Explicit Field Allowlists
impact: HIGH
impactDescription: CWE-915 — OWASP A01 Broken Access Control
tags: security, mass-assignment, access-control, input-validation, orm, allowlist
---

## Prevent Mass Assignment by Using Explicit Field Allowlists

**Impact: HIGH — CWE-915**

Mass assignment occurs when an application directly binds user input to model objects without filtering. An attacker can inject extra fields in the request body — like `role: "admin"`, `price: 0`, or `isVerified: true` — that the ORM dutifully writes to the database. This is a direct path to privilege escalation, financial fraud, and data corruption. Always use explicit allowlists of updatable fields.

**Vulnerable (direct binding of request body to model):**

```typescript
// ❌ Spreading the entire request body into the database update
app.put('/api/users/:id', async (req, res) => {
  // Attacker sends: { name: "Legit", role: "admin", isVerified: true }
  // ORM writes ALL fields, including role and isVerified
  const user = await db.users.update(req.params.id, req.body)
  res.json(user)
})

// ❌ Sequelize: passing req.body directly to create
app.post('/api/products', async (req, res) => {
  // Attacker sends: { name: "Widget", price: 0, sellerId: "other-user-id" }
  const product = await Product.create(req.body)  // Creates product with price=0
  res.json(product)
})

// ❌ Mongoose: no field filtering
app.patch('/api/settings', async (req, res) => {
  // Attacker sends: { theme: "dark", creditBalance: 99999 }
  await Settings.findByIdAndUpdate(req.user.settingsId, req.body)
  res.json({ success: true })
})
```

**Secure (explicit field allowlists):**

```typescript
import { z } from 'zod'

// ✅ Define exactly which fields the user can update
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  // role, isVerified, isAdmin are NOT in the schema — silently stripped
})

app.put('/api/users/:id', async (req, res) => {
  // Zod strips all fields not in the schema
  const data = UpdateUserSchema.parse(req.body)
  // data = { name: "Legit", email: "user@example.com" }
  // role, isVerified, and any injected fields are gone
  const user = await db.users.update(req.params.id, data)
  res.json(user)
})

// ✅ Alternative: pick specific fields explicitly
app.patch('/api/settings', async (req, res) => {
  const allowedFields = ['theme', 'language', 'timezone', 'notifications'] as const
  const safeUpdate: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      safeUpdate[field] = req.body[field]
    }
  }

  await Settings.findByIdAndUpdate(req.user.settingsId, safeUpdate)
  res.json({ success: true })
})
```

Never pass `req.body` directly to ORM `.create()`, `.update()`, or `.findByIdAndUpdate()`. Always filter through a schema (Zod, Joi) or an explicit allowlist of permitted fields. Define separate schemas for creation vs. update to prevent field escalation.

Reference: [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
