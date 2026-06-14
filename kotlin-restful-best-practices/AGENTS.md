# Kotlin Restful Best Practices

> **Version:** 1.0.0

## Table of Contents

1. [API Design & DTOs](#section-1)
2. [Error Handling & Validation](#section-2)
3. [Kotlin Language Features](#section-3)

---

## 1. API Design & DTOs {#section-1}

**Impact:** CRITICAL
**Description:** API contracts must be strictly separated from internal database models. Exposing JPA entities directly via REST endpoints leads to accidental data leakage (mass assignment) and tight coupling.

## Use immutable data classes for all API contracts

**Impact: HIGH**

Kotlin's `data class` is perfectly suited for DTOs (Data Transfer Objects). By declaring all properties as `val` (immutable), you ensure that request objects cannot be accidentally modified downstream, and response objects clearly define their final state.

**Incorrect (Mutable POJO style):**

```kotlin
// ❌ Java-style mutable POJO in Kotlin
class UpdateUserRequest {
    var email: String? = null
    var name: String? = null
    
    // Missing toString(), equals(), hashCode()
}
```

**Correct (Immutable data class):**

```kotlin
// ✅ Immutable data class
data class UpdateUserRequest(
    val email: String,
    val name: String?
)
```

Data classes automatically generate `equals()`, `hashCode()`, `toString()`, and `copy()`. Jackson (via the Kotlin module) can flawlessly deserialize JSON into immutable data classes using the primary constructor.

---

## Prevent entity exposure using DTOs and extension functions

**Impact: CRITICAL**

Never accept or return JPA entities directly in `@RestController` endpoints. Doing so creates tight coupling between your database schema and your public API contract. It also risks "mass assignment" vulnerabilities (where users overwrite internal fields like `isAdmin` or `id`) and data exposure (leaking passwords or hidden relationship data). Use Data Transfer Objects (DTOs) mapped via Kotlin extension functions.

**Vulnerable / Incorrect (Exposing Entities):**

```kotlin
// ❌ Entity used directly in API request and response
@Entity
@Table(name = "users")
class User(
    @Id @GeneratedValue val id: Long? = null,
    var username: String,
    var passwordHash: String, // 🚨 Leaked in response!
    var isAdmin: Boolean = false
)

@RestController
@RequestMapping("/users")
class UserController(private val userRepository: UserRepository) {

    @PostMapping
    fun createUser(@RequestBody user: User): User {
        // 🚨 Mass assignment: User can send {"isAdmin": true}
        return userRepository.save(user)
    }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): User {
        // 🚨 Leaks passwordHash
        return userRepository.findById(id).orElseThrow()
    }
}
```

**Secure / Correct (Using DTOs and Extensions):**

```kotlin
// ✅ Distinct DTOs for Request and Response
data class UserCreateRequest(
    val username: String,
    val plaintextPassword: String // Handled securely, not an entity field
)

data class UserResponse(
    val id: Long,
    val username: String
)

// ✅ Kotlin Extension function for mapping (cleaner than MapStruct for simple cases)
fun User.toResponse() = UserResponse(
    id = this.id ?: throw IllegalStateException("Entity must have ID"),
    username = this.username
)

@RestController
@RequestMapping("/users")
class UserController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {

    @PostMapping
    fun createUser(@RequestBody request: UserCreateRequest): UserResponse {
        val user = User(
            username = request.username,
            passwordHash = passwordEncoder.encode(request.plaintextPassword),
            isAdmin = false // Safe: controlled by server, not client request
        )
        return userRepository.save(user).toResponse()
    }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): UserResponse {
        val user = userRepository.findById(id)
            .orElseThrow { NotFoundException("User not found") }
        return user.toResponse() // ✅ Safe response
    }
}
```

Extension functions (`fun Entity.toDto()`) keep mapping logic cleanly separated without requiring heavy reflection-based mapping libraries.

---

## 2. Error Handling & Validation {#section-2}

**Impact:** HIGH
**Description:** APIs must validate incoming data and return consistent, structured error responses using standard HTTP status codes. Centralized error handling ensures API consistency.

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

---

## 3. Kotlin Language Features {#section-3}

**Impact:** HIGH
**Description:** Idiomatic Kotlin reduces boilerplate and runtime errors. Use features like null-safety and extension functions rather than falling back to Java-style `Optional` or static utility classes.

## Leverage Kotlin's null-safety system for optional API fields

**Impact: HIGH**

Kotlin has built-in null safety (`?`). Avoid using Java's `java.util.Optional` in Kotlin APIs, DTOs, or database repositories. Spring Data and Spring MVC seamlessly support Kotlin's nullable types.

**Incorrect (Java-style Optionals):**

```kotlin
// ❌ Using Optional in DTOs and Repositories
data class UserRequest(
    val email: String,
    val nickname: Optional<String> // ❌ Unidiomatic
)

interface UserRepository : JpaRepository<User, Long> {
    // ❌ Spring Data supports Kotlin nullability, no need for Optional
    fun findByEmail(email: String): Optional<User> 
}
```

**Correct (Idiomatic Kotlin):**

```kotlin
// ✅ Use nullable types (?)
data class UserRequest(
    val email: String,
    val nickname: String? // Nullable field
)

interface UserRepository : JpaRepository<User, Long> {
    // ✅ Returns User if found, null if not
    fun findByEmail(email: String): User? 
}

@RestController
@RequestMapping("/users")
class UserController(private val repo: UserRepository) {
    
    @GetMapping
    fun getUserByEmail(@RequestParam email: String): UserResponse {
        // ✅ Idiomatic null handling (Elvis operator)
        val user = repo.findByEmail(email) 
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
            
        return user.toResponse()
    }
}
```

This drastically simplifies your logic and eliminates `.isPresent()` / `.get()` boilerplate.

---
