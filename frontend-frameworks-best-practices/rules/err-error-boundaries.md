---
title: Wrap feature sections in error boundaries to prevent full-app crashes
impact: CRITICAL
impactDescription: A single uncaught rendering error in one widget crashes the entire application, losing all user state.
tags: react, vue, error-boundary, error-handling, resilience
---

## Wrap feature sections in error boundaries to prevent full-app crashes

**Impact: CRITICAL**

Without error boundaries, a single rendering error in any component propagates up and unmounts the entire React tree — or crashes the whole Vue app. This means a bug in a non-critical widget like a chart or a sidebar recommendation destroys the user's entire session, including unsaved form data and navigation state. Error boundaries isolate failures so only the broken section shows a fallback while the rest of the app remains fully functional.

**Incorrect (no error boundaries — one crash kills the whole page):**

```tsx
// ❌ If RevenueChart throws during render, the entire dashboard unmounts and the user sees a white screen
function Dashboard() {
  return (
    <main className="dashboard">
      <header>
        <h1>Analytics Dashboard</h1>
      </header>
      <div className="dashboard-grid">
        <RevenueChart />
        <UserActivityFeed />
        <ConversionMetrics />
        <RecentOrdersTable />
      </div>
    </main>
  );
}
```

**Correct (React — each section wrapped in an error boundary):**

```tsx
// ✅ Each section is isolated — a crash in RevenueChart only affects that widget
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="error-panel">
      <p>Something went wrong loading this section.</p>
      <pre className="error-detail">{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function Dashboard() {
  return (
    <main className="dashboard">
      <header>
        <h1>Analytics Dashboard</h1>
      </header>
      <div className="dashboard-grid">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <RevenueChart />
        </ErrorBoundary>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <UserActivityFeed />
        </ErrorBoundary>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ConversionMetrics />
        </ErrorBoundary>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <RecentOrdersTable />
        </ErrorBoundary>
      </div>
    </main>
  );
}
```

**Correct (Vue — using `onErrorCaptured` to isolate failures):**

```vue
<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const error = ref<Error | null>(null);

onErrorCaptured((err: Error) => {
  error.value = err;
  return false; // prevent the error from propagating further
});

function retry() {
  error.value = null;
}
</script>

<template>
  <div v-if="error" role="alert" class="error-panel">
    <p>Something went wrong loading this section.</p>
    <pre class="error-detail">{{ error.message }}</pre>
    <button @click="retry">Try again</button>
  </div>
  <slot v-else />
</template>
```

```vue
<template>
  <main class="dashboard">
    <header><h1>Analytics Dashboard</h1></header>
    <div class="dashboard-grid">
      <ErrorBoundary><RevenueChart /></ErrorBoundary>
      <ErrorBoundary><UserActivityFeed /></ErrorBoundary>
      <ErrorBoundary><ConversionMetrics /></ErrorBoundary>
      <ErrorBoundary><RecentOrdersTable /></ErrorBoundary>
    </div>
  </main>
</template>
```

Wrap each independent feature section — not the entire app — in its own error boundary so failures stay contained and the rest of the application remains usable.
