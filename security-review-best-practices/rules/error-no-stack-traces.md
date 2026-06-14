---
title: Never Expose Stack Traces or Internal Errors to Clients
impact: MEDIUM
impactDescription: CWE-209 — OWASP A05 Security Misconfiguration
tags: security, error-handling, stack-traces, information-disclosure, production
---

## Never Expose Stack Traces or Internal Errors to Clients

**Impact: MEDIUM — CWE-209**

Stack traces reveal file paths, framework versions, library names, database schemas, and internal logic — a reconnaissance goldmine for attackers. In production, return only a generic error message to clients; log the full details server-side with a correlation ID so engineers can debug.

**Vulnerable (exposing internals):**

```typescript
// ❌ Default Express error handler — sends full stack to client
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: err.message, stack: err.stack })
  // Exposes: /app/src/routes/users.ts, column names, SQL queries, etc.
})

// ❌ Unhandled promise rejection exposes details in response
app.get('/user/:id', async (req, res) => {
  const user = await db.user.findOrFail(req.params.id)  // throws: "Record not found in table users"
  res.json(user)
  // Error message reveals table name and query pattern
})
```

**Secure (generic client response + full server-side logging):**

```typescript
import { randomUUID } from 'crypto'

// ✅ Centralized error handler — generic client response, full server log
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const errorId = randomUUID()

  // Log full details server-side with correlation ID
  logger.error({
    errorId,
    message: err instanceof Error ? err.message : String(err),
    stack:   err instanceof Error ? err.stack : undefined,
    url:     req.url,
    method:  req.method,
    userId:  req.user?.id,
  })

  // Determine HTTP status from error type
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: 'Invalid request', errorId })
  }
  if (err instanceof AuthError) {
    return res.status(401).json({ error: 'Unauthorized', errorId })
  }
  if (err instanceof ForbiddenError) {
    return res.status(403).json({ error: 'Forbidden', errorId })
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: 'Not found', errorId })
  }

  // ✅ Generic 500 — no internal details
  res.status(500).json({
    error:   'An unexpected error occurred',
    errorId, // user can report this ID; engineer can find full details in logs
  })
})

// ✅ Also handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Unhandled promise rejection', reason })
})
```

In development, you can expose full error details. Use `NODE_ENV` to gate stack trace exposure. Never expose raw database errors — they reveal schema structure and query patterns.

Reference: [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
