---
title: Handle WebClient error responses with onStatus
impact: HIGH
impactDescription: Generic WebClientResponseException leaks HTTP details and prevents domain-specific error recovery.
tags: webclient, error-handling, onstatus, reactive
---

## Handle WebClient error responses with onStatus

**Impact: HIGH**

Without explicit error response handling, `WebClient` throws a generic `WebClientResponseException` for all non-2xx status codes. This exposes raw HTTP details (status codes, response bodies) to your business logic, prevents meaningful error recovery, and makes it impossible to distinguish between retryable server errors and permanent client errors. Using `onStatus` lets you map HTTP errors to domain-specific exceptions with actionable context.

**Incorrect (Generic exception on all error responses):**

```kotlin
// ❌ No onStatus — throws generic WebClientResponseException
class InventoryClient(private val webClient: WebClient) {

    suspend fun checkStock(productId: String): StockLevel {
        // 404 and 503 both throw WebClientResponseException
        // Callers can't distinguish "product not found" from "service down"
        return webClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .awaitBody<StockLevel>()
    }
}
```

**Correct (Domain-specific error mapping with onStatus):**

```kotlin
import org.springframework.http.HttpStatusCode
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.awaitBody
import org.springframework.web.reactive.function.client.bodyToMono

// ✅ Map HTTP error codes to domain exceptions using onStatus
class InventoryClient(private val webClient: WebClient) {

    suspend fun checkStock(productId: String): StockLevel {
        return webClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError) { response ->
                response.bodyToMono<ErrorBody>().map { body ->
                    when (response.statusCode().value()) {
                        404 -> ProductNotFoundException("Product $productId not found")
                        409 -> StockConflictException("Concurrent stock update for $productId")
                        else -> InvalidRequestException("Client error: ${body.message}")
                    }
                }
            }
            .onStatus(HttpStatusCode::is5xxServerError) { response ->
                response.bodyToMono<ErrorBody>().map { body ->
                    // Mark as retryable so upstream retry logic can handle it
                    ServiceUnavailableException(
                        "Inventory service error: ${body.message}",
                        retryable = true
                    )
                }
            }
            .awaitBody<StockLevel>()
    }
}

// ✅ Domain exceptions with clear semantics
class ProductNotFoundException(message: String) : RuntimeException(message)
class StockConflictException(message: String) : RuntimeException(message)
class ServiceUnavailableException(
    message: String,
    val retryable: Boolean = false
) : RuntimeException(message)
```

Always map 4xx errors to non-retryable domain exceptions and 5xx errors to retryable exceptions. This enables proper retry strategies and gives callers meaningful error context instead of raw HTTP details.
