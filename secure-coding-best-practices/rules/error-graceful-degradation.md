---
title: Implement Circuit Breakers and Graceful Degradation
impact: MEDIUM
impactDescription: CWE-754 — OWASP A10 Mishandling of Exceptional Conditions
tags: security, error-handling, circuit-breaker, resilience, graceful-degradation, availability
---

## Implement Circuit Breakers and Graceful Degradation

**Impact: MEDIUM — CWE-754**

When a downstream service fails, applications that retry aggressively without backoff can amplify the failure into a cascading outage — overwhelming the struggling service, exhausting their own connection pools, and becoming unresponsive. A circuit breaker detects repeated failures and "opens" to stop sending requests, returning a fallback response instead. This protects both the downstream service (time to recover) and the calling application (remains responsive).

**Non-compliant (no circuit breaker — cascading failure):**

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
