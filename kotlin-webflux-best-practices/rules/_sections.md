# Sections

## 1. Reactive Core & Threading (reactive)

**Impact:** CRITICAL
**Description:** WebFlux runs on a small number of event loop threads. Blocking any of these threads grinds the entire application to a halt. Correct use of coroutines, structured concurrency, and backpressure is paramount.

## 2. Routing & Handlers (routing)

**Impact:** HIGH
**Description:** Kotlin's `coRouter` DSL provides type-safe functional routing. Proper input validation at the handler level prevents invalid data from propagating through the reactive pipeline.

## 3. Error Handling (error)

**Impact:** HIGH
**Description:** Exceptions in reactive streams bypass traditional try-catch blocks. Centralized error handling and resilience patterns prevent cascading failures across downstream services.

## 4. Testing Reactive Streams (test)

**Impact:** MEDIUM
**Description:** Testing async code requires specialized tools like StepVerifier, WebTestClient, runTest, and BlockHound to verify behavior and detect accidental blocking.

## 5. WebClient & HTTP (webclient)

**Impact:** HIGH
**Description:** WebClient is the non-blocking HTTP client for WebFlux. Proper configuration of timeouts, connection pools, error handling, and retry strategies prevents resource leaks and cascading failures to downstream services.

## 6. Data Access (data)

**Impact:** HIGH
**Description:** Reactive applications must use non-blocking data access. R2DBC provides reactive database connectivity while maintaining Spring Data's repository abstraction and transaction management.

## 7. Security (security)

**Impact:** HIGH
**Description:** WebFlux requires reactive security configuration. Servlet-based Spring Security classes do not work in a reactive stack and must be replaced with their reactive equivalents.

## 8. Observability (observe)

**Impact:** MEDIUM
**Description:** Distributed tracing and logging context must be explicitly propagated across reactive operator boundaries and coroutine contexts. Without proper configuration, trace IDs and MDC values are lost.
