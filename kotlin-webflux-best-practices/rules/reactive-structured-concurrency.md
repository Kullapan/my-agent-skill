---
title: Use structured concurrency instead of GlobalScope
impact: HIGH
impactDescription: Leaked coroutines from GlobalScope are never cancelled, causing resource leaks and silent failures.
tags: kotlin, coroutines, globalscope, structured-concurrency, supervisorscope
---

## Use structured concurrency instead of GlobalScope

**Impact: HIGH**

`GlobalScope.launch` creates fire-and-forget coroutines that are not bound to any lifecycle. They cannot be cancelled when a request is aborted or a component shuts down, leading to resource leaks, orphaned background work, and silent failures that are impossible to debug. Structured concurrency ensures all child coroutines are tracked, cancelled on failure, and properly awaited before their parent completes.

**Incorrect (GlobalScope fire-and-forget with leaked coroutines):**

```kotlin
// ❌ GlobalScope coroutines leak — no cancellation, no error propagation
class OrderService(
    private val paymentClient: PaymentClient,
    private val inventoryClient: InventoryClient
) {
    suspend fun placeOrder(order: Order): OrderResult {
        // These coroutines are never cancelled if the request is aborted
        GlobalScope.launch { paymentClient.charge(order) }
        GlobalScope.launch { inventoryClient.reserve(order) }
        // No way to know if payment or inventory failed!
        return OrderResult(status = "ACCEPTED")
    }
}
```

**Correct (Structured concurrency with coroutineScope and supervisorScope):**

```kotlin
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.supervisorScope

class OrderService(
    private val paymentClient: PaymentClient,
    private val inventoryClient: InventoryClient,
    private val notificationService: NotificationService
) {
    // ✅ coroutineScope: all children are cancelled if any one fails
    suspend fun placeOrder(order: Order): OrderResult = coroutineScope {
        val payment = async { paymentClient.charge(order) }
        val inventory = async { inventoryClient.reserve(order) }

        // Both results are awaited; if either fails, the other is cancelled
        OrderResult(
            paymentId = payment.await().id,
            reservationId = inventory.await().id,
            status = "CONFIRMED"
        )
    }

    // ✅ supervisorScope: one child's failure does not cancel siblings
    suspend fun placeOrderWithNotification(order: Order) = supervisorScope {
        val result = async { placeOrder(order) }

        // Notification failure should NOT cancel the order
        val notification = async {
            try {
                notificationService.sendConfirmation(order)
            } catch (e: Exception) {
                logger.warn("Notification failed, order still processed", e)
            }
        }

        result.await()
    }
}
```

Always prefer `coroutineScope` for tasks that must all succeed together, and `supervisorScope` when some child tasks are optional. Never use `GlobalScope` in production application code.
