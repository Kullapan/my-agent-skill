---
title: Memoize expensive computations and components
impact: MEDIUM
impactDescription: Re-calculating expensive data or re-rendering deep component trees on every state change degrades framerates.
tags: react, vue, performance, memo, usememo, usecallback, rendering
---

## Memoize expensive computations and components

**Impact: MEDIUM**

In React, when a parent component renders, all of its children render by default. If a child component is computationally expensive or renders a massive list, you must memoize it. Similarly, expensive data transformations should be memoized so they only re-run when their dependencies change.

**Incorrect (Re-calculating on every render):**

```jsx
// ❌ Filter runs on every single keystroke in the input!
function SearchableList({ items }) {
  const [query, setQuery] = useState("");

  // O(N) operation running on every render
  const filteredItems = items.filter(item => item.name.includes(query));

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ExpensiveList items={filteredItems} />
    </div>
  );
}
```

**Correct (Memoization):**

```jsx
import { useState, useMemo, memo } from 'react';

// ✅ Memoize the child component so it only re-renders if `items` changes
const ExpensiveList = memo(function ExpensiveList({ items }) {
  // Complex rendering...
});

function SearchableList({ items }) {
  const [query, setQuery] = useState("");

  // ✅ Only re-calculate when `items` or `query` changes
  const filteredItems = useMemo(() => {
    return items.filter(item => item.name.includes(query));
  }, [items, query]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ExpensiveList items={filteredItems} />
    </div>
  );
}
```

Do not overuse `useMemo` or `useCallback` for trivial operations (like simple boolean flips), as the overhead of memoization itself can be worse than a fast re-render. Note: In Vue, computed properties (`computed()`) handle this automatically.
