---
name: frontend-frameworks-best-practices
description: Best practices for modern component-based frontend development using React or Vue, combined with TailwindCSS for utility-first styling. Covers component architecture, state management, CSS organization, accessibility, error handling, TypeScript type safety, forms & validation, performance optimization, and testing.
license: MIT
metadata:
  author: "Frontend Engineering"
  version: "2.0.0"
  tags: [frontend, react, vue, tailwindcss, components, state, css, accessibility, a11y, typescript, error-handling, forms, testing, performance]
---

# Frontend Frameworks Best Practices

Guidelines for developing scalable user interfaces using modern frameworks (React/Vue) and TailwindCSS. These rules aim to prevent component bloat, unmanageable CSS classes, accessibility violations, type-safety gaps, and performance bottlenecks caused by excessive re-renders.

## When to Apply

Apply these rules when:
- Designing new UI components or refactoring existing ones
- Managing application or component state
- Applying TailwindCSS utility classes
- Optimizing rendering performance
- Building accessible user interfaces
- Handling errors and async states
- Typing component props with TypeScript
- Building forms with validation
- Writing component tests

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | Component Architecture | CRITICAL | `comp-` |
| 2 | Accessibility | CRITICAL | `a11y-` |
| 3 | Error Handling | HIGH | `err-` |
| 4 | State Management | HIGH | `state-` |
| 5 | TypeScript & Type Safety | HIGH | `ts-` |
| 6 | TailwindCSS Styling | HIGH | `css-` |
| 7 | Performance | MEDIUM | `perf-` |
| 8 | Forms & Validation | MEDIUM | `form-` |
| 9 | Testing | MEDIUM | `test-` |

## Quick Reference

### 1. Component Architecture (CRITICAL)
- `comp-pure-components` — Keep presentation components pure and stateless
- `comp-single-responsibility` — Keep components focused on a single responsibility
- `comp-composition-over-config` — Prefer composition over configuration for flexible components

### 2. Accessibility (CRITICAL)
- `a11y-semantic-html` — Use semantic HTML elements instead of generic divs and spans
- `a11y-keyboard-focus` — Ensure all interactive elements are keyboard-accessible with visible focus indicators

### 3. Error Handling (HIGH)
- `err-error-boundaries` — Wrap feature sections in error boundaries to prevent full-app crashes
- `err-async-error-handling` — Handle all async states: loading, error, and empty

### 4. State Management (HIGH)
- `state-lift-state` — Lift state up or use global stores instead of excessive prop drilling
- `state-colocation` — Colocate state with the components that use it
- `state-derived-values` — Derive values from state instead of storing redundant copies

### 5. TypeScript & Type Safety (HIGH)
- `ts-strict-props` — Define explicit TypeScript interfaces for all component props
- `ts-discriminated-unions` — Use discriminated unions for component variants instead of boolean props

### 6. TailwindCSS Styling (HIGH)
- `css-tailwind-composition` — Use utility libraries like `clsx` or `tailwind-merge` to handle dynamic classes cleanly
- `css-responsive-design` — Use Tailwind responsive prefixes for mobile-first design

### 7. Performance (MEDIUM)
- `perf-memoize-renders` — Memoize expensive computations and components to prevent unnecessary re-renders
- `perf-lazy-loading` — Lazy-load routes and heavy components to reduce initial bundle size
- `perf-virtualize-lists` — Virtualize long lists instead of rendering all items to the DOM

### 8. Forms & Validation (MEDIUM)
- `form-controlled-inputs` — Use form libraries for complex forms instead of manual state management
- `form-validation-schema` — Define validation schemas separately from components using Zod or Yup

### 9. Testing (MEDIUM)
- `test-user-behavior` — Test user behavior, not implementation details

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/comp-pure-components.md
rules/a11y-semantic-html.md
rules/err-error-boundaries.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
