---
title: Centralize exception handling with @RestControllerAdvice
impact: HIGH
impactDescription: Unhandled exceptions leak stack traces. Inconsistent error formats confuse API consumers.
tags: java, spring-boot, mvc, error-handling, controller-advice, exception-handler
---

## Centralize exception handling with @RestControllerAdvice

**Impact: HIGH**

Do not use `try/catch` blocks inside every controller method. Let exceptions bubble up and handle them globally using a `@RestControllerAdvice` class. This ensures every error response follows a consistent JSON schema and prevents stack traces from leaking to clients.

**Incorrect (Scattered try-catch):**

```java
// ❌ Repetitive and inconsistent error handling
@GetMapping("/{id}")
public ResponseEntity<?> getUser(@PathVariable Long id) {
    try {
        UserResponse user = userService.findById(id);
        return ResponseEntity.ok(user);
    } catch (NotFoundException e) {
        return ResponseEntity.status(404).body(Map.of("error", "Not Found"));
    } catch (Exception e) {
        // 🚨 Potentially leaks internal exception messages
        return ResponseEntity.status(500).body(e.getMessage());
    }
}
```

**Correct (Global Handler):**

```java
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

// ✅ Define a standard error schema as a Record
public record ApiError(int status, String message, Instant timestamp) {}

// ✅ Centralized Handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError handleNotFound(NotFoundException ex) {
        return new ApiError(404, ex.getMessage(), Instant.now());
    }

    // Fallback for unexpected server errors
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiError handleGenericException(Exception ex) {
        // Log the actual exception for developers
        // logger.error("Unhandled exception", ex);
        
        // Return a generic, safe message to the client
        return new ApiError(500, "An unexpected error occurred", Instant.now());
    }
}

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;
    // constructor omitted

    // ✅ Clean controller, focuses only on the happy path
    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

This keeps controllers clean and strictly adheres to the Single Responsibility Principle.
