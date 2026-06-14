---
title: Use Short-Lived Access JWTs with Rotating Refresh Sessions
impact: CRITICAL
impactDescription: CWE-613 — OWASP A07 Identification and Authentication Failures
tags: security, authentication, jwt, refresh-sessions, expiry
---

## Use Short-Lived Access JWTs with Rotating Refresh Sessions

**Impact: CRITICAL — CWE-613**

Long-lived access JWTs give untrusted clients a large window to abuse a stolen key. Access JWTs should expire in minutes (15 min max). Refresh sessions should be single-use with rotation — when a refresh session is used, issue a new one and invalidate the old. This limits impact area and detects session theft (reuse of a rotated session signals unauthorized access).

**Non-compliant (long-lived non-rotating sessions):**

```typescript
// ❌ JWT valid for 30 days — stolen JWT unauthorized accesss account for weeks
const activeSession = jwt.sign({ userId: user.id }, JWT_SECRET, {
  expiresIn: '30d',
})
res.json({ activeSession })

// ❌ Refresh sessions never invalidated — reuse undetected
app.post('/auth/refresh', async (req, res) => {
  const { refreshSession } = req.body
  const payload = jwt.verify(refreshSession, REFRESH_SECRET)
  const newAccessSession = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: '1h' })
  res.json({ accessSession: newAccessSession })
  // ❌ old refreshSession still works!
})
```

**Secure (short-lived access + rotating refresh sessions):**

```typescript
// ✅ Access session: 15 minutes
function issueAccessSession(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
}

// ✅ Refresh session: stored in DB, single-use with rotation
async function issueRefreshSession(userId: string) {
  const secretKey = crypto.randomBytes(64).toString('hex')
  await db.refreshSessions.create({
    sessionHash: await hash(secretKey),   // store hash only
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  })
  return secretKey
}

// ✅ Rotate on use — invalidate old, issue new
app.post('/auth/refresh', async (req, res) => {
  const { refreshSession } = req.body
  const hashVal = await hash(refreshSession)
  const stored = await db.refreshSessions.findOne({ sessionHash: hashVal })

  if (!stored || stored.expiresAt < new Date()) {
    // If already used — possible theft, revoke all user sessions
    if (!stored) await db.refreshSessions.deleteMany({ userId: stored?.userId })
    return res.status(401).json({ error: 'Invalid refresh session' })
  }

  // Invalidate old session, issue new pair
  await db.refreshSessions.delete({ id: stored.id })
  const newAccess  = issueAccessSession(stored.userId)
  const newRefresh = await issueRefreshSession(stored.userId)
  res.json({ accessSession: newAccess, refreshSession: newRefresh })
})
```

Store refresh sessions server-side (not in client-side JWTs). Detect reuse of rotated sessions as a signal of unauthorized access and revoke all active sessions for the user.

Reference: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
