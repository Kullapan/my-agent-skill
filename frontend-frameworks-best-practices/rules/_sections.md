# Sections

## 1. Component Architecture (comp)

**Impact:** CRITICAL
**Description:** Components should ideally be "pure" functions of their props. Mixing data fetching, complex state mutations, and UI rendering in a single component leads to tightly coupled, hard-to-test code.

## 2. State Management (state)

**Impact:** HIGH
**Description:** State should be kept as close to where it is used as possible. However, when multiple components need the same state, it must be lifted up or moved to a global store (like Zustand, Pinia, or Redux) to avoid prop drilling.

## 3. TailwindCSS Styling (css)

**Impact:** HIGH
**Description:** TailwindCSS is powerful but can result in extremely long `className` strings. Use utility libraries to compose classes conditionally and extract reusable styles where appropriate.

## 4. Performance (perf)

**Impact:** MEDIUM
**Description:** Unnecessary re-renders are the primary cause of frontend performance issues. Memoize expensive calculations and stable component trees.

## 5. Accessibility (a11y)

**Impact:** CRITICAL
**Description:** Accessible interfaces are not optional. Using semantic HTML elements, proper ARIA attributes, and keyboard-navigable controls ensures the application works for all users, including those using screen readers, keyboard-only navigation, and assistive technologies.

## 6. Error Handling (err)

**Impact:** HIGH
**Description:** Uncaught errors in rendering or async operations can crash the entire application. Error boundaries, proper async state handling, and graceful degradation prevent single-point failures and maintain user trust.

## 7. TypeScript & Type Safety (ts)

**Impact:** HIGH
**Description:** TypeScript's value is only realized when types are strict and explicit. Properly typed component props, discriminated unions for variants, and avoiding `any` provide compile-time safety and self-documenting APIs.

## 8. Forms & Validation (form)

**Impact:** MEDIUM
**Description:** Forms are the primary data-entry mechanism in web applications. Using form libraries and schema-based validation reduces boilerplate, ensures consistency, and enables type-safe validation that can be shared between client and server.

## 9. Testing (test)

**Impact:** MEDIUM
**Description:** Tests should verify user-observable behavior, not implementation details. Testing Library's guiding principle — test what the user sees and does — produces resilient tests that survive refactors.
