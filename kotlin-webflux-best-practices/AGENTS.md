# Kotlin Webflux Best Practices

> **Version:** 2.0.0

## Table of Contents

1. [Data Access](#section-1)
2. [Error Handling](#section-2)
3. [Observability](#section-3)
4. [Reactive Core & Threading](#section-4)
5. [Routing & Handlers](#section-5)
6. [Security](#section-6)
7. [Testing Reactive Streams](#section-7)
8. [WebClient & HTTP](#section-8)

---

## 1. Data Access {#section-1}

**Impact:** HIGH
**Description:** Reactive applications must use non-blocking data access. R2DBC provides reactive database connectivity while maintaining Spring Data's repository abstraction and transaction management.

## Use R2DBC for non-blocking database access instead of JDBC

**Impact: HIGH**

JDBC is inherently blocking — every database query blocks the calling thread while waiting for the response. In a WebFlux application, using `JpaRepository` or JDBC inside a suspend function blocks the Netty event loop thread, causing thread starvation and degrading performance for all concurrent requests. R2DBC provides fully non-blocking database access that integrates natively with reactive streams and Kotlin coroutines via `CoroutineCrudRepository`.

**Incorrect (Blocking JDBC inside a suspend function):**

```kotlin
// ❌ JpaRepository uses blocking JDBC under the hood
interface UserJpaRepository : JpaRepository<UserEntity, Long>

class UserService(private val userRepository: UserJpaRepository) {

    // ❌ This suspend function blocks the event loop thread!
    suspend fun findActiveUsers(): List<UserEntity> {
        // JpaRepository.findAll() makes a blocking JDBC call
        // The Netty event loop thread is blocked until the query completes
        return userRepository.findAll().filter { it.active }
    }

    suspend fun createUser(request: CreateUserRequest): UserEntity {
        // ❌ Blocking save on event loop thread
        return userRepository.save(UserEntity(name = request.name, email = request.email))
    }
}
```

**Correct (Non-blocking R2DBC with CoroutineCrudRepository):**

```kotlin
import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import org.springframework.data.relational.core.mapping.Table
import org.springframework.data.annotation.Id
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter

// ✅ R2DBC entity with Spring Data annotations
@Table("users")
data class UserEntity(
    @Id val id: Long? = null,
    val name: String,
    val email: String,
    val active: Boolean = true
)

// ✅ CoroutineCrudRepository — all operations are non-blocking suspend functions
interface UserRepository : CoroutineCrudRepository<UserEntity, Long> {
    fun findByActive(active: Boolean): Flow<UserEntity>
    suspend fun findByEmail(email: String): UserEntity?
}

class UserService(private val userRepository: UserRepository) {

    // ✅ Returns Flow<UserEntity> — fully non-blocking, streaming results
    fun findActiveUsers(): Flow<UserEntity> {
        return userRepository.findByActive(active = true)
    }

    // ✅ Suspend function backed by R2DBC — non-blocking database access
    suspend fun createUser(request: CreateUserRequest): UserEntity {
        return userRepository.save(
            UserEntity(name = request.name, email = request.email)
        )
    }

    // ✅ Suspend function for single-result queries
    suspend fun findByEmail(email: String): UserEntity? {
        return userRepository.findByEmail(email)
    }
}
```

Add `spring-boot-starter-data-r2dbc` and the appropriate R2DBC driver (e.g., `r2dbc-postgresql`, `r2dbc-h2`) to your dependencies. Use `CoroutineCrudRepository` for Kotlin-idiomatic suspend functions and `Flow` return types.

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

---

## 2. Error Handling {#section-2}

**Impact:** HIGH
**Description:** Exceptions in reactive streams bypass traditional try-catch blocks. Centralized error handling and resilience patterns prevent cascading failures across downstream services.

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

## Apply circuit breaker and retry patterns for downstream calls

**Impact: HIGH**

When a downstream service becomes slow or unavailable, unprotected calls will keep consuming threads, connections, and memory while waiting for timeouts. This cascading failure pattern can quickly bring down your entire application and all services that depend on it. Circuit breakers stop calling failing services to give them time to recover, while retries with backoff handle transient network issues gracefully.

**Incorrect (Bare WebClient call with no resilience):**

```kotlin
// ❌ No error handling — failures cascade to callers, no retry, no circuit breaker
class PaymentClient(private val webClient: WebClient) {

    suspend fun chargePayment(request: PaymentRequest): PaymentResponse {
        // If payment-service is down, this hangs until TCP timeout (30s+)
        // Every request queues up, exhausting connection pool and memory
        return webClient.post()
            .uri("/api/payments/charge")
            .bodyValue(request)
            .retrieve()
            .awaitBody<PaymentResponse>()
    }
}
```

**Correct (Circuit breaker + retry with exponential backoff):**

```kotlin
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.reactor.retry.RetryOperator
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator
import reactor.util.retry.Retry
import java.time.Duration

// ✅ Configure circuit breaker and retry with proper limits
class PaymentClient(private val webClient: WebClient) {

    private val circuitBreaker = CircuitBreaker.of("payment-service",
        CircuitBreakerConfig.custom()
            .failureRateThreshold(50f)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .slidingWindowSize(10)
            .build()
    )

    private val retrySpec = Retry.backoff(3, Duration.ofMillis(500))
        .maxBackoff(Duration.ofSeconds(5))
        .filter { it is ServiceUnavailableException || it is java.net.ConnectException }
        .doBeforeRetry { signal ->
            logger.warn("Retrying payment call, attempt {}", signal.totalRetries() + 1)
        }

    suspend fun chargePayment(request: PaymentRequest): PaymentResponse {
        return webClient.post()
            .uri("/api/payments/charge")
            .bodyValue(request)
            .retrieve()
            .bodyToMono(PaymentResponse::class.java)
            .transform(CircuitBreakerOperator.of(circuitBreaker))
            .retryWhen(retrySpec)
            .timeout(Duration.ofSeconds(10))
            .awaitSingle()
    }
}
```

Always pair circuit breakers with retries: the circuit breaker protects against sustained failures, while retries handle transient blips. Use `filter` to retry only on transient exceptions and always set an outer `timeout`.

---

## 3. Observability {#section-3}

**Impact:** MEDIUM
**Description:** Distributed tracing and logging context must be explicitly propagated across reactive operator boundaries and coroutine contexts. Without proper configuration, trace IDs and MDC values are lost.

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

---

## 4. Reactive Core & Threading {#section-4}

**Impact:** CRITICAL
**Description:** WebFlux runs on a small number of event loop threads. Blocking any of these threads grinds the entire application to a halt. Correct use of coroutines, structured concurrency, and backpressure is paramount.

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

---

## 5. Routing & Handlers {#section-5}

**Impact:** HIGH
**Description:** Kotlin's `coRouter` DSL provides type-safe functional routing. Proper input validation at the handler level prevents invalid data from propagating through the reactive pipeline.

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

## Validate request bodies in functional routes using Bean Validation

**Impact: HIGH**

Unlike `@RestController` where `@Valid` triggers automatic validation, functional routes with `coRouter` do not perform Bean Validation automatically. Without explicit validation in handlers, malformed or malicious input passes through unchecked, leading to corrupt data, cryptic downstream errors, and potential injection attacks. Every handler that accepts user input must validate it before processing.

**Incorrect (Handler trusts the body without validation):**

```kotlin
// ❌ No validation — malformed data passes directly to the service layer
fun createUserHandler(request: ServerRequest): ServerResponse {
    val body = request.awaitBody<CreateUserRequest>()
    // body.email could be blank, body.age could be negative
    // No validation happens — invalid data goes straight to the database
    val user = userService.createUser(body)
    return ServerResponse.ok().bodyValueAndAwait(user)
}

data class CreateUserRequest(
    val name: String,    // Could be empty
    val email: String,   // Could be "not-an-email"
    val age: Int         // Could be -5
)
```

**Correct (Explicit Bean Validation in the handler):**

```kotlin
import jakarta.validation.Validator
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import org.springframework.web.server.ServerWebInputException
import org.springframework.web.reactive.function.server.ServerRequest
import org.springframework.web.reactive.function.server.ServerResponse
import org.springframework.web.reactive.function.server.awaitBody
import org.springframework.web.reactive.function.server.bodyValueAndAwait

// ✅ Validated request DTO with Bean Validation annotations
data class CreateUserRequest(
    @field:NotBlank(message = "Name is required")
    val name: String,
    @field:Email(message = "Must be a valid email address")
    @field:NotBlank(message = "Email is required")
    val email: String,
    @field:Min(value = 0, message = "Age must be non-negative")
    val age: Int
)

class UserHandler(private val userService: UserService, private val validator: Validator) {

    // ✅ Validate the body and throw ServerWebInputException on violations
    suspend fun createUser(request: ServerRequest): ServerResponse {
        val body = request.awaitBody<CreateUserRequest>()
        val violations = validator.validate(body)
        if (violations.isNotEmpty()) {
            val errors = violations.joinToString("; ") { "${it.propertyPath}: ${it.message}" }
            throw ServerWebInputException("Validation failed: $errors")
        }
        val user = userService.createUser(body)
        return ServerResponse.ok().bodyValueAndAwait(user)
    }
}
```

Inject `jakarta.validation.Validator` into your handlers and call `validate()` explicitly. Combine this with a global error handler to return consistent 400 responses for validation failures.

---

## 6. Security {#section-6}

**Impact:** HIGH
**Description:** WebFlux requires reactive security configuration. Servlet-based Spring Security classes do not work in a reactive stack and must be replaced with their reactive equivalents.

## Configure CORS and CSRF correctly for reactive APIs

**Impact: MEDIUM**

CORS misconfiguration with `allowedOrigins("*")` combined with `allowCredentials(true)` is rejected by browsers, breaking all cross-origin requests. Meanwhile, CSRF protection (enabled by default) blocks POST/PUT/DELETE requests from stateless API clients that don't send CSRF tokens. Getting these wrong results in mysterious 403 errors and broken frontends. CORS must specify explicit origins when credentials are used, and CSRF should only be disabled for stateless token-based APIs.

**Incorrect (CORS wildcard with credentials + CSRF blocking API calls):**

```kotlin
// ❌ CORS wildcard with credentials — browsers reject this combination
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            cors {
                configurationSource = CorsConfigurationSource {
                    CorsConfiguration().apply {
                        allowedOrigins = listOf("*") // ❌ Wildcard
                        allowCredentials = true       // ❌ Can't use with wildcard!
                        allowedMethods = listOf("*")
                    }
                }
            }
            // ❌ CSRF is enabled by default — blocks POST requests from API clients
            // that don't send CSRF tokens (mobile apps, SPAs with JWT)
        }
    }
}
```

**Correct (Specific CORS origins + CSRF disabled for stateless APIs):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.reactive.CorsConfigurationSource
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource
import org.springframework.security.config.web.server.invoke

@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            cors {
                configurationSource = corsConfigurationSource()
            }
            // ✅ Disable CSRF only for stateless token-based APIs (JWT/OAuth2)
            // CSRF protection is unnecessary when using Bearer tokens because
            // the token itself serves as proof of intent — browsers cannot
            // automatically attach it like they do with cookies.
            csrf { disable() }
            authorizeExchange {
                authorize(anyExchange, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
            }
        }
    }

    // ✅ Specific origins, explicit methods, and credentials support
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val config = CorsConfiguration().apply {
            allowedOrigins = listOf(
                "https://app.example.com",
                "https://admin.example.com"
            )
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type", "X-Request-ID")
            exposedHeaders = listOf("X-Request-ID", "X-Correlation-ID")
            allowCredentials = true
            maxAge = 3600L
        }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/api/**", config)
        }
    }
}
```

Only disable CSRF for truly stateless APIs that use Bearer token authentication. If your API uses session cookies, keep CSRF enabled and configure the `CookieServerCsrfTokenRepository`. Always specify exact origins in CORS configuration instead of wildcards when credentials are required.

---

## Configure Spring Security with reactive SecurityWebFilterChain

**Impact: HIGH**

WebFlux uses a completely different security infrastructure than servlet-based Spring MVC. Using `@EnableWebSecurity` with `HttpSecurity` and `SecurityFilterChain` in a WebFlux application will either fail to apply security rules or throw configuration errors at startup. WebFlux requires `@EnableWebFluxSecurity` with `ServerHttpSecurity` and `SecurityWebFilterChain`. Similarly, `SecurityContextHolder` (thread-local) does not work in reactive code — use `ReactiveSecurityContextHolder` instead.

**Incorrect (Servlet-based security config in a WebFlux application):**

```kotlin
// ❌ Servlet-based security — does NOT work in WebFlux!
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        // HttpSecurity is servlet-based and will not apply in WebFlux
        http.authorizeHttpRequests { auth ->
            auth.requestMatchers("/api/public/**").permitAll()
            auth.anyRequest().authenticated()
        }
        return http.build()
    }
}

// ❌ SecurityContextHolder is thread-local — empty in reactive code
suspend fun getCurrentUser(): String {
    val auth = SecurityContextHolder.getContext().authentication
    return auth.name // Returns null — thread-local is not propagated
}
```

**Correct (Reactive security with SecurityWebFilterChain):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.security.core.context.ReactiveSecurityContextHolder
import org.springframework.security.config.web.server.invoke

// ✅ Use @EnableWebFluxSecurity for reactive applications
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            authorizeExchange {
                authorize("/api/public/**", permitAll)
                authorize("/api/health", permitAll)
                authorize("/api/admin/**", hasRole("ADMIN"))
                authorize(anyExchange, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
            }
            csrf { disable() } // Disable for stateless JWT APIs
        }
    }
}

// ✅ Use ReactiveSecurityContextHolder in handlers
class UserHandler {

    suspend fun getCurrentUserProfile(request: ServerRequest): ServerResponse {
        val principal = ReactiveSecurityContextHolder.getContext()
            .awaitSingle()
            .authentication
            .name

        val profile = userService.findByUsername(principal)
        return ServerResponse.ok().bodyValueAndAwait(profile)
    }
}
```

Always use `@EnableWebFluxSecurity` with `ServerHttpSecurity` DSL in WebFlux applications. Access the security context with `ReactiveSecurityContextHolder.getContext()` in reactive handlers, never with the thread-local `SecurityContextHolder`.

---

## 7. Testing Reactive Streams {#section-7}

**Impact:** MEDIUM
**Description:** Testing async code requires specialized tools like StepVerifier, WebTestClient, runTest, and BlockHound to verify behavior and detect accidental blocking.

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

---

## Use WebTestClient for integration testing of reactive endpoints

**Impact: MEDIUM**

Using `WebClient` with `.block()` or `RestTemplate` in tests defeats the purpose of reactive testing. These blocking approaches mask timing issues, don't validate the reactive pipeline end-to-end, and produce slower, more fragile tests. `WebTestClient` is purpose-built for testing WebFlux endpoints — it provides a fluent assertion API, proper reactive stream verification, and works seamlessly with `@WebFluxTest` auto-configuration.

**Incorrect (Blocking WebClient calls in tests):**

```kotlin
// ❌ Using blocking calls in tests — slow, fragile, hides async bugs
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserControllerTest(@Autowired val webClient: WebClient.Builder) {

    @Test
    fun `should get user by id`() {
        val response = webClient.build()
            .get()
            .uri("http://localhost:$port/api/users/123")
            .retrieve()
            .bodyToMono(UserResponse::class.java)
            .block() // ❌ Blocks the test thread, masks timing issues

        assertThat(response?.name).isEqualTo("Alice")
    }
}
```

**Correct (WebTestClient with fluent assertions):**

```kotlin
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest
import org.springframework.test.web.reactive.server.WebTestClient
import org.springframework.test.web.reactive.server.expectBody

// ✅ Use @WebFluxTest for lightweight, focused integration tests
@WebFluxTest(UserHandler::class)
class UserControllerTest(@Autowired val webTestClient: WebTestClient) {

    @Test
    fun `should get user by id`() {
        webTestClient.get()
            .uri("/api/users/123")
            .exchange()
            .expectStatus().isOk
            .expectBody<UserResponse>()
            .isEqualTo(UserResponse(id = "123", name = "Alice", email = "alice@example.com"))
    }

    @Test
    fun `should return 404 for unknown user`() {
        webTestClient.get()
            .uri("/api/users/unknown")
            .exchange()
            .expectStatus().isNotFound
            .expectBody()
            .jsonPath("$.message").isEqualTo("User not found")
    }

    @Test
    fun `should create user with valid body`() {
        webTestClient.post()
            .uri("/api/users")
            .bodyValue(CreateUserRequest(name = "Bob", email = "bob@test.com", age = 30))
            .exchange()
            .expectStatus().isCreated
            .expectBody<UserResponse>()
            .value { user ->
                assertThat(user.name).isEqualTo("Bob")
                assertThat(user.id).isNotBlank()
            }
    }
}
```

Use `@WebFluxTest` for slice tests that only load the web layer, or `@SpringBootTest` with `WebTestClient` for full integration tests. The fluent API provides clear, readable assertions without blocking.

---

## 8. WebClient & HTTP {#section-8}

**Impact:** HIGH
**Description:** WebClient is the non-blocking HTTP client for WebFlux. Proper configuration of timeouts, connection pools, error handling, and retry strategies prevents resource leaks and cascading failures to downstream services.

## Configure WebClient with timeouts and connection pooling

**Impact: HIGH**

The default `WebClient.create(baseUrl)` has no response timeout, no connection timeout, and uses an unbounded connection pool. When a downstream service becomes unresponsive, requests hang indefinitely, new connections accumulate without limit, and the application's connection pool and memory are exhausted. This leads to cascading failures across all services sharing the same `WebClient` instance. Proper timeout and connection pool configuration is essential for production resilience.

**Incorrect (Default WebClient with no timeouts):**

```kotlin
// ❌ No timeouts or connection limits — hangs forever on slow services
@Configuration
class WebClientConfig {

    @Bean
    fun paymentWebClient(): WebClient {
        // Default: no response timeout, no connect timeout,
        // unbounded connection pool, default 256KB memory buffer
        return WebClient.create("https://payment-service.internal")
    }
}
```

**Correct (Fully configured WebClient with timeouts and connection pooling):**

```kotlin
import io.netty.channel.ChannelOption
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.ExchangeStrategies
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient
import reactor.netty.resources.ConnectionProvider
import java.time.Duration

@Configuration
class WebClientConfig {

    @Bean
    fun paymentWebClient(): WebClient {
        // ✅ Configure connection pool with sensible limits
        val connectionProvider = ConnectionProvider.builder("payment-pool")
            .maxConnections(50)
            .pendingAcquireMaxCount(100)
            .pendingAcquireTimeout(Duration.ofSeconds(5))
            .maxIdleTime(Duration.ofSeconds(30))
            .maxLifeTime(Duration.ofMinutes(5))
            .build()

        // ✅ Configure HTTP client with timeouts
        val httpClient = HttpClient.create(connectionProvider)
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)
            .responseTimeout(Duration.ofSeconds(10))

        // ✅ Set memory buffer limit for large responses
        val exchangeStrategies = ExchangeStrategies.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(2 * 1024 * 1024) } // 2MB
            .build()

        return WebClient.builder()
            .baseUrl("https://payment-service.internal")
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .exchangeStrategies(exchangeStrategies)
            .defaultHeader("Accept", "application/json")
            .build()
    }
}
```

Create separate `WebClient` beans for each downstream service with appropriate timeout values. Always set `maxInMemorySize` to prevent unbounded memory allocation from large response bodies.

---

## Handle WebClient error responses with onStatus

**Impact: HIGH**

Without explicit error response handling, `WebClient` throws a generic `WebClientResponseException` for all non-2xx status codes. This exposes raw HTTP details (status codes, response bodies) to your business logic, prevents meaningful error recovery, and makes it impossible to distinguish between retryable server errors and permanent client errors. Using `onStatus` lets you map HTTP errors to domain-specific exceptions with actionable context.

**Incorrect (Generic exception on all error responses):**

```kotlin
// ❌ No onStatus — throws generic WebClientResponseException
class InventoryClient(private val webClient: WebClient) {

    suspend fun checkStock(productId: String): StockLevel {
        // 404 and 503 both throw WebClientResponseException
        // Callers can't distinguish "product not found" from "service down"
        return webClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .awaitBody<StockLevel>()
    }
}
```

**Correct (Domain-specific error mapping with onStatus):**

```kotlin
import org.springframework.http.HttpStatusCode
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.awaitBody
import org.springframework.web.reactive.function.client.bodyToMono

// ✅ Map HTTP error codes to domain exceptions using onStatus
class InventoryClient(private val webClient: WebClient) {

    suspend fun checkStock(productId: String): StockLevel {
        return webClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError) { response ->
                response.bodyToMono<ErrorBody>().map { body ->
                    when (response.statusCode().value()) {
                        404 -> ProductNotFoundException("Product $productId not found")
                        409 -> StockConflictException("Concurrent stock update for $productId")
                        else -> InvalidRequestException("Client error: ${body.message}")
                    }
                }
            }
            .onStatus(HttpStatusCode::is5xxServerError) { response ->
                response.bodyToMono<ErrorBody>().map { body ->
                    // Mark as retryable so upstream retry logic can handle it
                    ServiceUnavailableException(
                        "Inventory service error: ${body.message}",
                        retryable = true
                    )
                }
            }
            .awaitBody<StockLevel>()
    }
}

// ✅ Domain exceptions with clear semantics
class ProductNotFoundException(message: String) : RuntimeException(message)
class StockConflictException(message: String) : RuntimeException(message)
class ServiceUnavailableException(
    message: String,
    val retryable: Boolean = false
) : RuntimeException(message)
```

Always map 4xx errors to non-retryable domain exceptions and 5xx errors to retryable exceptions. This enables proper retry strategies and gives callers meaningful error context instead of raw HTTP details.

---

## Retry transient failures with exponential backoff

**Impact: MEDIUM**

When transient failures occur (network glitches, temporary service unavailability), immediate retries in a tight loop create a thundering herd effect — all failed requests retry simultaneously, overwhelming the recovering service and making the outage worse. Exponential backoff with jitter spreads retries over time, giving the downstream service a chance to recover. Without filtering, retries on non-transient errors (4xx) waste resources and delay error propagation.

**Incorrect (Immediate retry in a loop):**

```kotlin
// ❌ Immediate retry loop — thundering herd, no backoff, retries on all errors
class CatalogClient(private val webClient: WebClient) {

    suspend fun getProduct(id: String): Product {
        var lastException: Exception? = null
        repeat(3) { attempt ->
            try {
                return webClient.get()
                    .uri("/api/products/{id}", id)
                    .retrieve()
                    .awaitBody<Product>()
            } catch (e: Exception) {
                lastException = e
                // ❌ Retries immediately, even on 404 (not found) or 400 (bad request)
            }
        }
        throw lastException!!
    }
}
```

**Correct (Exponential backoff with jitter and error filtering):**

```kotlin
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import reactor.util.retry.Retry
import java.time.Duration

// ✅ Retry only transient errors with exponential backoff and jitter
class CatalogClient(private val webClient: WebClient) {

    private val retrySpec = Retry.backoff(3, Duration.ofMillis(200))
        .maxBackoff(Duration.ofSeconds(5))
        .jitter(0.5) // Adds randomness to prevent thundering herd
        .filter { throwable ->
            // ✅ Only retry on server errors and connection issues
            when (throwable) {
                is WebClientResponseException.ServiceUnavailable -> true
                is WebClientResponseException.GatewayTimeout -> true
                is java.net.ConnectException -> true
                is java.io.IOException -> true
                else -> false // Don't retry 4xx or unknown errors
            }
        }
        .doBeforeRetry { signal ->
            logger.warn(
                "Retry attempt {} for catalog call, cause: {}",
                signal.totalRetries() + 1,
                signal.failure().message
            )
        }
        .onRetryExhaustedThrow { _, signal ->
            ServiceUnavailableException(
                "Catalog service unavailable after ${signal.totalRetries()} retries",
                signal.failure()
            )
        }

    suspend fun getProduct(id: String): Product {
        return webClient.get()
            .uri("/api/products/{id}", id)
            .retrieve()
            .bodyToMono(Product::class.java)
            .retryWhen(retrySpec)
            .awaitSingle()
    }
}
```

Always filter retries to transient errors only (5xx, connection failures). Use `jitter` to prevent synchronized retry storms. Set `maxBackoff` to cap the maximum delay and `onRetryExhaustedThrow` to provide meaningful error messages after all retries are exhausted.

---
