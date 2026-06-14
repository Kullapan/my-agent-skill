---
title: Use Secure, HttpOnly, SameSite Session Cookies
impact: CRITICAL
impactDescription: CWE-614 — OWASP A07 Identification and Authentication Failures
tags: security, authentication, sessions, cookies, xss, csrf
---

## Use Secure, HttpOnly, SameSite Session Cookies

**Impact: CRITICAL — CWE-614**

Session cookies without `HttpOnly` can be stolen via XSS. Without `Secure`, they travel over plaintext HTTP. Without `SameSite=Strict` or `Lax`, they are sent on cross-site requests enabling CSRF risks. All three attributes are required.

**Non-compliant (missing cookie security attributes):**

```typescript
// ❌ Cookie readable by JavaScript — XSS can steal session
res.cookie('sessionId', token)

// ❌ No Secure flag — sent over HTTP
res.cookie('sessionId', token, { httpOnly: true })

// ❌ No SameSite — CSRF non-compliant
res.cookie('sessionId', token, { httpOnly: true, secure: true })
```

**Secure (all required attributes set):**

```typescript
// ✅ Full session cookie security
res.cookie('sessionId', token, {
  httpOnly: true,            // not accessible via document.cookie
  secure: true,              // only sent over HTTPS
  sameSite: 'strict',        // blocks CSRF entirely for same-origin
  maxAge: 15 * 60 * 1000,   // 15 minutes; use 'session' for browser-session cookies
  path: '/',
})

// ✅ For cross-site APIs (e.g., embedded widgets), use 'none' + secure
res.cookie('sessionId', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',          // required for cross-site; must be secure: true
  maxAge: 15 * 60 * 1000,
})

// ✅ Express session library example
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  },
}))
```

Set `secure: true` in production always. Use `SameSite=Strict` unless you explicitly need cross-site cookie delivery. Rotate session IDs after privilege changes (login, role change).

Reference: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
