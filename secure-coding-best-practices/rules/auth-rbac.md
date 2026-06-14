---
title: Enforce Role-Based Access Control on Every Endpoint
impact: CRITICAL
impactDescription: CWE-285 — OWASP A01 Broken Access Control
tags: security, authorization, rbac, access-control, middleware
---

## Enforce Role-Based Access Control on Every Endpoint

**Impact: CRITICAL — CWE-285**

Authorization must be checked server-side on every request. Never rely on the UI to hide privileged actions. Broken access control (OWASP #1) allows attackers to access other users' data, perform admin actions, or escalate privileges simply by changing a URL or role claim.

**Vulnerable (no server-side authorization):**

```typescript
// ❌ Only the frontend hides the admin button — no server check
app.delete('/api/users/:id', async (req, res) => {
  await db.users.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ❌ Trusting a role from the client request body
app.post('/api/report', async (req, res) => {
  if (req.body.role === 'admin') {  // attacker controls this!
    return sendFullReport(res)
  }
})

// ❌ IDOR — user can access any user's data by changing the ID
app.get('/api/profile/:userId', async (req, res) => {
  const user = await db.users.findById(req.params.userId)
  res.json(user)
})
```

**Secure (server-side RBAC middleware + ownership check):**

```typescript
// ✅ Reusable role-check middleware
function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

// ✅ Admin-only route — checked server-side
app.delete('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.users.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ✅ Ownership check — user can only access their own data
app.get('/api/profile/:userId', requireAuth, async (req, res) => {
  if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const user = await db.users.findById(req.params.userId)
  res.json(user)
})
```

Apply authorization middleware before route handlers, not inside them. Check resource ownership for every user-scoped operation. Log all authorization failures for monitoring.

Reference: [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
