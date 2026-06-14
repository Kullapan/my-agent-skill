---
title: Handle exceptions globally using AbstractErrorWebExceptionHandler
impact: HIGH
impactDescription: Unhandled reactive exceptions result in silent failures or generic server errors.
tags: webflux, error-handling, reactive, global-exception-handler
---

## Handle exceptions globally using AbstractErrorWebExceptionHandler

**Impact: HIGH**

In WebFlux, traditional `@ControllerAdvice` works for annotated controllers, but for functional routing or low-level filter errors, you must use `AbstractErrorWebExceptionHandler`. Without a global handler, exceptions thrown in the reactive pipeline might leak generic HTTP 500s or fail silently.

**Incorrect (Standard try-catch or missing handler):**

```kotlin
// ❌ Try-catch block inside a functional handler leads to repetitive boilerplate
suspend fun getUser(request: ServerRequest): ServerResponse {
    return try {
        val user = userService.findById(request.pathVariable("id"))
        ServerResponse.ok().bodyValueAndAwait(user)
    } catch (e: NotFoundException) {
        ServerResponse.notFound().buildAndAwait()
    } catch (e: Exception) {
        ServerResponse.status(500).buildAndAwait()
    }
}
```

**Correct (Global ErrorWebExceptionHandler):**

```kotlin
import org.springframework.boot.autoconfigure.web.WebProperties
import org.springframework.boot.autoconfigure.web.reactive.error.AbstractErrorWebExceptionHandler
import org.springframework.boot.web.reactive.error.ErrorAttributes
import org.springframework.context.ApplicationContext
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.codec.ServerCodecConfigurer
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.server.*

// ✅ Catches all errors globally across functional routes and filters
@Component
@Order(-2) // Give it priority over the DefaultErrorWebExceptionHandler
class GlobalErrorHandler(
    errorAttributes: ErrorAttributes,
    applicationContext: ApplicationContext,
    serverCodecConfigurer: ServerCodecConfigurer
) : AbstractErrorWebExceptionHandler(
    errorAttributes,
    WebProperties.Resources(),
    applicationContext
) {
    init {
        super.setMessageWriters(serverCodecConfigurer.writers)
        super.setMessageReaders(serverCodecConfigurer.readers)
    }

    override fun getRoutingFunction(errorAttributes: ErrorAttributes): RouterFunction<ServerResponse> {
        return coRouter {
            all { request -> renderErrorResponse(request) }
        }
    }

    private suspend fun renderErrorResponse(request: ServerRequest): ServerResponse {
        val error = getError(request)
        
        val status = when (error) {
            is NotFoundException -> HttpStatus.NOT_FOUND
            is IllegalArgumentException -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }

        return ServerResponse.status(status)
            .bodyValueAndAwait(mapOf("error" to error.message))
    }
}
```

This centralizes error rendering and ensures consistent JSON structures for API clients.
