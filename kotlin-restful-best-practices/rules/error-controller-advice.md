---
title: Centralize exception handling with @RestControllerAdvice
impact: HIGH
impactDescription: Unhandled exceptions leak stack traces. Inconsistent error formats confuse API consumers.
tags: spring-boot, mvc, error-handling, controller-advice, exception-handler
---

## Centralize exception handling with @RestControllerAdvice

**Impact: HIGH**

Do not use `try/catch` blocks inside every controller method. Instead, allow custom exceptions to bubble up and handle them globally using a `@RestControllerAdvice` class. This ensures every error response follows a consistent JSON schema and prevents stack traces from leaking to clients.

**Incorrect (Scattered try-catch):**

```kotlin
// ❌ Repetitive and inconsistent error handling
@GetMapping("/{id}")
fun getUser(@PathVariable id: Long): ResponseEntity<Any> {
    return try {
        val user = userService.findById(id)
        ResponseEntity.ok(user)
    } catch (e: NotFoundException) {
        ResponseEntity.status(404).body(mapOf("error" to "Not Found"))
    } catch (e: Exception) {
        // 🚨 Potentially leaks internal exception messages
        ResponseEntity.status(500).body(e.message)
    }
}
```

**Correct (Global Handler):**

```kotlin
// ✅ Define a standard error schema
data class ApiError(
    val status: Int,
    val message: String,
    val timestamp: Instant = Instant.now()
)

// ✅ Custom Exceptions
class NotFoundException(message: String) : RuntimeException(message)

// ✅ Centralized Handler
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: NotFoundException): ApiError {
        return ApiError(404, ex.message ?: "Resource not found")
    }

    // Fallback for unexpected server errors
    @ExceptionHandler(Exception::class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    fun handleGenericException(ex: Exception): ApiError {
        // Log the actual exception for developers
        logger.error("Unhandled exception", ex)
        // Return a generic, safe message to the client
        return ApiError(500, "An unexpected error occurred")
    }
}

@RestController
@RequestMapping("/users")
class UserController(private val userService: UserService) {

    // ✅ Clean controller, focuses only on the happy path
    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): UserResponse {
        return userService.findById(id).toResponse()
    }
}
```

This keeps controllers clean and strictly adheres to the Single Responsibility Principle.
