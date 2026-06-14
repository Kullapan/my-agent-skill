---
title: Apply circuit breaker and retry patterns for downstream calls
impact: HIGH
impactDescription: Unprotected downstream calls cause cascading failures that bring down the entire system.
tags: resilience4j, circuit-breaker, retry, webflux, fault-tolerance
---

## Apply circuit breaker and retry patterns for downstream calls

**Impact: HIGH**

When a downstream service becomes slow or unavailable, unprotected calls will keep consuming threads, connections, and memory while waiting for timeouts. This cascading failure pattern can quickly bring down your entire application and all services that depend on it. Circuit breakers stop calling failing services to give them time to recover, while retries with backoff handle transient network issues gracefully.

**Incorrect (Bare WebClient call with no resilience):**

```kotlin
// ❌ No error handling — failures cascade to callers, no retry, no circuit breaker
class PaymentClient(private val webClient: WebClient) {

    suspend fun chargePayment(request: PaymentRequest): PaymentResponse {
        // If payment-service is down, this hangs until TCP timeout (30s+)
        // Every request queues up, exhausting connection pool and memory
        return webClient.post()
            .uri("/api/payments/charge")
            .bodyValue(request)
            .retrieve()
            .awaitBody<PaymentResponse>()
    }
}
```

**Correct (Circuit breaker + retry with exponential backoff):**

```kotlin
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.reactor.retry.RetryOperator
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator
import reactor.util.retry.Retry
import java.time.Duration

// ✅ Configure circuit breaker and retry with proper limits
class PaymentClient(private val webClient: WebClient) {

    private val circuitBreaker = CircuitBreaker.of("payment-service",
        CircuitBreakerConfig.custom()
            .failureRateThreshold(50f)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .slidingWindowSize(10)
            .build()
    )

    private val retrySpec = Retry.backoff(3, Duration.ofMillis(500))
        .maxBackoff(Duration.ofSeconds(5))
        .filter { it is ServiceUnavailableException || it is java.net.ConnectException }
        .doBeforeRetry { signal ->
            logger.warn("Retrying payment call, attempt {}", signal.totalRetries() + 1)
        }

    suspend fun chargePayment(request: PaymentRequest): PaymentResponse {
        return webClient.post()
            .uri("/api/payments/charge")
            .bodyValue(request)
            .retrieve()
            .bodyToMono(PaymentResponse::class.java)
            .transform(CircuitBreakerOperator.of(circuitBreaker))
            .retryWhen(retrySpec)
            .timeout(Duration.ofSeconds(10))
            .awaitSingle()
    }
}
```

Always pair circuit breakers with retries: the circuit breaker protects against sustained failures, while retries handle transient blips. Use `filter` to retry only on transient exceptions and always set an outer `timeout`.
