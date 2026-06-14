---
title: Use Idempotency Keys for Mutating Endpoints
impact: HIGH
impactDescription: CWE-20 — OWASP A06 Insecure Design
tags: security, api, idempotency, design, duplicate-processing, race-condition
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
