---
title: Return correct HTTP status codes
impact: HIGH
impactDescription: APIs that always return 200 OK break HTTP semantics and confuse caching layers and clients.
tags: rest, api, java, spring-boot, http, status-codes
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
