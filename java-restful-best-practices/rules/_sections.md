# Sections

## 1. Architecture & DTOs (arch)

**Impact:** CRITICAL
**Description:** Clean architecture demands strict boundaries between the web layer and the persistence layer. DTOs (Data Transfer Objects) must be used for all API inputs and outputs. Modern Java (17+) provides Records, which are perfect for this.

## 2. RESTful Constraints (rest)

**Impact:** HIGH
**Description:** APIs must adhere to HTTP semantics. Use correct methods (GET, POST, PUT, DELETE) and return standard status codes (200, 201, 404). Collections should always be paginated.

## 3. Data Access & JPA (data)

**Impact:** HIGH
**Description:** Exposing JPA entities directly via REST endpoints leads to mass assignment vulnerabilities and leaked data. Always map entities to DTOs before responding.
