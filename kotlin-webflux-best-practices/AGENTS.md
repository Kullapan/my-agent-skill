# Kotlin Webflux Best Practices

> **Version:** 1.0.0

## Table of Contents

1. [Error Handling](#section-1)
2. [Reactive Core & Threading](#section-2)
3. [Routing & Handlers](#section-3)
4. [Testing Reactive Streams](#section-4)

---

## 1. Error Handling {#section-1}

**Impact:** UNKNOWN

## Handle exceptions globally using AbstractErrorWebExceptionHandler

**Impact: HIGH**

In WebFlux, traditional `@ControllerAdvice` works for annotated controllers, but for functional routing or low-level filter errors, you must use `AbstractErrorWebExceptionHandler`. Without a global handler, exceptions thrown in the reactive pipeline might leak generic HTTP 500s or fail silently.

**Incorrect (Standard try-catch or missing handler):**

```kotlin
// ❌ Try-catch block inside a functional handler leads to repetitive boilerplate
suspend fun getUser(request: ServerRequest): ServerResponse {
    return try {
        val user = userService.findById(request.pathVariable("id"))
        ServerResponse.ok().bodyValueAndAwait(user)
    } catch (e: NotFoundException) {
        ServerResponse.notFound().buildAndAwait()
    } catch (e: Exception) {
        ServerResponse.status(500).buildAndAwait()
    }
}
```

**Correct (Global ErrorWebExceptionHandler):**

```kotlin
import org.springframework.boot.autoconfigure.web.WebProperties
import org.springframework.boot.autoconfigure.web.reactive.error.AbstractErrorWebExceptionHandler
import org.springframework.boot.web.reactive.error.ErrorAttributes
import org.springframework.context.ApplicationContext
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.codec.ServerCodecConfigurer
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.server.*

// ✅ Catches all errors globally across functional routes and filters
@Component
@Order(-2) // Give it priority over the DefaultErrorWebExceptionHandler
class GlobalErrorHandler(
    errorAttributes: ErrorAttributes,
    applicationContext: ApplicationContext,
    serverCodecConfigurer: ServerCodecConfigurer
) : AbstractErrorWebExceptionHandler(
    errorAttributes,
    WebProperties.Resources(),
    applicationContext
) {
    init {
        super.setMessageWriters(serverCodecConfigurer.writers)
        super.setMessageReaders(serverCodecConfigurer.readers)
    }

    override fun getRoutingFunction(errorAttributes: ErrorAttributes): RouterFunction<ServerResponse> {
        return coRouter {
            all { request -> renderErrorResponse(request) }
        }
    }

    private suspend fun renderErrorResponse(request: ServerRequest): ServerResponse {
        val error = getError(request)
        
        val status = when (error) {
            is NotFoundException -> HttpStatus.NOT_FOUND
            is IllegalArgumentException -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }

        return ServerResponse.status(status)
            .bodyValueAndAwait(mapOf("error" to error.message))
    }
}
```

This centralizes error rendering and ensures consistent JSON structures for API clients.

---

## 2. Reactive Core & Threading {#section-2}

**Impact:** UNKNOWN

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

---

## 3. Routing & Handlers {#section-3}

**Impact:** UNKNOWN

## Prefer functional routing over annotations

**Impact: MEDIUM**

While Spring WebFlux supports `@RestController` and `@GetMapping` annotations, Kotlin's Router DSL provides a declarative, programmatic way to define routes. This avoids runtime reflection, provides compile-time type safety, and allows routes to be grouped, composed, and tested independently of the application context.

**Incorrect (Annotation-based routing):**

```kotlin
// ❌ Traditional reflection-based routing
@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {

    @GetMapping("/{id}")
    suspend fun getUser(@PathVariable id: String): User {
        return userService.findById(id)
    }
}
```

**Correct (Functional routing using Kotlin DSL):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.server.coRouter

// ✅ Declarative, composable functional routing
@Configuration
class UserRouterConfiguration {

    @Bean
    fun userRoutes(userHandler: UserHandler) = coRouter {
        "/api/users".nest {
            GET("/{id}", userHandler::getUser)
            POST("/", userHandler::createUser)
        }
    }
}

// Handlers are plain Spring components with suspend functions
@Component
class UserHandler(private val userService: UserService) {

    suspend fun getUser(request: ServerRequest): ServerResponse {
        val id = request.pathVariable("id")
        val user = userService.findById(id)
        return ServerResponse.ok().bodyValueAndAwait(user)
    }
}
```

Functional routes are faster to start up and explicitly separate route definitions from request handling logic.

---

## 4. Testing Reactive Streams {#section-4}

**Impact:** UNKNOWN

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

---
