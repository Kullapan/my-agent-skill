---
title: Use Kotlin Coroutines over raw Reactor types (Mono/Flux)
impact: HIGH
impactDescription: Code complexity, readability, and debugging are severely impacted by callback hell in Reactor.
tags: kotlin, coroutines, webflux, reactor, mono, flux, suspend, flow
---

## Use Kotlin Coroutines over raw Reactor types (Mono/Flux)

**Impact: HIGH**

While Spring WebFlux is built on Project Reactor (`Mono` and `Flux`), Kotlin Coroutines offer a much more imperative and readable programming model. Instead of chaining `.flatMap()` and `.map()`, use `suspend` functions and `Flow`. Spring Boot automatically supports returning `suspend` functions and `Flow` from controllers and router functions.

**Vulnerable / Incorrect (Raw Reactor chains):**

```kotlin
// ❌ Hard to read, susceptible to callback hell and nested flatMaps
@GetMapping("/users/{id}")
fun getUserData(@PathVariable id: String): Mono<UserResponse> {
    return userRepository.findById(id)
        .switchIfEmpty(Mono.error(NotFoundException("User not found")))
        .flatMap { user ->
            preferenceRepository.findByUserId(user.id)
                .map { prefs -> UserResponse(user, prefs) }
        }
}
```

**Secure / Correct (Kotlin Coroutines):**

```kotlin
// ✅ Linear, imperative flow using Coroutines
@GetMapping("/users/{id}")
suspend fun getUserData(@PathVariable id: String): UserResponse {
    // Await non-blocking calls naturally
    val user = userRepository.findById(id) ?: throw NotFoundException("User not found")
    val prefs = preferenceRepository.findByUserId(user.id)
    
    return UserResponse(user, prefs)
}
```

Use `Flow<T>` as the coroutine equivalent to `Flux<T>`. You can easily interop using `.awaitSingle()`, `.asFlow()`, `.asFlux()` if calling legacy Java libraries.
