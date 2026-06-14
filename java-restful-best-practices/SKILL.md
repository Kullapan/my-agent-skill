---
name: java-restful-best-practices
description: Best practices for building modern, scalable REST APIs using Java and Spring Boot. Focuses on RESTful constraints, Java Records for DTOs, proper status codes, pagination, and data access.
license: MIT
metadata:
  author: "Backend Engineering"
  version: "1.0.0"
  tags: [java, spring-boot, rest, api, dtos, records, pagination, jpa]
---

# Java RESTful Best Practices

Guidelines for developing REST APIs using Java (17+) and Spring Boot. This skill enforces strict RESTful principles, modern Java language features (like Records), and robust architectural boundaries to prevent data leakage.

## When to Apply

Apply these rules when:
- Designing API endpoints and resource paths
- Mapping between internal JPA entities and public DTOs
- Handling pagination and collection responses
- Returning HTTP status codes

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Architecture & DTOs | CRITICAL | `arch-` |
| 2 | RESTful Constraints | HIGH | `rest-` |
| 3 | Data Access & JPA | HIGH | `data-` |

## Quick Reference

### 1. Architecture & DTOs (CRITICAL)
- `arch-dto-records` — Use Java Records for immutable DTOs
- `arch-controller-advice` — Centralize exception handling with `@RestControllerAdvice`

### 2. RESTful Constraints (HIGH)
- `rest-status-codes` — Return correct HTTP status codes (201 Created, 404 Not Found, etc.)
- `rest-pagination` — Implement proper pagination for collection endpoints

### 3. Data Access & JPA (HIGH)
- `data-entity-exposure` — Prevent JPA entity exposure via DTOs mapping

## How to Use

Read individual rule files for detailed explanations and code examples.
