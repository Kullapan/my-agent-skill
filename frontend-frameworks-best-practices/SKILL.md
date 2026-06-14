---
name: frontend-frameworks-best-practices
description: Best practices for modern component-based frontend development using React or Vue, combined with TailwindCSS for utility-first styling. Covers component architecture, state management, and CSS organization.
license: MIT
metadata:
  author: "Frontend Engineering"
  version: "1.0.0"
  tags: [frontend, react, vue, tailwindcss, components, state, css]
---

# Frontend Frameworks Best Practices

Guidelines for developing scalable user interfaces using modern frameworks (React/Vue) and TailwindCSS. These rules aim to prevent component bloat, unmanageable CSS classes, and performance bottlenecks caused by excessive re-renders.

## When to Apply

Apply these rules when:
- Designing new UI components
- Managing application or component state
- Applying TailwindCSS utility classes
- Optimizing rendering performance

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Component Architecture | CRITICAL | `comp-` |
| 2 | State Management | HIGH | `state-` |
| 3 | TailwindCSS Styling | HIGH | `css-` |
| 4 | Performance | MEDIUM | `perf-` |

## Quick Reference

### 1. Component Architecture (CRITICAL)
- `comp-pure-components` — Keep presentation components pure and stateless

### 2. State Management (HIGH)
- `state-lift-state` — Lift state up or use global stores instead of excessive prop drilling

### 3. TailwindCSS Styling (HIGH)
- `css-tailwind-composition` — Use utility libraries like `clsx` or `tailwind-merge` to handle dynamic classes cleanly

### 4. Performance (MEDIUM)
- `perf-memoize-renders` — Memoize expensive computations and components to prevent unnecessary re-renders

## How to Use

Read individual rule files for detailed explanations and code examples.
