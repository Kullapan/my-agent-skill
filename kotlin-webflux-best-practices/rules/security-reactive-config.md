---
title: Configure Spring Security with reactive SecurityWebFilterChain
impact: HIGH
impactDescription: Servlet-based Spring Security classes fail silently or throw errors in WebFlux applications.
tags: security, webflux, spring-security, authentication, authorization
---

## Configure Spring Security with reactive SecurityWebFilterChain

**Impact: HIGH**

WebFlux uses a completely different security infrastructure than servlet-based Spring MVC. Using `@EnableWebSecurity` with `HttpSecurity` and `SecurityFilterChain` in a WebFlux application will either fail to apply security rules or throw configuration errors at startup. WebFlux requires `@EnableWebFluxSecurity` with `ServerHttpSecurity` and `SecurityWebFilterChain`. Similarly, `SecurityContextHolder` (thread-local) does not work in reactive code — use `ReactiveSecurityContextHolder` instead.

**Incorrect (Servlet-based security config in a WebFlux application):**

```kotlin
// ❌ Servlet-based security — does NOT work in WebFlux!
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        // HttpSecurity is servlet-based and will not apply in WebFlux
        http.authorizeHttpRequests { auth ->
            auth.requestMatchers("/api/public/**").permitAll()
            auth.anyRequest().authenticated()
        }
        return http.build()
    }
}

// ❌ SecurityContextHolder is thread-local — empty in reactive code
suspend fun getCurrentUser(): String {
    val auth = SecurityContextHolder.getContext().authentication
    return auth.name // Returns null — thread-local is not propagated
}
```

**Correct (Reactive security with SecurityWebFilterChain):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.security.core.context.ReactiveSecurityContextHolder
import org.springframework.security.config.web.server.invoke

// ✅ Use @EnableWebFluxSecurity for reactive applications
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            authorizeExchange {
                authorize("/api/public/**", permitAll)
                authorize("/api/health", permitAll)
                authorize("/api/admin/**", hasRole("ADMIN"))
                authorize(anyExchange, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
            }
            csrf { disable() } // Disable for stateless JWT APIs
        }
    }
}

// ✅ Use ReactiveSecurityContextHolder in handlers
class UserHandler {

    suspend fun getCurrentUserProfile(request: ServerRequest): ServerResponse {
        val principal = ReactiveSecurityContextHolder.getContext()
            .awaitSingle()
            .authentication
            .name

        val profile = userService.findByUsername(principal)
        return ServerResponse.ok().bodyValueAndAwait(profile)
    }
}
```

Always use `@EnableWebFluxSecurity` with `ServerHttpSecurity` DSL in WebFlux applications. Access the security context with `ReactiveSecurityContextHolder.getContext()` in reactive handlers, never with the thread-local `SecurityContextHolder`.
