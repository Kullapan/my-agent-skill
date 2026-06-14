# Sections

## 1. API Design & DTOs (design)

**Impact:** CRITICAL
**Description:** API contracts must be strictly separated from internal database models. Exposing JPA entities directly via REST endpoints leads to accidental data leakage (mass assignment) and tight coupling.

## 2. Kotlin Language Features (kotlin)

**Impact:** HIGH
**Description:** Idiomatic Kotlin reduces boilerplate and runtime errors. Use features like null-safety and extension functions rather than falling back to Java-style `Optional` or static utility classes.

## 3. Error Handling & Validation (error)

**Impact:** HIGH
**Description:** APIs must validate incoming data and return consistent, structured error responses using standard HTTP status codes. Centralized error handling ensures API consistency.
