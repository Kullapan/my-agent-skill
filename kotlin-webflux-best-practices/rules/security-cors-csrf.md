---
title: Configure CORS and CSRF correctly for reactive APIs
impact: MEDIUM
impactDescription: CORS misconfiguration causes browser errors; incorrect CSRF settings block legitimate API requests.
tags: security, cors, csrf, webflux, api
---

## Configure CORS and CSRF correctly for reactive APIs

**Impact: MEDIUM**

CORS misconfiguration with `allowedOrigins("*")` combined with `allowCredentials(true)` is rejected by browsers, breaking all cross-origin requests. Meanwhile, CSRF protection (enabled by default) blocks POST/PUT/DELETE requests from stateless API clients that don't send CSRF tokens. Getting these wrong results in mysterious 403 errors and broken frontends. CORS must specify explicit origins when credentials are used, and CSRF should only be disabled for stateless token-based APIs.

**Incorrect (CORS wildcard with credentials + CSRF blocking API calls):**

```kotlin
// ❌ CORS wildcard with credentials — browsers reject this combination
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            cors {
                configurationSource = CorsConfigurationSource {
                    CorsConfiguration().apply {
                        allowedOrigins = listOf("*") // ❌ Wildcard
                        allowCredentials = true       // ❌ Can't use with wildcard!
                        allowedMethods = listOf("*")
                    }
                }
            }
            // ❌ CSRF is enabled by default — blocks POST requests from API clients
            // that don't send CSRF tokens (mobile apps, SPAs with JWT)
        }
    }
}
```

**Correct (Specific CORS origins + CSRF disabled for stateless APIs):**

```kotlin
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.reactive.CorsConfigurationSource
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource
import org.springframework.security.config.web.server.invoke

@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http {
            cors {
                configurationSource = corsConfigurationSource()
            }
            // ✅ Disable CSRF only for stateless token-based APIs (JWT/OAuth2)
            // CSRF protection is unnecessary when using Bearer tokens because
            // the token itself serves as proof of intent — browsers cannot
            // automatically attach it like they do with cookies.
            csrf { disable() }
            authorizeExchange {
                authorize(anyExchange, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
            }
        }
    }

    // ✅ Specific origins, explicit methods, and credentials support
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val config = CorsConfiguration().apply {
            allowedOrigins = listOf(
                "https://app.example.com",
                "https://admin.example.com"
            )
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type", "X-Request-ID")
            exposedHeaders = listOf("X-Request-ID", "X-Correlation-ID")
            allowCredentials = true
            maxAge = 3600L
        }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/api/**", config)
        }
    }
}
```

Only disable CSRF for truly stateless APIs that use Bearer token authentication. If your API uses session cookies, keep CSRF enabled and configure the `CookieServerCsrfTokenRepository`. Always specify exact origins in CORS configuration instead of wildcards when credentials are required.
