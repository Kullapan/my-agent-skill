---
title: Use state and PKCE in OAuth/OIDC Flows
impact: CRITICAL
impactDescription: CWE-352 / CWE-601 — OWASP A01 Broken Access Control
tags: security, authentication, oauth, oidc, pkce, csrf, redirect
---

## Use state and PKCE in OAuth/OIDC Flows

**Impact: CRITICAL — CWE-352 / CWE-601**

OAuth flows without `state` parameter are vulnerable to CSRF attacks that can link an attacker's account to a victim's session. Without PKCE (Proof Key for Code Exchange), authorization codes can be intercepted and exchanged by a malicious app. Both mitigations are required for public clients and SPAs.

**Vulnerable (no state, no PKCE):**

```typescript
// ❌ No state parameter — CSRF attack can link attacker account to victim
const authUrl = `https://provider.com/oauth/authorize
  ?client_id=${CLIENT_ID}
  &redirect_uri=${REDIRECT_URI}
  &response_type=code`
res.redirect(authUrl)

// ❌ Callback accepts any code without verifying state
app.get('/callback', async (req, res) => {
  const { code } = req.query
  const tokens = await exchangeCode(code) // no state check!
})
```

**Secure (state + PKCE):**

```typescript
import crypto from 'crypto'

// ✅ Generate and store state + PKCE verifier
app.get('/auth/login', (req, res) => {
  const state         = crypto.randomBytes(32).toString('hex')
  const codeVerifier  = crypto.randomBytes(64).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  // Store in server-side session (not cookie directly)
  req.session.oauthState        = state
  req.session.oauthCodeVerifier = codeVerifier

  const authUrl = new URL('https://provider.com/oauth/authorize')
  authUrl.searchParams.set('client_id',             CLIENT_ID)
  authUrl.searchParams.set('redirect_uri',          REDIRECT_URI)
  authUrl.searchParams.set('response_type',         'code')
  authUrl.searchParams.set('state',                 state)
  authUrl.searchParams.set('code_challenge',        codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  res.redirect(authUrl.toString())
})

// ✅ Verify state before exchanging code
app.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state — possible CSRF' })
  }
  const tokens = await exchangeCode(code, req.session.oauthCodeVerifier)
  delete req.session.oauthState
  delete req.session.oauthCodeVerifier
  // proceed with tokens
})
```

Always validate redirect URIs against an exact allowlist on the authorization server. Never use wildcard redirect URIs.

Reference: [OWASP OAuth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
