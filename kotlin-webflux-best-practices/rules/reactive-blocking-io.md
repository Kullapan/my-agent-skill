---
title: Isolate blocking I/O calls to Dispatchers.IO
impact: CRITICAL
impactDescription: Event loop starvation. A single blocking call can freeze the entire application.
tags: webflux, non-blocking, coroutines, blocking, dispatchers, thread-pool
---

## Isolate blocking I/O calls to Dispatchers.IO

**Impact: CRITICAL**

WebFlux handles thousands of requests using a small number of event loop threads (Netty worker threads). If you execute a blocking operation (like a JDBC query, synchronous HTTP call, or Thread.sleep) on the event loop, that thread stops processing other requests. If all threads are blocked, the application becomes unresponsive.

**Vulnerable / Incorrect (Blocking the event loop):**

```kotlin
// ❌ Blocking call on the main WebFlux thread!
suspend fun getUserProfile(id: String): Profile {
    // RestTemplate is synchronous and blocking.
    // This blocks the Netty thread, freezing other requests!
    val response = restTemplate.getForObject("http://legacy-api/users/$id", Profile::class.java)
    return response!!
}
```

**Secure / Correct (Offloading to Dispatchers.IO):**

```kotlin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// ✅ Use WebClient (non-blocking) whenever possible
suspend fun getUserProfile(id: String): Profile {
    return webClient.get()
        .uri("http://legacy-api/users/$id")
        .retrieve()
        .awaitBody()
}

// ✅ If you MUST use a blocking library (e.g., JDBC), offload to Dispatchers.IO
suspend fun getUserProfileLegacyDb(id: String): Profile {
    return withContext(Dispatchers.IO) {
        // This runs on a separate thread pool designed for blocking tasks,
        // leaving the Netty event loop free to handle other requests.
        jdbcRepository.findProfileBlocking(id)
    }
}
```

Always use non-blocking libraries (e.g., R2DBC instead of JDBC, `WebClient` instead of `RestTemplate`). Use `BlockHound` in testing to detect accidental blocking calls.
