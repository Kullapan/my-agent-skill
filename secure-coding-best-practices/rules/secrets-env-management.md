---
title: Use a Secrets Manager Instead of Plain Environment Files
impact: CRITICAL
impactDescription: CWE-312 — OWASP A02 Cryptographic Failures
tags: security, secrets, vault, aws-secrets-manager, doppler, environment
---

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
