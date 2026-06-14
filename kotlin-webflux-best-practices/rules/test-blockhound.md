---
title: Use BlockHound to detect accidental blocking calls in tests
impact: MEDIUM
impactDescription: Silent blocking calls on event loop threads cause latency spikes and thread starvation undetectable without instrumentation.
tags: testing, blockhound, blocking, webflux, event-loop
---

## Use BlockHound to detect accidental blocking calls in tests

**Impact: MEDIUM**

Blocking calls on Netty event loop threads are the most common WebFlux performance killer, but they can be invisible — the application still works, just slower under load. Without BlockHound, a `Thread.sleep()`, JDBC call, or synchronous file read on the event loop thread silently degrades performance. BlockHound instruments the JVM to detect and immediately fail on any blocking call made from a non-blocking thread, turning silent performance bugs into loud test failures.

**Incorrect (No blocking detection — silent event loop starvation):**

```kotlin
// ❌ No BlockHound — blocking calls silently degrade performance
@SpringBootTest
class UserServiceTest {

    @Test
    fun `should fetch user profile`() {
        // This test passes even if getUserProfile() accidentally
        // calls Thread.sleep() or uses JDBC on the event loop thread
        val result = runBlocking {
            userService.getUserProfile("123")
        }
        assertThat(result.name).isEqualTo("Alice")
    }
    // Blocking bug ships to production undetected!
}
```

**Correct (BlockHound installed to catch blocking calls):**

```kotlin
import io.projectreactor.tools.agent.BlockHound
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.BeforeAllCallback
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.extension.ExtensionContext

// ✅ Option 1: JUnit extension for automatic BlockHound installation
class BlockHoundExtension : BeforeAllCallback {
    override fun beforeAll(context: ExtensionContext) {
        BlockHound.install()
    }
}

@ExtendWith(BlockHoundExtension::class)
@SpringBootTest
class UserServiceTest {

    @Test
    fun `should fetch user profile without blocking`() {
        // ✅ BlockHound will throw if any blocking call happens
        // on a non-blocking thread (e.g., Netty event loop)
        val result = runBlocking {
            userService.getUserProfile("123")
        }
        assertThat(result.name).isEqualTo("Alice")
    }

    @Test
    fun `should detect accidental blocking`() {
        // If getUserProfile() internally calls Thread.sleep()
        // or uses JDBC, BlockHound throws:
        // reactor.blockhound.BlockingOperationError:
        //   Blocking call! java.lang.Thread.sleep
        assertThrows<BlockingOperationError> {
            // This would fail fast instead of silently degrading
        }
    }
}

// ✅ Option 2: @BeforeAll in a base test class
abstract class ReactiveTestBase {
    companion object {
        @JvmStatic
        @BeforeAll
        fun installBlockHound() {
            BlockHound.install()
        }
    }
}
```

Add `io.projectreactor.tools:blockhound` as a test dependency. Create a shared JUnit extension or base test class to install BlockHound once per test suite. Allow-list known safe blocking calls if needed using `BlockHound.builder().allowBlockingCallsInside(...)`.
