---
title: Lift state up or use global stores instead of prop drilling
impact: HIGH
impactDescription: Passing props through multiple layers of components (prop drilling) makes refactoring difficult and couples intermediate components to data they don't use.
tags: react, vue, state, props, prop-drilling, global-state
---

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
