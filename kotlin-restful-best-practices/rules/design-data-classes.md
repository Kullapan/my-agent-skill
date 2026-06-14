---
title: Use immutable data classes for all API contracts
impact: HIGH
impactDescription: Mutable API contracts lead to unexpected side effects, concurrency issues, and unclear data flow.
tags: kotlin, data-classes, immutability, rest, api, dtos
---

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
