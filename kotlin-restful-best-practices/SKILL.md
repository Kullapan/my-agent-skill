---
name: kotlin-restful-best-practices
description: Best practices for building standard Spring Web MVC REST APIs using Kotlin. Focuses on leveraging Kotlin language features like data classes, null safety, and extension functions for clean, robust API design.
license: MIT
metadata:
  author: "Backend Engineering"
  version: "1.0.0"
  tags: [kotlin, spring-boot, rest, mvc, web, dtos, validation]
---

# Kotlin RESTful Best Practices

Guidelines for developing traditional, blocking REST APIs using Spring Boot (`spring-boot-starter-web`) and Kotlin. This skill emphasizes using idiomatic Kotlin to reduce boilerplate, prevent null pointer exceptions, and enforce strict boundaries between API contracts and database entities.

## When to Apply

Apply these rules when:
- Building Spring Boot 3+ applications with traditional Spring Web MVC
- Designing RESTful endpoints and defining DTOs (Data Transfer Objects)
- Handling API validation and error responses
- Mapping between database entities and API responses

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | API Design & DTOs | CRITICAL | `design-` |
| 2 | Kotlin Language Features | HIGH | `kotlin-` |
| 3 | Error Handling & Validation | HIGH | `error-` |

## Quick Reference

### 1. API Design & DTOs (CRITICAL)
- `design-dto-mapping` — Prevent entity exposure by using distinct DTOs and extension functions for mapping
- `design-data-classes` — Use immutable `data class` for all DTOs and API contracts

### 2. Kotlin Language Features (HIGH)
- `kotlin-null-safety` — Leverage Kotlin's null-safety system for optional API fields instead of `Optional<T>`

### 3. Error Handling & Validation (HIGH)
- `error-controller-advice` — Centralize exception handling with `@RestControllerAdvice`
- `error-validation` — Use standard Bean Validation (`@Valid`, `@NotBlank`) with Kotlin data classes

## How to Use

Read individual rule files for detailed explanations and code examples. Each rule file contrasts Java-like, verbose Kotlin with idiomatic, safe Kotlin patterns.
