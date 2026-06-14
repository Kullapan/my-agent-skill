---
name: kotlin-webflux-best-practices
description: Best practices for building highly scalable, non-blocking APIs using Kotlin and Spring WebFlux. Covers reactive core threading, coroutines, WebClient configuration, R2DBC data access, reactive security, error handling, resilience patterns, observability, and testing.
license: MIT
metadata:
  author: "Backend Engineering"
  version: "2.0.0"
  tags: [kotlin, spring-boot, webflux, reactive, coroutines, non-blocking, webclient, r2dbc, security, resilience, observability, testing]
---

# Kotlin WebFlux Best Practices

Guidelines for developing reactive applications using Spring WebFlux with Kotlin. WebFlux offers excellent performance for I/O-bound applications, but requires strict adherence to non-blocking principles. Kotlin Coroutines provide a significant ergonomic advantage over raw Project Reactor (`Flux`/`Mono`) APIs.

## When to Apply

Apply these rules when:
- Developing Spring Boot 3+ applications with `spring-boot-starter-webflux`
- Writing non-blocking database queries (R2DBC, Reactive MongoDB/Redis)
- Consuming external APIs via `WebClient`
- Handling high-concurrency I/O workloads
- Configuring reactive Spring Security
- Setting up distributed tracing across reactive boundaries
- Writing integration and unit tests for reactive endpoints

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Reactive Core & Threading | CRITICAL | `reactive-` |
| 2 | WebClient & HTTP | HIGH | `webclient-` |
| 3 | Data Access | HIGH | `data-` |
| 4 | Routing & Handlers | HIGH | `routing-` |
| 5 | Error Handling | HIGH | `error-` |
| 6 | Security | HIGH | `security-` |
| 7 | Testing Reactive Streams | MEDIUM | `test-` |
| 8 | Observability | MEDIUM | `observe-` |

## Quick Reference

### 1. Reactive Core & Threading (CRITICAL)
- `reactive-coroutines` — Use Kotlin Coroutines (`suspend`, `Flow`) over raw Reactor types (`Mono`, `Flux`)
- `reactive-blocking-io` — Isolate blocking I/O calls to `Dispatchers.IO` to prevent event loop starvation
- `reactive-context` — Propagate context correctly across coroutine boundaries using ReactorContext
- `reactive-backpressure` — Handle backpressure explicitly for high-throughput reactive streams
- `reactive-structured-concurrency` — Use structured concurrency instead of GlobalScope

### 2. WebClient & HTTP (HIGH)
- `webclient-configuration` — Configure WebClient with timeouts and connection pooling
- `webclient-error-handling` — Handle WebClient error responses with onStatus
- `webclient-retry` — Retry transient failures with exponential backoff

### 3. Data Access (HIGH)
- `data-r2dbc-repository` — Use R2DBC for non-blocking database access instead of JDBC
- `data-transaction-management` — Use reactive transaction management with R2DBC

### 4. Routing & Handlers (HIGH)
- `routing-functional` — Prefer functional routing (`coRouter { }`) over `@RestController` annotations
- `routing-request-validation` — Validate request bodies in functional routes using Bean Validation

### 5. Error Handling (HIGH)
- `error-global-handling` — Handle exceptions globally using `AbstractErrorWebExceptionHandler`
- `error-resilience-patterns` — Apply circuit breaker and retry patterns for downstream calls

### 6. Security (HIGH)
- `security-reactive-config` — Configure Spring Security with reactive SecurityWebFilterChain
- `security-cors-csrf` — Configure CORS and CSRF correctly for reactive APIs

### 7. Testing Reactive Streams (MEDIUM)
- `test-stepverifier` — Use `StepVerifier` and `runTest` for testing reactive endpoints and coroutines
- `test-webtestclient` — Use WebTestClient for integration testing of reactive endpoints
- `test-blockhound` — Use BlockHound to detect accidental blocking calls in tests

### 8. Observability (MEDIUM)
- `observe-context-propagation` — Configure context propagation for distributed tracing across reactive boundaries

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/reactive-blocking-io.md
rules/webclient-configuration.md
rules/security-reactive-config.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
