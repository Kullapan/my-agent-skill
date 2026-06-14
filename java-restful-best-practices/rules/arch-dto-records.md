---
title: Use Java Records for immutable DTOs
impact: HIGH
impactDescription: Mutable POJOs with getters and setters lead to bloated code and accidental state mutation.
tags: java, records, dtos, spring-boot, api
---

## Use Java Records for immutable DTOs

**Impact: HIGH**

Introduced in Java 14 (standardized in 16), `record` is a special kind of class that acts as a transparent carrier for immutable data. They are perfect for Data Transfer Objects (DTOs) because they automatically generate constructors, getters, `equals()`, `hashCode()`, and `toString()`.

**Incorrect (Verbose mutable POJO):**

```java
// ❌ Boilerplate-heavy and mutable
public class UserRequest {
    private String email;
    private String name;

    public UserRequest() {}

    public UserRequest(String email, String name) {
        this.email = email;
        this.name = name;
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
```

**Correct (Java Record):**

```java
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

// ✅ Concise, immutable, and supports validation annotations
public record UserRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email")
    String email,
    
    String name
) {}
```

Jackson (the default JSON mapper in Spring Boot) supports deserializing directly into Records without requiring a default constructor or setter methods.
