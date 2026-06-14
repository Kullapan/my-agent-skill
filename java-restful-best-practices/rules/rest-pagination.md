---
title: Implement proper pagination for collection endpoints
impact: HIGH
impactDescription: Returning unpaginated lists can cause OutOfMemory errors and degrade database performance.
tags: rest, api, java, spring-boot, pagination, jpa, collections
---

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
