---
title: Define explicit TypeScript interfaces for all component props
impact: HIGH
impactDescription: Using `any` or inline types for props removes compile-time safety and makes component APIs undiscoverable.
tags: typescript, react, vue, props, type-safety, interfaces
---

## Define explicit TypeScript interfaces for all component props

**Impact: HIGH**

Every component's props should be described by a named, exported TypeScript interface or type alias. This makes the component's public API self-documenting, enables IDE autocompletion for consumers, and catches breaking changes at compile time instead of at runtime.

**Incorrect (untyped or `any` props):**

```tsx
// ❌ Props typed as `any` – no compile-time safety, no autocompletion
function Card({ title, items, onSelect }: any) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <ul>
        {items.map((item: any) => (
          <li key={item.id} onClick={() => onSelect(item)}>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Card;
```

**Correct (named, exported interface):**

```tsx
// ✅ Explicit interface makes the component API discoverable and type-safe
export interface CardItem {
  id: string;
  label: string;
}

export interface CardProps {
  title: string;
  items: CardItem[];
  onSelect: (item: CardItem) => void;
}

function Card({ title, items, onSelect }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id} onClick={() => onSelect(item)}>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Card;
```

Exporting the props interface also lets consumers and test files import it for type-safe test fixtures and wrapper components.
