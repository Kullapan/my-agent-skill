---
title: Configure WebClient with timeouts and connection pooling
impact: HIGH
impactDescription: Default WebClient has no timeouts — calls hang indefinitely on unresponsive services, exhausting connections.
tags: webclient, configuration, timeout, connection-pool, netty
---

## Configure WebClient with timeouts and connection pooling

**Impact: HIGH**

The default `WebClient.create(baseUrl)` has no response timeout, no connection timeout, and uses an unbounded connection pool. When a downstream service becomes unresponsive, requests hang indefinitely, new connections accumulate without limit, and the application's connection pool and memory are exhausted. This leads to cascading failures across all services sharing the same `WebClient` instance. Proper timeout and connection pool configuration is essential for production resilience.

**Incorrect (Default WebClient with no timeouts):**

```kotlin
// ❌ No timeouts or connection limits — hangs forever on slow services
@Configuration
class WebClientConfig {

    @Bean
    fun paymentWebClient(): WebClient {
        // Default: no response timeout, no connect timeout,
        // unbounded connection pool, default 256KB memory buffer
        return WebClient.create("https://payment-service.internal")
    }
}
```

**Correct (Fully configured WebClient with timeouts and connection pooling):**

```kotlin
import io.netty.channel.ChannelOption
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.ExchangeStrategies
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient
import reactor.netty.resources.ConnectionProvider
import java.time.Duration

@Configuration
class WebClientConfig {

    @Bean
    fun paymentWebClient(): WebClient {
        // ✅ Configure connection pool with sensible limits
        val connectionProvider = ConnectionProvider.builder("payment-pool")
            .maxConnections(50)
            .pendingAcquireMaxCount(100)
            .pendingAcquireTimeout(Duration.ofSeconds(5))
            .maxIdleTime(Duration.ofSeconds(30))
            .maxLifeTime(Duration.ofMinutes(5))
            .build()

        // ✅ Configure HTTP client with timeouts
        val httpClient = HttpClient.create(connectionProvider)
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)
            .responseTimeout(Duration.ofSeconds(10))

        // ✅ Set memory buffer limit for large responses
        val exchangeStrategies = ExchangeStrategies.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(2 * 1024 * 1024) } // 2MB
            .build()

        return WebClient.builder()
            .baseUrl("https://payment-service.internal")
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .exchangeStrategies(exchangeStrategies)
            .defaultHeader("Accept", "application/json")
            .build()
    }
}
```

Create separate `WebClient` beans for each downstream service with appropriate timeout values. Always set `maxInMemorySize` to prevent unbounded memory allocation from large response bodies.
