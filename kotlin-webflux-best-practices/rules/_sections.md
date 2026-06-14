# Sections

## 1. Reactive Core & Threading (reactive)

**Impact:** CRITICAL
**Description:** WebFlux runs on a small number of event loop threads (usually 1 per CPU core). Blocking any of these threads grinds the entire application to a halt. Correct use of Coroutines and thread dispatching is paramount.

## 2. Routing & Handlers (routing)

**Impact:** HIGH
**Description:** Kotlin provides a DSL for functional routing which is often preferred over annotation-based `@RestController` in reactive applications for better composability and type safety.

## 3. Error Handling (error)

**Impact:** HIGH
**Description:** Exceptions in reactive streams bypass traditional try-catch blocks if not handled carefully. Use global error handlers designed for WebFlux.

## 4. Testing Reactive Streams (test)

**Impact:** MEDIUM
**Description:** Testing asynchronous, non-blocking code requires specialized tools like `StepVerifier` and `runTest` to avoid flaky tests and unhandled delayed exceptions.
