---
title: Use standard Bean Validation (@Valid) with Kotlin data classes
impact: HIGH
impactDescription: Manual validation leads to duplicated logic, unhandled edge cases, and missing field validations.
tags: kotlin, validation, spring-boot, mvc, rest, bean-validation
---

## Use standard Bean Validation (@Valid) with Kotlin data classes

**Impact: HIGH**

Never manually validate API requests with `if (email == null)` or regex checks inside the controller. Spring Boot provides seamless integration with Hibernate Validator. When using Kotlin data classes, you must use `@field:NotBlank` (or similar) to ensure the validation annotation applies to the backing field, not the constructor parameter.

**Incorrect (Manual validation):**

```kotlin
// ❌ Error-prone manual validation
@PostMapping("/register")
fun registerUser(@RequestBody request: RegisterRequest): ResponseEntity<Any> {
    if (request.email.isBlank() || !request.email.contains("@")) {
        return ResponseEntity.badRequest().body("Invalid email")
    }
    if (request.password.length < 8) {
        return ResponseEntity.badRequest().body("Password too short")
    }
    // Proceed with registration...
}
```

**Correct (Bean Validation):**

```kotlin
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import jakarta.validation.Valid

// ✅ Validation annotations directly on the DTO
// Note the @field: prefix, which is required for data classes in some Spring versions
data class RegisterRequest(
    @field:NotBlank(message = "Email is required")
    @field:Email(message = "Invalid email format")
    val email: String,

    @field:NotBlank
    @field:Size(min = 8, message = "Password must be at least 8 characters")
    val password: String
)

@RestController
@RequestMapping("/users")
class UserController {

    // ✅ Use @Valid to trigger validation automatically
    @PostMapping("/register")
    fun registerUser(@Valid @RequestBody request: RegisterRequest): UserResponse {
        // If validation fails, Spring throws MethodArgumentNotValidException
        // which should be handled globally in @RestControllerAdvice
        return userService.register(request.email, request.password).toResponse()
    }
}
```

Make sure you handle `MethodArgumentNotValidException` in your `@RestControllerAdvice` to extract the field errors and return them cleanly to the client.
