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
