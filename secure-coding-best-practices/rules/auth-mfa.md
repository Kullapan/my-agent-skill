---
title: Enforce MFA for Privileged and Sensitive Operations
impact: HIGH
impactDescription: CWE-308 — OWASP A07 Identification and Authentication Failures
tags: security, authentication, mfa, totp, 2fa, privileged-access
---

## Enforce MFA for Privileged and Sensitive Operations

**Impact: HIGH — CWE-308**

Multi-factor authentication (MFA) dramatically reduces the risk of account takeover even when passwords are compromised. MFA should be mandatory for admin roles and strongly encouraged for all users. Step-up authentication (requiring MFA for specific high-risk actions) protects sensitive operations without constant friction.

**Vulnerable (password-only auth for admin actions):**

```typescript
// ❌ Admin action gated only by JWT role — no second factor
app.post('/api/admin/users/:id/delete', requireRole('admin'), async (req, res) => {
  await db.users.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})
```

**Secure (TOTP-based MFA + step-up for sensitive actions):**

```typescript
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

// ✅ Enroll MFA — generate TOTP secret
app.post('/api/mfa/enroll', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `MyApp (${req.user.email})` })
  await db.users.update({
    where: { id: req.user.id },
    data: { mfaSecret: encrypt(secret.base32), mfaEnabled: false },
  })
  const qr = await QRCode.toDataURL(secret.otpauth_url!)
  res.json({ qr, secret: secret.base32 })
})

// ✅ Confirm enrollment
app.post('/api/mfa/confirm', requireAuth, async (req, res) => {
  const { token } = req.body
  const user = await db.users.findById(req.user.id)
  const verified = speakeasy.totp.verify({
    secret: decrypt(user.mfaSecret),
    encoding: 'base32',
    token,
    window: 1,
  })
  if (!verified) return res.status(400).json({ error: 'Invalid MFA code' })
  await db.users.update({ where: { id: user.id }, data: { mfaEnabled: true } })
  res.json({ success: true })
})

// ✅ Step-up middleware for sensitive endpoints
function requireMfaVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user.mfaVerifiedAt) {
    return res.status(403).json({ error: 'MFA verification required', code: 'MFA_REQUIRED' })
  }
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000
  if (req.user.mfaVerifiedAt < tenMinutesAgo) {
    return res.status(403).json({ error: 'MFA session expired', code: 'MFA_EXPIRED' })
  }
  next()
}

app.post('/api/admin/users/:id/delete',
  requireAuth,
  requireRole('admin'),
  requireMfaVerified,  // ✅ requires recent MFA verification
  async (req, res) => {
    await db.users.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  }
)
```

Use TOTP (RFC 6238) as the primary second factor. Provide backup codes. Consider hardware keys (FIDO2/WebAuthn) for admin accounts. Never allow MFA bypass via SMS for high-security contexts (SIM-swap attacks).

Reference: [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
