---
title: Propagate context correctly across coroutine boundaries using ReactorContext
impact: HIGH
impactDescription: Losing MDC (Mapped Diagnostic Context) or security context leads to untraceable logs and broken authorization.
tags: context, reactive, coroutines, webflux, mdc, security, tracing
---

## Propagate context correctly across coroutine boundaries using ReactorContext

**Impact: HIGH**

In thread-per-request models (like Spring Web MVC), `ThreadLocal` is used to store security contexts, trace IDs, and MDC. In WebFlux, threads are shared. The context must travel with the reactive stream. When jumping between Reactor (`Mono`/`Flux`) and Coroutines (`suspend`), context is easily lost if not explicitly bridged.

**Incorrect (Using ThreadLocal or ignoring context):**

```kotlin
// ❌ Relying on ThreadLocal in a reactive app
val userId = RequestContextHolder.currentRequestAttributes().getAttribute("userId")

// ❌ Calling a suspend function from a Flux without propagating context
@GetMapping("/items")
fun getItems(): Flux<Item> {
    return itemRepository.findAll()
        .flatMap { item ->
            // Context is lost when bridging Mono -> suspend -> Mono!
            mono { enrichItem(item) } 
        }
}
```

**Correct (Context bridging):**

```kotlin
import kotlinx.coroutines.reactor.ReactorContext
import kotlinx.coroutines.reactor.mono
import kotlinx.coroutines.withContext

// ✅ Reading Reactor context from a Coroutine
suspend fun getCurrentUser(): String {
    // Access the Reactor context from the CoroutineContext
    val reactorContext = currentCoroutineContext()[ReactorContext]?.context
        ?: throw IllegalStateException("No context found")
    return reactorContext.get<String>("userId")
}

// ✅ Explicitly capturing and propagating when bridging Flux -> Coroutine
@GetMapping("/items")
fun getItems(): Flux<Item> {
    return itemRepository.findAll()
        .flatMap { item ->
            mono {
                // The mono {} builder from kotlinx-coroutines-reactor 
                // automatically bridges the Reactor context to CoroutineContext!
                enrichItem(item) 
            }
        }
}
```

If you need MDC for logging, you must define a custom CoroutineContext element to copy the MDC map to the Slf4j MDC, or use Micrometer Tracing which has built-in integration for WebFlux and Coroutines.
