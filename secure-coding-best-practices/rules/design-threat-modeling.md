---
title: Require Threat Models for New Features and Services
impact: HIGH
impactDescription: CWE-1059 — OWASP A06 Insecure Design
tags: security, design, threat-modeling, stride, architecture, abuse-cases
---

## Require Threat Models for New Features and Services

**Impact: HIGH — CWE-1059**

Insecure design cannot be fixed by code review alone — it requires identifying threats before writing code. Without threat modeling, teams discover security flaws in production (or not at all). A lightweight STRIDE-based threat model during design forces explicit thinking about trust boundaries, data flows, and abuse scenarios. This is the primary defense against OWASP A06 "Insecure Design" — the category that captures architectural flaws no amount of secure coding can fix.

**Non-compliant (no threat model — security discovered too late):**

```typescript
// ❌ Feature designed and built without threat analysis
// User story: "As a user, I can share files with other users via a public link"
//
// What the team missed:
//   - No expiry on share links → permanent access even after revocation intent
//   - Sequential share IDs → untrusted client can enumerate all shared files
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
| Untrusted client guesses share IDs | Spoofing | Use UUID v4 (128-bit random), not sequential IDs |
| Revoked link still works | Tampering | Expire links after 7 days, support manual revocation |
| No record of who accessed | Repudiation | Log every access with IP, user-agent, timestamp |
| Shared file leaks metadata | Information Disclosure | Strip internal metadata before serving |
| Mass link creation for exfiltration | Denial of Service | Rate limit: 10 shares/user/hour |
| Link bypasses file permissions | Elevation of Privilege | Verify sharer still has access on every link use |

## Abuse Cases
- Untrusted client creates thousands of share links to exfiltrate entire drive
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
