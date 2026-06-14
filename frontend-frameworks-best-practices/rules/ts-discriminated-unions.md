---
title: Use discriminated unions for component variants instead of boolean props
impact: MEDIUM
impactDescription: Boolean variant props create impossible states and make the type system unable to catch invalid combinations.
tags: typescript, react, vue, discriminated-union, variants, type-safety
---

## Use discriminated unions for component variants instead of boolean props

**Impact: MEDIUM**

When a component supports multiple visual or behavioral variants, representing them as independent boolean props allows impossible states (e.g., a button that is simultaneously "primary" and "danger"). A single `variant` field modeled as a discriminated union makes invalid combinations unrepresentable at the type level and simplifies styling logic.

**Incorrect (multiple boolean variant props):**

```tsx
// ❌ Nothing prevents <Button isPrimary isDanger /> – an impossible state
interface ButtonProps {
  children: React.ReactNode;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isDanger?: boolean;
  onClick: () => void;
}

function Button({ children, isPrimary, isSecondary, isDanger, onClick }: ButtonProps) {
  const className = isPrimary
    ? 'btn-primary'
    : isSecondary
      ? 'btn-secondary'
      : isDanger
        ? 'btn-danger'
        : 'btn-default';

  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}
```

**Correct (discriminated union variant):**

```tsx
// ✅ Only one variant is allowed at a time – impossible states are unrepresentable
interface ButtonProps {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

const variantClassMap: Record<ButtonProps['variant'], string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
};

function Button({ children, variant, onClick }: ButtonProps) {
  return (
    <button className={variantClassMap[variant]} onClick={onClick}>
      {children}
    </button>
  );
}
```

This pattern scales cleanly — adding a new variant is a one-line type change that triggers compile errors everywhere the new case needs handling.
