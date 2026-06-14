---
title: Use StepVerifier and runTest for testing reactive streams
impact: MEDIUM
impactDescription: Improperly testing async code can lead to false positives where tests pass before assertions execute.
tags: testing, reactive, webflux, stepverifier, coroutines, runTest
---

## Use StepVerifier and runTest for testing reactive streams

**Impact: MEDIUM**

Testing asynchronous streams with raw assertions (`assertEquals`) often fails or produces false positives if the test runner completes before the asynchronous work finishes. Reactor's `StepVerifier` handles subscribing and awaiting signals. For coroutines, `runTest` from `kotlinx-coroutines-test` ensures that time is simulated correctly and execution completes.

**Incorrect (Raw testing):**

```kotlin
// ❌ Test might pass because it doesn't wait for the Mono to emit
@Test
fun `test get user`() {
    val result = userService.findById("123")
    // If it's a Mono, this assertion is just checking the Mono object, not its contents!
    assertNotNull(result) 
}

// ❌ Using runBlocking for coroutines can be slow due to real delays
@Test
fun `test with delay`() = runBlocking {
    val result = service.doWorkWithDelay() // Actually waits 5 seconds
    assertEquals("Done", result)
}
```

**Correct (StepVerifier and runTest):**

```kotlin
import kotlinx.coroutines.test.runTest
import reactor.test.StepVerifier

// ✅ For raw Mono/Flux (if interfacing with Java libraries)
@Test
fun `test Mono emission`() {
    val publisher = userService.findByIdReactive("123")
    
    StepVerifier.create(publisher)
        .expectNextMatches { user -> user.name == "Alice" }
        .verifyComplete()
}

// ✅ For Coroutines (suspend functions)
@Test
fun `test suspend function`() = runTest {
    // Virtual time: delays are skipped instantly!
    val result = userService.findByIdSuspend("123") 
    assertEquals("Alice", result.name)
}
```

Use `StepVerifier.withVirtualTime` if testing Reactor delays directly. For pure Kotlin tests, prefer `runTest`.
