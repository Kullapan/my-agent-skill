# Java Restful Best Practices

> **Version:** 1.0.0

## Table of Contents

1. [Architecture & DTOs](#section-1)
2. [Data Access & JPA](#section-2)
3. [RESTful Constraints](#section-3)

---

## 1. Architecture & DTOs {#section-1}

**Impact:** UNKNOWN

## Centralize exception handling with @RestControllerAdvice

**Impact: HIGH**

Do not use `try/catch` blocks inside every controller method. Let exceptions bubble up and handle them globally using a `@RestControllerAdvice` class. This ensures every error response follows a consistent JSON schema and prevents stack traces from leaking to clients.

**Incorrect (Scattered try-catch):**

```java
// ❌ Repetitive and inconsistent error handling
@GetMapping("/{id}")
public ResponseEntity<?> getUser(@PathVariable Long id) {
    try {
        UserResponse user = userService.findById(id);
        return ResponseEntity.ok(user);
    } catch (NotFoundException e) {
        return ResponseEntity.status(404).body(Map.of("error", "Not Found"));
    } catch (Exception e) {
        // 🚨 Potentially leaks internal exception messages
        return ResponseEntity.status(500).body(e.getMessage());
    }
}
```

**Correct (Global Handler):**

```java
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

// ✅ Define a standard error schema as a Record
public record ApiError(int status, String message, Instant timestamp) {}

// ✅ Centralized Handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError handleNotFound(NotFoundException ex) {
        return new ApiError(404, ex.getMessage(), Instant.now());
    }

    // Fallback for unexpected server errors
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiError handleGenericException(Exception ex) {
        // Log the actual exception for developers
        // logger.error("Unhandled exception", ex);
        
        // Return a generic, safe message to the client
        return new ApiError(500, "An unexpected error occurred", Instant.now());
    }
}

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;
    // constructor omitted

    // ✅ Clean controller, focuses only on the happy path
    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

This keeps controllers clean and strictly adheres to the Single Responsibility Principle.

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

---

## 2. Data Access & JPA {#section-2}

**Impact:** UNKNOWN

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

---

## 3. RESTful Constraints {#section-3}

**Impact:** UNKNOWN

## Implement proper pagination for collection endpoints

**Impact: HIGH**

Endpoints that return lists of resources must always be paginated. A simple `findAll()` on a growing table will eventually bring down the server due to memory exhaustion. Spring Data provides `Pageable` and `Page<T>` out of the box to handle offset-based pagination cleanly.

**Incorrect (Returning full lists):**

```java
// ❌ No pagination - dangerous for large datasets!
@GetMapping
public List<UserResponse> getAllUsers() {
    return userRepository.findAll().stream()
        .map(UserResponse::fromEntity)
        .toList();
}
```

**Correct (Spring Data Pagination):**

```java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

// ...

// ✅ Using Pageable and Page<T>
@GetMapping
public Page<UserResponse> getUsers(
    // ✅ Set safe defaults
    @PageableDefault(size = 20, sort = "createdAt") Pageable pageable 
) {
    // userRepository.findAll(Pageable) returns a Page<User>
    Page<User> userPage = userRepository.findAll(pageable);
    
    // Page<T>.map() easily converts entities to DTOs while preserving pagination metadata
    return userPage.map(UserResponse::fromEntity);
}
```

This endpoint automatically accepts `?page=0&size=20&sort=username,asc` and returns a JSON payload containing the data array along with metadata like `totalElements` and `totalPages`.

---

## Return correct HTTP status codes

**Impact: HIGH**

REST APIs must leverage standard HTTP status codes. `201 Created` should be returned when a resource is created via POST. `204 No Content` for successful DELETES. Avoid returning `200 OK` for everything, and definitely do not return `200 OK` with an error payload inside.

**Incorrect (Ignoring HTTP semantics):**

```java
// ❌ Always returning 200 OK, even for creations or errors
@PostMapping
public UserResponse createUser(@RequestBody UserRequest request) {
    User user = userService.create(request);
    return UserResponse.fromEntity(user); // Default is 200 OK
}

@DeleteMapping("/{id}")
public Map<String, String> deleteUser(@PathVariable Long id) {
    boolean success = userService.delete(id);
    if (!success) {
        // ❌ Returning 200 OK for an error!
        return Map.of("status", "error", "message", "User not found"); 
    }
    return Map.of("status", "success"); // ❌ Should be 204 No Content
}
```

**Correct (Proper HTTP Status Codes):**

```java
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

// ...

@PostMapping
@ResponseStatus(HttpStatus.CREATED) // ✅ 201 Created
public UserResponse createUser(@RequestBody UserRequest request) {
    User user = userService.create(request);
    return UserResponse.fromEntity(user);
}

@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT) // ✅ 204 No Content
public void deleteUser(@PathVariable Long id) {
    userService.delete(id); // If not found, it throws NotFoundException handled by @RestControllerAdvice
}

@PutMapping("/{id}")
public UserResponse updateUser(@PathVariable Long id, @RequestBody UserRequest request) {
    User user = userService.update(id, request);
    return UserResponse.fromEntity(user); // ✅ 200 OK is correct for updates
}
```

Use `@ResponseStatus` on your controller methods to clearly document and enforce the expected status code. If dynamic logic is required, return a `ResponseEntity<T>`.

---
