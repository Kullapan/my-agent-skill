---
title: Prevent entity exposure using DTOs and extension functions
impact: CRITICAL
impactDescription: Returning JPA entities directly exposes internal database schemas, relationships, and hidden fields (e.g. passwords, salts).
tags: rest, api, dtos, mapping, security, kotlin, extension-functions
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
