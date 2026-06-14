---
title: Prevent Server-Side Request Forgery with URL Allowlists
impact: CRITICAL
impactDescription: CWE-918 — OWASP A01 Broken Access Control
tags: security, ssrf, server-side-request-forgery, url-validation, access-control
---

## Prevent Server-Side Request Forgery with URL Allowlists

**Impact: CRITICAL — CWE-918**

Server-Side Request Forgery (SSRF) occurs when an application fetches a URL provided by the user without validating the destination. Attackers exploit this to access internal services (metadata APIs, databases, admin panels), scan private networks, or exfiltrate data through the server. SSRF was OWASP A10 in 2021 and remains a top threat — the 2019 Capital One breach was caused by SSRF targeting the AWS metadata endpoint.

**Vulnerable (unvalidated URL from user input):**

```typescript
// ❌ Fetches any URL the user provides — including internal services
app.post('/api/preview', async (req, res) => {
  const { url } = req.body

  // Attacker sends: url = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
  // → Server fetches AWS IAM credentials and returns them to the attacker

  // Attacker sends: url = "http://10.0.0.5:6379/CONFIG+SET+dir+/var/www/html"
  // → Server sends commands to internal Redis

  const response = await fetch(url)
  const html = await response.text()
  res.json({ preview: html })
})

// ❌ DNS rebinding bypasses hostname checks
// Attacker's DNS returns 1.2.3.4 on first lookup (passes validation)
// then 169.254.169.254 on second lookup (actual fetch hits metadata API)
```

**Secure (URL allowlist with IP validation):**

```typescript
import { URL } from 'url'
import dns from 'dns/promises'
import ipaddr from 'ipaddr.js'

// ✅ Allowlist of permitted domains
const ALLOWED_HOSTS = new Set(['api.example.com', 'cdn.example.com', 'images.example.com'])

// ✅ Block private/internal IP ranges
function isPrivateIP(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip)
    const range = addr.range()
    return ['private', 'loopback', 'linkLocal', 'uniqueLocal', 'unspecified'].includes(range)
  } catch {
    return true  // Block unparseable addresses
  }
}

app.post('/api/preview', async (req, res) => {
  const { url: userUrl } = req.body

  // Step 1: Parse and validate URL scheme
  const parsed = new URL(userUrl)
  if (!['https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only HTTPS URLs are allowed' })
  }

  // Step 2: Check hostname against allowlist
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ error: 'Domain not in allowlist' })
  }

  // Step 3: Resolve DNS and check for private IPs (prevents DNS rebinding)
  const addresses = await dns.resolve4(parsed.hostname)
  if (addresses.some(isPrivateIP)) {
    return res.status(400).json({ error: 'Blocked: target resolves to private IP' })
  }

  // Step 4: Fetch with redirect disabled (prevents redirect to internal URLs)
  const response = await fetch(userUrl, { redirect: 'error' })
  const html = await response.text()
  res.json({ preview: html.substring(0, 10000) })  // Limit response size
})
```

Never allow user-controlled URLs to reach internal networks. Use domain allowlists, resolve DNS before fetching, block private IP ranges, and disable HTTP redirects on server-side HTTP clients.

Reference: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
