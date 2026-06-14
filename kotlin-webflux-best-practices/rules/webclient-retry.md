---
title: Retry transient failures with exponential backoff
impact: MEDIUM
impactDescription: Immediate retries create thundering herd effects that amplify downstream failures.
tags: webclient, retry, backoff, resilience, transient-errors
---

## Retry transient failures with exponential backoff

**Impact: MEDIUM**

When transient failures occur (network glitches, temporary service unavailability), immediate retries in a tight loop create a thundering herd effect — all failed requests retry simultaneously, overwhelming the recovering service and making the outage worse. Exponential backoff with jitter spreads retries over time, giving the downstream service a chance to recover. Without filtering, retries on non-transient errors (4xx) waste resources and delay error propagation.

**Incorrect (Immediate retry in a loop):**

```kotlin
// ❌ Immediate retry loop — thundering herd, no backoff, retries on all errors
class CatalogClient(private val webClient: WebClient) {

    suspend fun getProduct(id: String): Product {
        var lastException: Exception? = null
        repeat(3) { attempt ->
            try {
                return webClient.get()
                    .uri("/api/products/{id}", id)
                    .retrieve()
                    .awaitBody<Product>()
            } catch (e: Exception) {
                lastException = e
                // ❌ Retries immediately, even on 404 (not found) or 400 (bad request)
            }
        }
        throw lastException!!
    }
}
```

**Correct (Exponential backoff with jitter and error filtering):**

```kotlin
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import reactor.util.retry.Retry
import java.time.Duration

// ✅ Retry only transient errors with exponential backoff and jitter
class CatalogClient(private val webClient: WebClient) {

    private val retrySpec = Retry.backoff(3, Duration.ofMillis(200))
        .maxBackoff(Duration.ofSeconds(5))
        .jitter(0.5) // Adds randomness to prevent thundering herd
        .filter { throwable ->
            // ✅ Only retry on server errors and connection issues
            when (throwable) {
                is WebClientResponseException.ServiceUnavailable -> true
                is WebClientResponseException.GatewayTimeout -> true
                is java.net.ConnectException -> true
                is java.io.IOException -> true
                else -> false // Don't retry 4xx or unknown errors
            }
        }
        .doBeforeRetry { signal ->
            logger.warn(
                "Retry attempt {} for catalog call, cause: {}",
                signal.totalRetries() + 1,
                signal.failure().message
            )
        }
        .onRetryExhaustedThrow { _, signal ->
            ServiceUnavailableException(
                "Catalog service unavailable after ${signal.totalRetries()} retries",
                signal.failure()
            )
        }

    suspend fun getProduct(id: String): Product {
        return webClient.get()
            .uri("/api/products/{id}", id)
            .retrieve()
            .bodyToMono(Product::class.java)
            .retryWhen(retrySpec)
            .awaitSingle()
    }
}
```

Always filter retries to transient errors only (5xx, connection failures). Use `jitter` to prevent synchronized retry storms. Set `maxBackoff` to cap the maximum delay and `onRetryExhaustedThrow` to provide meaningful error messages after all retries are exhausted.
