# Frontend Frameworks Best Practices

> **Version:** 1.0.0

## Table of Contents

1. [Component Architecture](#section-1)
2. [TailwindCSS Styling](#section-2)
3. [Performance](#section-3)
4. [State Management](#section-4)

---

## 1. Component Architecture {#section-1}

**Impact:** UNKNOWN

## Keep presentation components pure and stateless

**Impact: CRITICAL**

Separate your components into two categories: **Container (Smart) Components** and **Presentation (Dumb) Components**. Presentation components should only receive data via props and emit events via callbacks. They should not fetch their own data or manage complex global state.

**Incorrect (Mixed concerns):**

```jsx
// ❌ Presentation component fetches its own data and manages complex state
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  if (!user) return <LoadingSpinner />;

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold">{user.name}</h2>
      <button onClick={() => deleteUser(user.id)}>Delete</button>
    </div>
  );
}
```

**Correct (Separation of concerns):**

```jsx
// ✅ Presentation component: pure, testable, and reusable
function UserProfileCard({ user, onDelete }) {
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold">{user.name}</h2>
      <button onClick={() => onDelete(user.id)}>Delete</button>
    </div>
  );
}

// ✅ Container component: handles data fetching and logic
function UserProfileContainer({ userId }) {
  // Use a data fetching library like React Query or SWR
  const { data: user, isLoading } = useUser(userId);
  const deleteMutation = useDeleteUser();

  if (isLoading) return <LoadingSpinner />;

  return (
    <UserProfileCard 
      user={user} 
      onDelete={(id) => deleteMutation.mutate(id)} 
    />
  );
}
```

This pattern makes `UserProfileCard` trivially easy to use in Storybook and unit tests.

---

## 2. TailwindCSS Styling {#section-2}

**Impact:** UNKNOWN

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

---

## 3. Performance {#section-3}

**Impact:** UNKNOWN

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

---

## 4. State Management {#section-4}

**Impact:** UNKNOWN

## Lift state up or use global stores instead of prop drilling

**Impact: HIGH**

When two or more sibling components need access to the same state, move the state to their closest common ancestor (lifting state up). If the state needs to be accessed deeply within the component tree, use Context or a global state manager (Zustand, Pinia, Redux) rather than passing props through intermediate components.

**Incorrect (Prop drilling):**

```jsx
// ❌ Intermediate components are polluted with props they don't need
function App() {
  const [theme, setTheme] = useState("dark");
  return <Layout theme={theme} setTheme={setTheme} />;
}

function Layout({ theme, setTheme }) {
  // Layout doesn't care about theme, it just passes it down
  return <Header theme={theme} setTheme={setTheme} />;
}

function Header({ theme, setTheme }) {
  return <ThemeToggle theme={theme} setTheme={setTheme} />;
}
```

**Correct (Global State / Context):**

```jsx
// ✅ Using a lightweight global store (e.g., Zustand for React)
import { create } from 'zustand';

const useThemeStore = create((set) => ({
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));

function App() {
  return <Layout />;
}

function Layout() {
  // Clean! No props passed down.
  return <Header />;
}

function Header() {
  return <ThemeToggle />;
}

function ThemeToggle() {
  // ✅ Only the component that needs the state accesses it
  const { theme, toggleTheme } = useThemeStore();
  
  return (
    <button onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
}
```

Avoid placing high-frequency updating state (like mouse coordinates) into global context, as it will trigger renders across the entire app.

---
