---
title: Use reactive transaction management with R2DBC
impact: HIGH
impactDescription: Blocking JDBC TransactionTemplate stalls event loop threads, and missing transaction management causes data inconsistency.
tags: r2dbc, transactions, reactive, spring-data, transactional
---

## Use reactive transaction management with R2DBC

**Impact: HIGH**

Traditional JDBC transaction management using `TransactionTemplate` or `PlatformTransactionManager` is blocking and incompatible with WebFlux's non-blocking model. Using these in a reactive application blocks event loop threads during the entire transaction scope. R2DBC provides reactive transaction management through `@Transactional` on suspend functions (backed by `R2dbcTransactionManager`) and `TransactionalOperator` for programmatic control, ensuring transactions execute without blocking.

**Incorrect (Blocking JDBC TransactionTemplate in reactive code):**

```kotlin
// ❌ Blocking transaction management — stalls the event loop
class OrderService(
    private val transactionTemplate: TransactionTemplate,
    private val orderRepo: OrderJpaRepository,
    private val inventoryRepo: InventoryJpaRepository
) {
    suspend fun placeOrder(request: OrderRequest): Order {
        // ❌ TransactionTemplate.execute blocks the calling thread
        return transactionTemplate.execute { status ->
            val order = orderRepo.save(Order(item = request.item, qty = request.qty))
            inventoryRepo.decrementStock(request.item, request.qty)
            order
        }!!
    }
}
```

**Correct (Reactive transactions with @Transactional and TransactionalOperator):**

```kotlin
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.reactive.TransactionalOperator
import org.springframework.transaction.reactive.executeAndAwait
import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import kotlinx.coroutines.reactive.awaitSingle

interface OrderRepository : CoroutineCrudRepository<Order, Long>
interface InventoryRepository : CoroutineCrudRepository<Inventory, Long> {
    suspend fun findByItemId(itemId: String): Inventory?
}

// ✅ Option 1: Declarative @Transactional on suspend functions
class OrderService(
    private val orderRepo: OrderRepository,
    private val inventoryRepo: InventoryRepository,
    private val transactionalOperator: TransactionalOperator
) {
    // ✅ @Transactional works on suspend functions with R2dbcTransactionManager
    @Transactional
    suspend fun placeOrder(request: OrderRequest): Order {
        val order = orderRepo.save(Order(item = request.item, qty = request.qty))
        val inventory = inventoryRepo.findByItemId(request.item)
            ?: throw ItemNotFoundException("Item ${request.item} not found")
        inventoryRepo.save(inventory.copy(stock = inventory.stock - request.qty))
        return order
    }

    // ✅ Option 2: Programmatic transactions with TransactionalOperator
    suspend fun placeOrderProgrammatic(request: OrderRequest): Order {
        return transactionalOperator.executeAndAwait { tx ->
            val order = orderRepo.save(Order(item = request.item, qty = request.qty))
            val inventory = inventoryRepo.findByItemId(request.item)
            if (inventory == null || inventory.stock < request.qty) {
                tx.setRollbackOnly()
                throw InsufficientStockException("Not enough stock for ${request.item}")
            }
            inventoryRepo.save(inventory.copy(stock = inventory.stock - request.qty))
            order
        }
    }
}
```

Use `@Transactional` on suspend functions for simple cases — Spring automatically uses `R2dbcTransactionManager`. For finer control (manual rollback, conditional logic), use `TransactionalOperator.executeAndAwait`. Ensure `R2dbcTransactionManager` is configured as a bean in your application context.
