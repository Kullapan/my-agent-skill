---
title: Use Short-Lived Access Tokens with Rotating Refresh Tokens
impact: CRITICAL
impactDescription: CWE-613 — OWASP A07 Identification and Authentication Failures
tags: security, authentication, tokens, jwt, refresh-tokens, expiry
---

## Use Short-Lived Access Tokens with Rotating Refresh Tokens

**Impact: CRITICAL — CWE-613**

Long-lived access tokens give attackers a large window to exploit a stolen token. Access tokens should expire in minutes (15 min max). Refresh tokens should be single-use with rotation — when a refresh token is used, issue a new one and invalidate the old. This limits blast radius and detects token theft (reuse of a rotated token signals compromise).

**Vulnerable (long-lived non-rotating tokens):**

```typescript
// ❌ Token valid for 30 days — stolen token compromises account for weeks
const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
  expiresIn: '30d',
})
res.json({ token })

// ❌ Refresh tokens never invalidated — reuse undetected
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body
  const payload = jwt.verify(refreshToken, REFRESH_SECRET)
  const newAccessToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: '1h' })
  res.json({ accessToken: newAccessToken })
  // ❌ old refreshToken still works!
})
```

**Secure (short-lived access + rotating refresh tokens):**

```typescript
// ✅ Access token: 15 minutes
function issueAccessToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
}

// ✅ Refresh token: stored in DB, single-use with rotation
async function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(64).toString('hex')
  await db.refreshTokens.create({
    token: await hash(token),   // store hash only
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  })
  return token
}

// ✅ Rotate on use — invalidate old, issue new
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body
  const tokenHash = await hash(refreshToken)
  const stored = await db.refreshTokens.findOne({ token: tokenHash })

  if (!stored || stored.expiresAt < new Date()) {
    // If already used — possible theft, revoke all user tokens
    if (!stored) await db.refreshTokens.deleteMany({ userId: stored?.userId })
    return res.status(401).json({ error: 'Invalid refresh token' })
  }

  // Invalidate old token, issue new pair
  await db.refreshTokens.delete({ id: stored.id })
  const newAccess  = issueAccessToken(stored.userId)
  const newRefresh = await issueRefreshToken(stored.userId)
  res.json({ accessToken: newAccess, refreshToken: newRefresh })
})
```

Store refresh tokens server-side (not in JWTs). Detect reuse of rotated tokens as a signal of compromise and revoke all sessions for the user.

Reference: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
