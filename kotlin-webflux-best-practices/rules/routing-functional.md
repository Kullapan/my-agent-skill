---
title: Prefer functional routing over annotations
impact: MEDIUM
impactDescription: Functional routing provides better type safety, immutability, and composability.
tags: kotlin, webflux, routing, functional, dsl
---

## Prefer functional routing over annotations

**Impact: MEDIUM**

While Spring WebFlux supports `@RestController` and `@GetMapping` annotations, Kotlin's Router DSL provides a declarative, programmatic way to define routes. This avoids runtime reflection, provides compile-time type safety, and allows routes to be grouped, composed, and tested independently of the application context.

**Incorrect (Annotation-based routing):**

```kotlin
// ❌ Traditional reflection-based routing
@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {

    @GetMapping("/{id}")
    suspend fun getUser(@PathVariable id: String): User {
        return userService.findById(id)
    }
}
```

**Correct (Functional routing using Kotlin DSL):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.server.coRouter

// ✅ Declarative, composable functional routing
@Configuration
class UserRouterConfiguration {

    @Bean
    fun userRoutes(userHandler: UserHandler) = coRouter {
        "/api/users".nest {
            GET("/{id}", userHandler::getUser)
            POST("/", userHandler::createUser)
        }
    }
}

// Handlers are plain Spring components with suspend functions
@Component
class UserHandler(private val userService: UserService) {

    suspend fun getUser(request: ServerRequest): ServerResponse {
        val id = request.pathVariable("id")
        val user = userService.findById(id)
        return ServerResponse.ok().bodyValueAndAwait(user)
    }
}
```

Functional routes are faster to start up and explicitly separate route definitions from request handling logic.
