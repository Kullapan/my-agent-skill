---
title: Use clsx and tailwind-merge to compose Tailwind classes cleanly
impact: HIGH
impactDescription: String concatenation for Tailwind classes leads to unreadable code, specificity conflicts, and broken layouts.
tags: tailwindcss, css, styling, react, vue, clsx, tailwind-merge
---

## Use clsx and tailwind-merge to compose Tailwind classes cleanly

**Impact: HIGH**

Tailwind classes can get very long. When composing conditional classes or passing custom classes via props, simple string concatenation usually fails because Tailwind relies on CSS source order, not class string order. Use `clsx` for conditional logic and `tailwind-merge` to resolve specificity conflicts.

**Incorrect (String concatenation):**

```jsx
// ❌ Hard to read, and custom `className` might not override base classes correctly
function Button({ isPrimary, isDisabled, className }) {
  const baseClasses = "px-4 py-2 rounded font-bold ";
  const primaryClasses = isPrimary ? "bg-blue-500 text-white " : "bg-gray-200 text-black ";
  const disabledClasses = isDisabled ? "opacity-50 cursor-not-allowed " : "";
  
  // If `className` contains `bg-red-500`, it might not override `bg-blue-500`!
  return (
    <button className={baseClasses + primaryClasses + disabledClasses + (className || "")}>
      Click Me
    </button>
  );
}
```

**Correct (clsx + tailwind-merge):**

```jsx
// ✅ Create a reusable utility function (often called 'cn')
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ✅ Clean, conditional, and conflict-free class composition
function Button({ isPrimary, isDisabled, className }) {
  return (
    <button 
      className={cn(
        "px-4 py-2 rounded font-bold", // Base styles
        isPrimary ? "bg-blue-500 text-white" : "bg-gray-200 text-black", // Variants
        isDisabled && "opacity-50 cursor-not-allowed", // Conditional
        className // User overrides (twMerge ensures `bg-red-500` will win here)
      )}
    >
      Click Me
    </button>
  );
}
```

This pattern is the standard used by modern UI libraries like `shadcn/ui`.
