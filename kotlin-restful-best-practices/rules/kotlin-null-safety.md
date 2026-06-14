---
title: Leverage Kotlin's null-safety system for optional API fields
impact: HIGH
impactDescription: Using Java-style Optionals in Kotlin introduces overhead and breaks idiomatic null-safety.
tags: kotlin, null-safety, optional, rest, api
---

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
