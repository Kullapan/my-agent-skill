---
title: Never Hardcode Secrets, API Keys, or Credentials
impact: CRITICAL
impactDescription: CWE-798 — OWASP A02 Cryptographic Failures
tags: security, secrets, credentials, api-keys, environment-variables, hardcoded
---

## Never Hardcode Secrets, API Keys, or Credentials

**Impact: CRITICAL — CWE-798**

Hardcoded secrets are committed to version control and exposed to anyone with repository access — including CI systems, contractors, and if the repo is public, the entire internet. Secrets accidentally committed persist in git history even after deletion. Use environment variables loaded from a secrets manager, never string literals.

**Non-compliant (secrets in source code):**

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

Add `.env` to `.gitignore`. Use `.env.example` with placeholder values for documentation. Rotate any secret that has been committed — treat it as unauthorized accessd immediately.

Reference: [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
