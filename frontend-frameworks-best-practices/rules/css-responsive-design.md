---
title: Use Tailwind responsive prefixes for mobile-first design
impact: HIGH
impactDescription: Custom media queries mixed with Tailwind create inconsistent breakpoints and fight the utility-first approach.
tags: tailwindcss, css, responsive, mobile-first, breakpoints
---

## Use Tailwind responsive prefixes for mobile-first design

**Impact: HIGH**

Tailwind CSS provides a complete set of responsive breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) that follow a mobile-first methodology. When developers mix hand-written `@media` queries alongside Tailwind utility classes, breakpoints become inconsistent, styles fight each other at different viewport widths, and the codebase loses the predictability that utility-first CSS is designed to provide.

**Incorrect (mixing manual media queries with Tailwind classes):**

```html
<!-- ❌ Custom @media queries fight Tailwind's breakpoint system -->
<style>
  .dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  @media (min-width: 820px) {
    .dashboard-grid {
      flex-direction: row;
      gap: 2rem;
    }
  }
  @media (min-width: 1100px) {
    .dashboard-grid {
      gap: 3rem;
    }
  }
</style>

<div class="dashboard-grid p-4">
  <aside class="w-full bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold">Filters</h2>
    <!-- filter controls -->
  </aside>
  <main class="w-full bg-white rounded-lg shadow p-4">
    <h1 class="text-xl font-bold">Results</h1>
    <!-- result cards -->
  </main>
</div>
```

**Correct (using Tailwind responsive prefixes for mobile-first design):**

```html
<!-- ✅ Mobile-first: base styles for small screens, responsive prefixes for larger ones -->
<div class="flex flex-col gap-4 p-4 md:flex-row md:gap-6 lg:gap-8">
  <aside class="w-full md:w-64 lg:w-72 bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold">Filters</h2>
    <!-- filter controls -->
  </aside>
  <main class="w-full flex-1 bg-white rounded-lg shadow p-4">
    <h1 class="text-xl font-bold lg:text-2xl">Results</h1>
    <!-- result cards -->
  </main>
</div>
```

Tailwind's breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`) are well-tested defaults. Sticking to them keeps the design system consistent and makes responsive behavior immediately readable from the markup.
