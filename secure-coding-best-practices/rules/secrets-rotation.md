---
title: Implement and Test Automatic Secret Rotation
impact: HIGH
impactDescription: CWE-798 — OWASP A04 Cryptographic Failures
tags: security, secrets, rotation, credentials, key-management, zero-downtime
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
