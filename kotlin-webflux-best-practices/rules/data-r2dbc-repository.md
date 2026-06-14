---
title: Use R2DBC for non-blocking database access instead of JDBC
impact: HIGH
impactDescription: Blocking JDBC calls on the event loop thread cause thread starvation and defeat the purpose of reactive architecture.
tags: r2dbc, database, reactive, jdbc, repository, spring-data
---

## Use R2DBC for non-blocking database access instead of JDBC

**Impact: HIGH**

JDBC is inherently blocking — every database query blocks the calling thread while waiting for the response. In a WebFlux application, using `JpaRepository` or JDBC inside a suspend function blocks the Netty event loop thread, causing thread starvation and degrading performance for all concurrent requests. R2DBC provides fully non-blocking database access that integrates natively with reactive streams and Kotlin coroutines via `CoroutineCrudRepository`.

**Incorrect (Blocking JDBC inside a suspend function):**

```kotlin
// ❌ JpaRepository uses blocking JDBC under the hood
interface UserJpaRepository : JpaRepository<UserEntity, Long>

class UserService(private val userRepository: UserJpaRepository) {

    // ❌ This suspend function blocks the event loop thread!
    suspend fun findActiveUsers(): List<UserEntity> {
        // JpaRepository.findAll() makes a blocking JDBC call
        // The Netty event loop thread is blocked until the query completes
        return userRepository.findAll().filter { it.active }
    }

    suspend fun createUser(request: CreateUserRequest): UserEntity {
        // ❌ Blocking save on event loop thread
        return userRepository.save(UserEntity(name = request.name, email = request.email))
    }
}
```

**Correct (Non-blocking R2DBC with CoroutineCrudRepository):**

```kotlin
import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import org.springframework.data.relational.core.mapping.Table
import org.springframework.data.annotation.Id
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter

// ✅ R2DBC entity with Spring Data annotations
@Table("users")
data class UserEntity(
    @Id val id: Long? = null,
    val name: String,
    val email: String,
    val active: Boolean = true
)

// ✅ CoroutineCrudRepository — all operations are non-blocking suspend functions
interface UserRepository : CoroutineCrudRepository<UserEntity, Long> {
    fun findByActive(active: Boolean): Flow<UserEntity>
    suspend fun findByEmail(email: String): UserEntity?
}

class UserService(private val userRepository: UserRepository) {

    // ✅ Returns Flow<UserEntity> — fully non-blocking, streaming results
    fun findActiveUsers(): Flow<UserEntity> {
        return userRepository.findByActive(active = true)
    }

    // ✅ Suspend function backed by R2DBC — non-blocking database access
    suspend fun createUser(request: CreateUserRequest): UserEntity {
        return userRepository.save(
            UserEntity(name = request.name, email = request.email)
        )
    }

    // ✅ Suspend function for single-result queries
    suspend fun findByEmail(email: String): UserEntity? {
        return userRepository.findByEmail(email)
    }
}
```

Add `spring-boot-starter-data-r2dbc` and the appropriate R2DBC driver (e.g., `r2dbc-postgresql`, `r2dbc-h2`) to your dependencies. Use `CoroutineCrudRepository` for Kotlin-idiomatic suspend functions and `Flow` return types.
