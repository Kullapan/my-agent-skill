---
title: Validate request bodies in functional routes using Bean Validation
impact: HIGH
impactDescription: Unvalidated input propagates invalid data, causing downstream errors and potential security vulnerabilities.
tags: webflux, validation, routing, bean-validation, functional
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
