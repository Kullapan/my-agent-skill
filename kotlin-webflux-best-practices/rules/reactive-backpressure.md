---
title: Handle backpressure explicitly for high-throughput reactive streams
impact: HIGH
impactDescription: Unbounded demand can overwhelm slow subscribers causing OutOfMemoryError or dropped messages.
tags: reactive, backpressure, flow, flux, buffer, drop
---

## Handle backpressure explicitly for high-throughput reactive streams

**Impact: HIGH**

When a fast publisher emits items faster than a subscriber can process them, unbounded demand leads to memory exhaustion or uncontrolled message loss. Without explicit backpressure handling, reactive streams buffer indefinitely in memory, eventually causing `OutOfMemoryError` and application crashes. This is especially dangerous in high-throughput scenarios like event streaming or bulk data processing.

**Incorrect (Unbounded demand overwhelming a slow subscriber):**

```kotlin
// ❌ No backpressure strategy — unbounded buffer grows until OOM
fun streamEvents(): Flux<Event> {
    return Flux.create<Event> { sink ->
        eventSource.onEvent { event ->
            sink.next(event) // Emits as fast as possible
        }
    }
    // No backpressure handling — if the subscriber is slow,
    // items queue up in an unbounded internal buffer
}

fun consumeEvents() {
    streamEvents()
        .subscribe { event ->
            // Slow processing — 100ms per event
            Thread.sleep(100)
            processEvent(event)
        }
}
```

**Correct (Explicit backpressure with buffer limits and drop strategy):**

```kotlin
import reactor.core.publisher.Flux
import reactor.core.publisher.BufferOverflowStrategy
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("BackpressureExample")

// ✅ Flux: Use onBackpressureBuffer with a max size and overflow strategy
fun streamEvents(): Flux<Event> {
    return Flux.create<Event> { sink ->
        eventSource.onEvent { event ->
            sink.next(event)
        }
    }
    .onBackpressureBuffer(1024, { droppedEvent ->
        logger.warn("Backpressure: dropped event id={}", droppedEvent.id)
    }, BufferOverflowStrategy.DROP_OLDEST)
}

// ✅ Alternative: Use onBackpressureDrop for fire-and-forget scenarios
fun streamNonCriticalMetrics(): Flux<Metric> {
    return metricsSource.stream()
        .onBackpressureDrop { metric ->
            logger.debug("Dropped non-critical metric: {}", metric.name)
        }
}

// ✅ Kotlin Flow: Use buffer with bounded capacity
fun streamEventsAsFlow(): Flow<Event> {
    return eventSource.asFlow()
        .buffer(capacity = 256) // Bounded buffer with suspension on overflow
}
```

Choose the backpressure strategy based on your use case: `onBackpressureBuffer` for critical data with bounded limits, `onBackpressureDrop` for non-critical or best-effort streams, and `Flow.buffer(capacity)` for coroutine-based pipelines.
