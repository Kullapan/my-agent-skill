---
title: Collect Only the Data You Actually Need (Data Minimization)
impact: HIGH
impactDescription: CWE-359 — OWASP A04 Insecure Design / GDPR Article 5
tags: security, data-protection, privacy, gdpr, data-minimization, pii
---

## Collect Only the Data You Actually Need (Data Minimization)

**Impact: HIGH — CWE-359**

Every piece of PII you collect is a liability. Data breaches expose what you store. GDPR Article 5 and CCPA require collecting only data that is adequate, relevant, and limited to what is necessary. Unused data fields increase your breach impact, compliance scope, and regulatory risk.

**Non-compliant (over-collection):**

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
