---
title: Validate Request Body and Query Parameters Against a Schema
impact: HIGH
impactDescription: CWE-20 — OWASP A04 Insecure Design
tags: security, api, schema-validation, input, zod, openapi, request-validation
---

## Validate Request Body and Query Parameters Against a Schema

**Impact: HIGH — CWE-20**

Unvalidated API requests allow untrusted clients to send unexpected types, oversized payloads, or additional fields that bypass business logic, cause prototype pollution, or trigger mass assignment code gaps. Schema validation enforces the contract between client and server and rejects malformed requests early.

**Non-compliant (no schema validation):**

```typescript
// ❌ No validation — untrusted client sends { isAdmin: true, price: -100 }
app.post('/api/products', requireAuth, async (req, res) => {
  const product = await db.products.create({ data: req.body })  // mass assignment!
  res.json(product)
})

// ❌ No query param validation — type coercion issues
app.get('/api/search', async (req, res) => {
  const { q, limit } = req.query
  const results = await db.products.findMany({ where: { name: { contains: q } }, take: limit })
})
```

**Secure (Zod schema per endpoint):**

```typescript
import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'

// ✅ Middleware factory for schema validation
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten(),
      })
    }
    req.body = result.data  // replace with validated + typed data
    next()
  }
}

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid query', details: result.error.flatten() })
    }
    req.query = result.data as any
    next()
  }
}

// ✅ Strict schema — only allowed fields pass through (no mass assignment)
const CreateProductSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price:       z.number().positive().max(1_000_000),
  categoryId:  z.string().uuid(),
  // isAdmin, internalId, etc. are NOT in the schema — stripped automatically
})

const SearchSchema = z.object({
  q:      z.string().max(100).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

app.post('/api/products',
  requireAuth,
  requireRole('seller'),
  validateBody(CreateProductSchema),
  async (req, res) => {
    const product = await db.products.create({
      data: { ...req.body, sellerId: req.user.id }  // ✅ sellerId from session, not body
    })
    res.json(product)
  }
)

app.get('/api/search', validateQuery(SearchSchema), async (req, res) => {
  const { q, limit, offset } = req.query as z.infer<typeof SearchSchema>
  const results = await db.products.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
    take: limit,
    skip: offset,
  })
  res.json(results)
})
```

Zod's `safeParse` strips unknown keys by default. Never spread `req.body` directly into a database create/update — always extract only the fields your schema defines.

Reference: [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
