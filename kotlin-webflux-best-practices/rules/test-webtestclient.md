---
title: Use WebTestClient for integration testing of reactive endpoints
impact: MEDIUM
impactDescription: Blocking test clients mask async bugs and produce fragile, slow integration tests.
tags: testing, webtestclient, webflux, integration-test
---

## Use WebTestClient for integration testing of reactive endpoints

**Impact: MEDIUM**

Using `WebClient` with `.block()` or `RestTemplate` in tests defeats the purpose of reactive testing. These blocking approaches mask timing issues, don't validate the reactive pipeline end-to-end, and produce slower, more fragile tests. `WebTestClient` is purpose-built for testing WebFlux endpoints — it provides a fluent assertion API, proper reactive stream verification, and works seamlessly with `@WebFluxTest` auto-configuration.

**Incorrect (Blocking WebClient calls in tests):**

```kotlin
// ❌ Using blocking calls in tests — slow, fragile, hides async bugs
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserControllerTest(@Autowired val webClient: WebClient.Builder) {

    @Test
    fun `should get user by id`() {
        val response = webClient.build()
            .get()
            .uri("http://localhost:$port/api/users/123")
            .retrieve()
            .bodyToMono(UserResponse::class.java)
            .block() // ❌ Blocks the test thread, masks timing issues

        assertThat(response?.name).isEqualTo("Alice")
    }
}
```

**Correct (WebTestClient with fluent assertions):**

```kotlin
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest
import org.springframework.test.web.reactive.server.WebTestClient
import org.springframework.test.web.reactive.server.expectBody

// ✅ Use @WebFluxTest for lightweight, focused integration tests
@WebFluxTest(UserHandler::class)
class UserControllerTest(@Autowired val webTestClient: WebTestClient) {

    @Test
    fun `should get user by id`() {
        webTestClient.get()
            .uri("/api/users/123")
            .exchange()
            .expectStatus().isOk
            .expectBody<UserResponse>()
            .isEqualTo(UserResponse(id = "123", name = "Alice", email = "alice@example.com"))
    }

    @Test
    fun `should return 404 for unknown user`() {
        webTestClient.get()
            .uri("/api/users/unknown")
            .exchange()
            .expectStatus().isNotFound
            .expectBody()
            .jsonPath("$.message").isEqualTo("User not found")
    }

    @Test
    fun `should create user with valid body`() {
        webTestClient.post()
            .uri("/api/users")
            .bodyValue(CreateUserRequest(name = "Bob", email = "bob@test.com", age = 30))
            .exchange()
            .expectStatus().isCreated
            .expectBody<UserResponse>()
            .value { user ->
                assertThat(user.name).isEqualTo("Bob")
                assertThat(user.id).isNotBlank()
            }
    }
}
```

Use `@WebFluxTest` for slice tests that only load the web layer, or `@SpringBootTest` with `WebTestClient` for full integration tests. The fluent API provides clear, readable assertions without blocking.
