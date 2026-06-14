---
title: Use Parameterized Queries to Prevent SQL Injection
impact: CRITICAL
impactDescription: CWE-89 — OWASP A03 Injection
tags: security, injection, sql, database, parameterized-queries, orm
---

## Use Parameterized Queries to Prevent SQL Injection

**Impact: CRITICAL — CWE-89**

SQL injection is the most abused injection code gap. Concatenating user input into SQL strings allows untrusted clients to read any table, bypass authentication, delete data, or execute OS commands via `xp_cmdshell`. Always use parameterized queries or an ORM that handles escaping.

**Non-compliant (string concatenation):**

```typescript
// ❌ Classic SQL injection — untrusted client enters: ' OR '1'='1
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`
const user = await db.raw(query)

// ❌ Still injectable — template literals don't escape
const id = req.params.id
const result = await db.raw(`SELECT * FROM orders WHERE user_id = ${id}`)

// ❌ ORM bypass — using raw() with interpolation
const name = req.query.name
await db.raw(`UPDATE products SET name = '${name}' WHERE id = ?`, [id])
```

**Secure (parameterized queries and ORM):**

```typescript
// ✅ Parameterized query — values never interpreted as SQL
const user = await db.raw(
  'SELECT * FROM users WHERE email = ?',
  [req.body.email]
)

// ✅ ORM (Prisma) — always parameterized
const user = await prisma.user.findFirst({
  where: { email: req.body.email }
})

// ✅ ORM (TypeORM) — use parameter binding
const user = await userRepo.findOne({
  where: { email: req.body.email }
})

// ✅ If raw queries are needed, always bind
const result = await db.raw(
  'SELECT * FROM orders WHERE user_id = ? AND status = ?',
  [req.user.id, req.query.status]
)

// ✅ Drizzle ORM — typed and safe
const result = await db.select()
  .from(orders)
  .where(eq(orders.userId, req.user.id))
```

If you must use dynamic column/table names (for sorting), use a strict allowlist — never interpolate directly. Validate that sort fields match a fixed set: `if (!['name', 'email'].includes(sortBy)) throw new Error('Invalid sort field')`.

Reference: [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
