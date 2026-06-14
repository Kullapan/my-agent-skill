---
title: Configure context propagation for distributed tracing across reactive boundaries
impact: MEDIUM
impactDescription: Trace IDs and MDC values are lost across reactive operators and coroutine boundaries, making logs uncorrelatable.
tags: observability, tracing, micrometer, context-propagation, mdc, opentelemetry
---

## Configure context propagation for distributed tracing across reactive boundaries

**Impact: MEDIUM**

In reactive applications, code execution hops between threads on every operator and coroutine suspension point. Traditional MDC (Mapped Diagnostic Context) and trace context are stored in thread-locals, which means trace IDs, span IDs, and custom log context are silently lost when execution resumes on a different thread. Without explicit context propagation configuration, distributed tracing breaks and logs become impossible to correlate across service boundaries.

**Incorrect (Trace IDs lost across reactive and coroutine boundaries):**

```kotlin
// ❌ MDC values are lost after reactive operators switch threads
class OrderHandler(private val orderService: OrderService) {

    suspend fun createOrder(request: ServerRequest): ServerResponse {
        MDC.put("requestId", request.headers().firstHeader("X-Request-ID"))

        // After this suspend point, MDC is empty — execution resumes on a different thread
        val order = orderService.createOrder(request.awaitBody())

        // ❌ MDC.get("requestId") returns null here!
        logger.info("Order created: ${order.id}") // Log has no requestId
        return ServerResponse.ok().bodyValueAndAwait(order)
    }
}

// Logs show: "Order created: 42" — no trace ID, no request ID
// Impossible to correlate with upstream/downstream service logs
```

**Correct (Automatic context propagation with Micrometer and CopyableThreadContextElement):**

```kotlin
import io.micrometer.context.ContextRegistry
import org.slf4j.MDC
import reactor.core.publisher.Hooks
import kotlinx.coroutines.reactor.ReactorContext
import kotlinx.coroutines.slf4j.MDCContext
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

// ✅ Step 1: Enable automatic context propagation at application startup
@Configuration
class ObservabilityConfig {

    @Bean
    fun contextPropagationInitializer(): Unit {
        // Enables automatic propagation of context across reactive operators
        Hooks.enableAutomaticContextPropagation()
        return Unit
    }
}

// ✅ Step 2: Use MDCContext in coroutines to preserve log context
class OrderHandler(private val orderService: OrderService) {

    suspend fun createOrder(request: ServerRequest): ServerResponse {
        val requestId = request.headers().firstHeader("X-Request-ID") ?: "unknown"

        // ✅ MDCContext propagates MDC values across suspension points
        return withContext(MDCContext(mapOf("requestId" to requestId))) {
            val order = orderService.createOrder(request.awaitBody())

            // ✅ MDC.get("requestId") is available here!
            logger.info("Order created: ${order.id}")
            ServerResponse.ok().bodyValueAndAwait(order)
        }
    }
}

// ✅ Step 3: Configure logback pattern to include trace context
// In logback-spring.xml:
// <pattern>%d{ISO8601} [%thread] [traceId=%X{traceId}] [requestId=%X{requestId}] %-5level %logger - %msg%n</pattern>

// Required dependencies in build.gradle.kts:
// implementation("io.micrometer:context-propagation:1.1.1")
// implementation("org.jetbrains.kotlinx:kotlinx-coroutines-slf4j:1.8.0")
// implementation("io.micrometer:micrometer-tracing-bridge-otel")  // For OpenTelemetry
```

Add `io.micrometer:context-propagation` to your dependencies and call `Hooks.enableAutomaticContextPropagation()` at startup. Use `MDCContext` from `kotlinx-coroutines-slf4j` to propagate MDC values across coroutine boundaries. Configure your tracing bridge (OpenTelemetry or Brave) for end-to-end distributed tracing.
