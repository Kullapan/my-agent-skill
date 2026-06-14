---
title: Prevent entity exposure using DTO mapping
impact: CRITICAL
impactDescription: Returning JPA entities directly exposes internal database schemas, relationships, and hidden fields (e.g. passwords).
tags: java, rest, api, dtos, mapping, security, jpa, entities
---

## Prevent entity exposure using DTO mapping

**Impact: CRITICAL**

Never accept or return JPA entities directly in `@RestController` endpoints. Doing so creates tight coupling between your database schema and your public API contract. It also risks "mass assignment" vulnerabilities (where users overwrite internal fields like `isAdmin` or `id`) and data exposure. Use Data Transfer Objects (DTOs) mapped via manual methods or a library like MapStruct.

**Vulnerable / Incorrect (Exposing Entities):**

```java
// ❌ Entity used directly in API request and response
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue private Long id;
    private String username;
    private String passwordHash; // 🚨 Leaked in response!
    private boolean isAdmin = false;
    // getters and setters
}

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserRepository userRepository;

    @PostMapping
    public User createUser(@RequestBody User user) {
        // 🚨 Mass assignment: User can send {"isAdmin": true}
        return userRepository.save(user);
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        // 🚨 Leaks passwordHash
        return userRepository.findById(id).orElseThrow();
    }
}
```

**Secure / Correct (Using DTOs):**

```java
// ✅ Distinct DTOs
public record UserCreateRequest(String username, String plaintextPassword) {}
public record UserResponse(Long id, String username) {
    // ✅ Static factory method for mapping
    public static UserResponse fromEntity(User user) {
        return new UserResponse(user.getId(), user.getUsername());
    }
}

@RestController
@RequestMapping("/users")
public class UserController {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping
    public UserResponse createUser(@RequestBody UserCreateRequest request) {
        User user = new User();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.plaintextPassword()));
        user.setAdmin(false); // Safe: controlled by server

        User savedUser = userRepository.save(user);
        return UserResponse.fromEntity(savedUser);
    }

    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("User not found"));
        return UserResponse.fromEntity(user); // ✅ Safe response
    }
}
```

For complex projects, use `MapStruct` to generate mapping code at compile-time automatically.
