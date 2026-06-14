---
name: kotlin-webflux-best-practices
description: Best practices for building highly scalable, non-blocking APIs using Kotlin and Spring WebFlux. Covers coroutines, functional routing, blocking I/O isolation, and reactive testing.
license: MIT
metadata:
  author: "Backend Engineering"
  version: "1.0.0"
  tags: [kotlin, spring-boot, webflux, reactive, coroutines, non-blocking]
---

# Kotlin WebFlux Best Practices

Guidelines for developing reactive applications using Spring WebFlux with Kotlin. WebFlux offers excellent performance for I/O-bound applications, but requires strict adherence to non-blocking principles. Kotlin Coroutines provide a significant ergonomic advantage over raw Project Reactor (`Flux`/`Mono`) APIs.

## When to Apply

Apply these rules when:
- Developing Spring Boot 3+ applications with `spring-boot-starter-webflux`
- Writing non-blocking database queries (R2DBC, Reactive MongoDB/Redis)
- Consuming external APIs via `WebClient`
- Handling high-concurrency I/O workloads

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Reactive Core & Threading | CRITICAL | `reactive-` |
| 2 | Routing & Handlers | HIGH | `routing-` |
| 3 | Error Handling | HIGH | `error-` |
| 4 | Testing Reactive Streams | MEDIUM | `test-` |

## Quick Reference

### 1. Reactive Core & Threading (CRITICAL)
- `reactive-coroutines` — Use Kotlin Coroutines (`suspend`, `Flow`) over raw Reactor types (`Mono`, `Flux`)
- `reactive-blocking-io` — Isolate blocking I/O calls to `Dispatchers.IO` to prevent event loop starvation
- `reactive-context` — Propagate context correctly across coroutine boundaries using ReactorContext

### 2. Routing & Handlers (HIGH)
- `routing-functional` — Prefer functional routing (`router { }`) over `@RestController` annotations

### 3. Error Handling (HIGH)
- `error-global-handling` — Handle exceptions globally using `AbstractErrorWebExceptionHandler`

### 4. Testing Reactive Streams (MEDIUM)
- `test-stepverifier` — Use `StepVerifier` and `runTest` for testing reactive endpoints and coroutines

## How to Use

Read individual rule files for detailed explanations and code examples. Each rule file contains:
- Why it matters (performance impact and thread starvation risks)
- Vulnerable/Incorrect code examples
- Secure/Correct code examples using modern Kotlin idioms
