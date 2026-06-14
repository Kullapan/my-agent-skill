---
title: Lazy-load routes and heavy components to reduce initial bundle size
impact: HIGH
impactDescription: Loading all page components upfront can inflate the initial JavaScript bundle by 2-5x, killing first-load performance.
tags: react, vue, performance, lazy-loading, code-splitting, dynamic-import
---

## Lazy-load routes and heavy components to reduce initial bundle size

**Impact: HIGH**

When every route and heavy component is statically imported at the top of your router or entry file, the bundler has no opportunity to split the code — the user downloads the JavaScript for every page before seeing anything. Using `React.lazy()` with `Suspense` or Vue's `defineAsyncComponent()` lets the bundler create separate chunks that are fetched on demand, dramatically reducing the initial payload.

**Incorrect (statically importing all route components):**

```tsx
// ❌ Every page is bundled into one massive chunk, even if the user never visits most of them
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import AnalyticsReport from "./pages/AnalyticsReport";
import UserSettings from "./pages/UserSettings";
import AdminPanel from "./pages/AdminPanel";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<AnalyticsReport />} />
        <Route path="/settings" element={<UserSettings />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Correct (lazy-loading route components with Suspense):**

```tsx
// ✅ Each page is code-split into its own chunk and loaded on demand
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoadingSpinner from "./components/LoadingSpinner";

const HomePage = lazy(() => import("./pages/HomePage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnalyticsReport = lazy(() => import("./pages/AnalyticsReport"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<AnalyticsReport />} />
          <Route path="/settings" element={<UserSettings />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

For Vue, use `defineAsyncComponent(() => import("./pages/Dashboard.vue"))` or the built-in route-level lazy loading with `component: () => import("./pages/Dashboard.vue")` in Vue Router — the same principle applies.
