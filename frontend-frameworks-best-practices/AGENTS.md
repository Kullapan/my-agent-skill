# Frontend Frameworks Best Practices

> **Version:** 2.0.0

## Table of Contents

1. [Accessibility](#section-1)
2. [Component Architecture](#section-2)
3. [TailwindCSS Styling](#section-3)
4. [Error Handling](#section-4)
5. [Forms & Validation](#section-5)
6. [Performance](#section-6)
7. [State Management](#section-7)
8. [Testing](#section-8)
9. [TypeScript & Type Safety](#section-9)

---

## 1. Accessibility {#section-1}

**Impact:** CRITICAL
**Description:** Accessible interfaces are not optional. Using semantic HTML elements, proper ARIA attributes, and keyboard-navigable controls ensures the application works for all users, including those using screen readers, keyboard-only navigation, and assistive technologies.

## Ensure all interactive elements are keyboard-accessible with visible focus indicators

**Impact: HIGH**

Keyboard-only users rely entirely on visible focus indicators to know where they are on a page. Removing `outline` without providing an alternative makes interactive elements invisible during keyboard navigation. Additionally, custom components built from non-focusable elements like `<div>` are completely unreachable via the Tab key unless explicitly made focusable with proper keyboard event handling.

**Incorrect (custom dropdown with no focus support):**

```tsx
// ❌ outline: none removes all focus visibility; div is not focusable via keyboard
function CategoryDropdown({ categories, onSelect }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="dropdown" onClick={() => setIsOpen(!isOpen)}>
      <div className="dropdown-trigger" style={{ outline: "none" }}>
        {selected ?? "Select a category"}
        <ChevronDownIcon />
      </div>
      {isOpen && (
        <div className="dropdown-menu">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="dropdown-item"
              onClick={() => {
                setSelected(cat.name);
                onSelect(cat.id);
                setIsOpen(false);
              }}
            >
              {cat.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Correct (keyboard-accessible dropdown with focus-visible styles):**

```tsx
// ✅ Uses button for trigger, focus-visible for keyboard-only outlines, and full keyboard handling
function CategoryDropdown({ categories, onSelect }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, categories.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      setSelected(categories[activeIndex].name);
      onSelect(categories[activeIndex].id);
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="dropdown" onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected ?? "Select a category"}
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <ul role="listbox" className="dropdown-menu">
          {categories.map((cat, index) => (
            <li
              key={cat.id}
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              className={`dropdown-item ${index === activeIndex ? "active" : ""}`}
              onClick={() => {
                setSelected(cat.name);
                onSelect(cat.id);
                setIsOpen(false);
              }}
            >
              {cat.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

```css
/* ✅ Use :focus-visible to show focus rings only for keyboard navigation, not mouse clicks */
.dropdown-trigger:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}

.dropdown-item:focus-visible {
  outline: 2px solid #4f46e5;
  background-color: #eef2ff;
}
```

Never use `outline: none` without providing an equivalent visual focus indicator via `:focus-visible`. Always ensure custom components support Tab navigation and arrow-key interaction.

---

## Use semantic HTML elements instead of generic divs and spans

**Impact: CRITICAL**

Generic `<div>` and `<span>` elements carry no semantic meaning, making them invisible to assistive technologies like screen readers. When interactive elements are built from divs with click handlers, keyboard users cannot Tab to them and screen readers cannot announce their purpose. Using native HTML elements like `<button>`, `<a>`, `<nav>`, `<main>`, and `<ul>` provides built-in accessibility, keyboard support, and correct ARIA roles for free.

**Incorrect (navigation bar built with generic divs):**

```tsx
// ❌ Divs with onClick handlers are not focusable, have no roles, and break keyboard/screen-reader access
function SiteNavigation() {
  return (
    <div className="nav-bar">
      <div className="nav-logo" onClick={() => navigate("/")}>
        MyApp
      </div>
      <div className="nav-links">
        <div className="nav-item" onClick={() => navigate("/dashboard")}>
          Dashboard
        </div>
        <div className="nav-item" onClick={() => navigate("/projects")}>
          Projects
        </div>
        <div className="nav-item" onClick={() => navigate("/settings")}>
          Settings
        </div>
      </div>
      <div className="nav-item" onClick={() => handleLogout()}>
        Log Out
      </div>
    </div>
  );
}
```

**Correct (navigation bar using semantic elements):**

```tsx
// ✅ Semantic elements provide built-in keyboard access, ARIA roles, and screen-reader announcements
function SiteNavigation() {
  return (
    <nav aria-label="Main navigation">
      <a href="/" className="nav-logo">
        MyApp
      </a>
      <ul className="nav-links">
        <li>
          <a href="/dashboard">Dashboard</a>
        </li>
        <li>
          <a href="/projects">Projects</a>
        </li>
        <li>
          <a href="/settings">Settings</a>
        </li>
      </ul>
      <button type="button" onClick={handleLogout} className="nav-logout">
        Log Out
      </button>
    </nav>
  );
}
```

Use `<button>` for actions, `<a>` for navigation, and landmark elements (`<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`) to give assistive technologies a clear map of your page.

---

## 2. Component Architecture {#section-2}

**Impact:** CRITICAL
**Description:** Components should ideally be "pure" functions of their props. Mixing data fetching, complex state mutations, and UI rendering in a single component leads to tightly coupled, hard-to-test code.

## Prefer composition over configuration for flexible components

**Impact: HIGH**

When components grow their API surface through boolean flags and config props (`showHeader`, `showFooter`, `variant`, `iconPosition`, …), every new feature requires modifying the component internals. Composition patterns — compound components in React, named slots in Vue — let consumers assemble exactly what they need without touching the source.

**Incorrect (configuration-heavy component with prop explosion):**

```tsx
// ❌ Every layout variation requires a new prop and internal branching
interface CardProps {
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  footerText?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  variant?: "default" | "outlined" | "elevated";
  size?: "sm" | "md" | "lg";
  actions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  imageSrc?: string;
  imagePosition?: "top" | "bottom";
  children: React.ReactNode;
}

function Card({
  title, subtitle, showHeader = true, showFooter = false,
  footerText, icon, iconPosition = "left", variant = "default",
  size = "md", actions, headerExtra, imageSrc, imagePosition = "top",
  children,
}: CardProps) {
  return (
    <div className={`card card--${variant} card--${size}`}>
      {imageSrc && imagePosition === "top" && <img src={imageSrc} />}
      {showHeader && (
        <div className="card-header">
          {icon && iconPosition === "left" && icon}
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {icon && iconPosition === "right" && icon}
          {headerExtra}
        </div>
      )}
      <div className="card-body">{children}</div>
      {imageSrc && imagePosition === "bottom" && <img src={imageSrc} />}
      {showFooter && (
        <div className="card-footer">
          {footerText && <span>{footerText}</span>}
          {actions}
        </div>
      )}
    </div>
  );
}
```

**Correct (compound component with composable slots):**

```tsx
// ✅ Consumers compose exactly the layout they need — no props, no branching

interface CardProps {
  variant?: "default" | "outlined" | "elevated";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

function Card({ variant = "default", size = "md", children }: CardProps) {
  return <div className={`card card--${variant} card--${size}`}>{children}</div>;
}

Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>;
};

Card.Body = function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>;
};

Card.Footer = function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="card-footer">{children}</div>;
};

Card.Image = function CardImage({ src, alt }: { src: string; alt: string }) {
  return <img className="card-image" src={src} alt={alt} />;
};

// Usage — each consumer defines its own layout
<Card variant="elevated">
  <Card.Image src="/product.jpg" alt="Product photo" />
  <Card.Header>
    <ShoppingCartIcon />
    <h3>Premium Plan</h3>
  </Card.Header>
  <Card.Body>
    <p>Unlock all features with our premium offering.</p>
  </Card.Body>
  <Card.Footer>
    <Button variant="primary">Subscribe</Button>
    <Button variant="ghost">Learn more</Button>
  </Card.Footer>
</Card>
```

Compound components scale to any layout permutation without touching the component internals — new sections are simply new sub-components.

---

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

## Keep components focused on a single responsibility

**Impact: CRITICAL**

Each component should do one thing well. When a component exceeds ~150 lines or handles multiple concerns — layout, data fetching, business logic, and rendering — it becomes nearly impossible to test in isolation, reuse elsewhere, or debug when something breaks. Splitting early prevents the exponential growth that turns files into 1000-line monsters.

**Incorrect (monolithic component handling everything):**

```tsx
// ❌ One component owns layout, filtering, charting, and table rendering
function Dashboard() {
  const [filter, setFilter] = useState({ dateRange: "7d", status: "all" });
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sales?range=${filter.dateRange}&status=${filter.status}`)
      .then((res) => res.json())
      .then((json) => { setData(json); setLoading(false); });
  }, [filter]);

  const chartData = data.map((d) => ({ x: d.date, y: d.revenue }));
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Sales Dashboard</h1>
        <span>Total: ${totalRevenue.toLocaleString()}</span>
      </header>
      <aside className="dashboard-sidebar">
        <select value={filter.dateRange} onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
      </aside>
      <main>
        {loading ? <Spinner /> : (
          <>
            <div className="chart-container">
              <LineChart data={chartData} xKey="x" yKey="y" height={300} />
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>Revenue</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td><td>{row.customer}</td>
                    <td>${row.revenue}</td><td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
```

**Correct (split into focused, composable sub-components):**

```tsx
// ✅ Each component has a single job — fetch, filter, chart, or table

function Dashboard() {
  const [filter, setFilter] = useState({ dateRange: "7d", status: "all" });
  const { data, loading } = useSalesData(filter);

  return (
    <DashboardLayout
      header={<DashboardHeader totalRevenue={data?.totalRevenue ?? 0} />}
      sidebar={<DashboardFilters filter={filter} onChange={setFilter} />}
    >
      {loading ? <Spinner /> : (
        <>
          <DashboardChart data={data.records} />
          <DataTable columns={salesColumns} rows={data.records} />
        </>
      )}
    </DashboardLayout>
  );
}

function DashboardFilters({ filter, onChange }: DashboardFiltersProps) {
  return (
    <aside className="dashboard-sidebar">
      <Select label="Date range" value={filter.dateRange}
        options={DATE_RANGE_OPTIONS}
        onChange={(dateRange) => onChange({ ...filter, dateRange })} />
      <Select label="Status" value={filter.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ ...filter, status })} />
    </aside>
  );
}

function DataTable<T>({ columns, rows }: DataTableProps<T>) {
  return (
    <table className="data-table">
      <thead>
        <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{columns.map((col) => <td key={col.key}>{col.render(row)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
```

A good litmus test: if you can't describe what the component does in one sentence without using "and", it's doing too much.

---

## 3. TailwindCSS Styling {#section-3}

**Impact:** HIGH
**Description:** TailwindCSS is powerful but can result in extremely long `className` strings. Use utility libraries to compose classes conditionally and extract reusable styles where appropriate.

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

---

## 4. Error Handling {#section-4}

**Impact:** HIGH
**Description:** Uncaught errors in rendering or async operations can crash the entire application. Error boundaries, proper async state handling, and graceful degradation prevent single-point failures and maintain user trust.

## Handle all async states: loading, error, and empty

**Impact: HIGH**

Every data-fetching component encounters four states during its lifecycle: loading, error, empty, and success. Components that only handle the success case render blank screens while data is loading, crash with uncaught errors when an API call fails, and show confusing empty layouts when valid responses contain zero results. Explicitly handling all four states provides clear user feedback and prevents silent failures that erode trust.

**Incorrect (only handling the success case):**

```tsx
// ❌ No loading indicator, no error handling, no empty state — fails silently in three out of four states
function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data));
  }, []);

  return (
    <section className="project-list">
      <h2>Your Projects</h2>
      {projects && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

**Correct (React — handling all four async states):**

```tsx
// ✅ Explicit handling for loading, error, empty, and success states
function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProjects() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/projects", { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
        const data: Project[] = await res.json();
        setProjects(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    fetchProjects();
    return () => controller.abort();
  }, []);

  if (isLoading) {
    return <LoadingSpinner label="Loading projects…" />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="Unable to load projects"
        detail={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderIcon />}
        heading="No projects yet"
        description="Create your first project to get started."
        action={<a href="/projects/new">Create Project</a>}
      />
    );
  }

  return (
    <section className="project-list">
      <h2>Your Projects</h2>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Correct (Vue — handling all four async states):**

```vue
<!-- ✅ Explicit handling for loading, error, empty, and success states -->
<script setup lang="ts">
import { ref, onMounted } from "vue";

const projects = ref<Project[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    isLoading.value = true;
    error.value = null;
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
    projects.value = await res.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <LoadingSpinner v-if="isLoading" label="Loading projects…" />

  <ErrorMessage
    v-else-if="error"
    title="Unable to load projects"
    :detail="error"
    @retry="$router.go(0)"
  />

  <EmptyState
    v-else-if="projects.length === 0"
    heading="No projects yet"
    description="Create your first project to get started."
  />

  <section v-else class="project-list">
    <h2>Your Projects</h2>
    <ul>
      <li v-for="project in projects" :key="project.id">
        <h3>{{ project.name }}</h3>
        <p>{{ project.description }}</p>
      </li>
    </ul>
  </section>
</template>
```

Always design data-fetching components around the four async states. Use early returns (React) or `v-if`/`v-else-if` chains (Vue) so each state is immediately visible and impossible to miss during code review.

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
<!-- ✅ ErrorBoundary component catches child errors and renders a fallback instead of crashing the app -->
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
<!-- ✅ Wrap each dashboard section so failures are isolated -->
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

---

## 5. Forms & Validation {#section-5}

**Impact:** MEDIUM
**Description:** Forms are the primary data-entry mechanism in web applications. Using form libraries and schema-based validation reduces boilerplate, ensures consistency, and enables type-safe validation that can be shared between client and server.

## Use form libraries for complex forms instead of manual state management

**Impact: MEDIUM**

For forms with more than 3–4 fields, manual `useState` per field creates enormous boilerplate, makes validation inconsistent, and tightly couples rendering to state updates. Form libraries like React Hook Form, Formik, or VeeValidate handle registration, dirty tracking, error mapping, and submission in a declarative, performant way.

**Incorrect (individual useState per field):**

```tsx
// ❌ Boilerplate explosion – each field needs its own state, onChange, and validation
import { useState, FormEvent } from 'react';

function RegistrationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!firstName) newErrors.firstName = 'First name is required';
    if (!email.includes('@')) newErrors.email = 'Invalid email';
    if (password.length < 8) newErrors.password = 'Min 8 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords must match';
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      // submit
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      {errors.firstName && <span>{errors.firstName}</span>}
      {/* ...repeated for every field */}
    </form>
  );
}
```

**Correct (React Hook Form):**

```tsx
// ✅ Declarative registration, built-in validation, minimal re-renders
import { useForm } from 'react-hook-form';

interface RegistrationValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegistrationValues>();

  const onSubmit = (data: RegistrationValues) => {
    console.log('Submitting:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('firstName', { required: 'First name is required' })} />
      {errors.firstName && <span>{errors.firstName.message}</span>}

      <input {...register('email', { required: true, pattern: /^\S+@\S+$/i })} />
      {errors.email && <span>Invalid email</span>}

      <input
        type="password"
        {...register('password', { required: true, minLength: 8 })}
      />
      {errors.password && <span>Min 8 characters</span>}

      <input
        type="password"
        {...register('confirmPassword', {
          validate: (val) => val === watch('password') || 'Passwords must match',
        })}
      />
      {errors.confirmPassword && <span>{errors.confirmPassword.message}</span>}

      <button type="submit">Register</button>
    </form>
  );
}
```

React Hook Form uses uncontrolled inputs by default, which dramatically reduces re-renders compared to the manual `useState` approach.

---

## Define validation schemas separately from components using Zod or Yup

**Impact: MEDIUM**

Validation rules embedded inside `onSubmit` handlers are impossible to share between client and server, difficult to unit-test in isolation, and inevitably drift out of sync across forms that operate on the same data. Defining a standalone schema with Zod or Yup gives you a single source of truth for validation, automatic TypeScript type inference, and seamless integration with form libraries.

**Incorrect (inline if/else validation in handler):**

```tsx
// ❌ Validation logic is buried inside the component – untestable and non-reusable
import { useForm } from 'react-hook-form';

function CheckoutForm() {
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = (data: any) => {
    if (!data.email || !/^\S+@\S+$/i.test(data.email)) {
      setError('email', { message: 'Valid email is required' });
      return;
    }
    if (!data.cardNumber || data.cardNumber.replace(/\s/g, '').length !== 16) {
      setError('cardNumber', { message: 'Card number must be 16 digits' });
      return;
    }
    if (!data.expiry || !/^\d{2}\/\d{2}$/.test(data.expiry)) {
      setError('expiry', { message: 'Expiry must be MM/YY' });
      return;
    }
    // ...more ad-hoc checks
    submitOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      <input {...register('cardNumber')} placeholder="Card number" />
      <input {...register('expiry')} placeholder="MM/YY" />
      <button type="submit">Pay</button>
    </form>
  );
}
```

**Correct (Zod schema with zodResolver):**

```tsx
// ✅ Schema is standalone, testable, and infers the form's TypeScript type
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const checkoutSchema = z.object({
  email: z.string().email('Valid email is required'),
  cardNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().length(16, 'Card number must be 16 digits')),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiry must be MM/YY'),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

function CheckoutForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
  });

  const onSubmit = (data: CheckoutValues) => {
    submitOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('cardNumber')} placeholder="Card number" />
      {errors.cardNumber && <span>{errors.cardNumber.message}</span>}

      <input {...register('expiry')} placeholder="MM/YY" />
      {errors.expiry && <span>{errors.expiry.message}</span>}

      <button type="submit">Pay</button>
    </form>
  );
}
```

Because the schema is a plain exported object, you can reuse `checkoutSchema` in API route handlers for server-side validation and import it into unit tests without rendering any components.

---

## 6. Performance {#section-6}

**Impact:** MEDIUM
**Description:** Unnecessary re-renders are the primary cause of frontend performance issues. Memoize expensive calculations and stable component trees.

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

---

## Virtualize long lists instead of rendering all items to the DOM

**Impact: MEDIUM**

When a component maps over a large array and renders every item into the DOM, the browser must create, lay out, and paint hundreds or thousands of nodes — even the ones far outside the viewport. This causes slow initial mounts, sluggish scrolling, and excessive memory consumption. Virtualization libraries solve this by only rendering the items currently visible in the scroll container, recycling DOM nodes as the user scrolls.

**Incorrect (rendering all 1000+ items directly):**

```tsx
// ❌ All 1,000 rows are mounted to the DOM at once, causing jank and high memory usage
interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="h-[600px] overflow-auto">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-medium">{tx.description}</p>
            <p className="text-sm text-gray-500">{tx.date}</p>
          </div>
          <span className="font-semibold">${tx.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
```

**Correct (virtualizing the list with @tanstack/react-virtual):**

```tsx
// ✅ Only visible rows are rendered — smooth scrolling even with 10,000+ items
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const tx = transactions[virtualRow.index];
          return (
            <div
              key={tx.id}
              className="absolute left-0 right-0 flex items-center justify-between border-b px-4 py-3"
              style={{ top: virtualRow.start, height: virtualRow.size }}
            >
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-sm text-gray-500">{tx.date}</p>
              </div>
              <span className="font-semibold">${tx.amount.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

A good rule of thumb is to virtualize any list that could exceed ~100 items. For Vue, `vue-virtual-scroller` provides equivalent functionality with a `<RecycleScroller>` component.

---

## 7. State Management {#section-7}

**Impact:** HIGH
**Description:** State should be kept as close to where it is used as possible. However, when multiple components need the same state, it must be lifted up or moved to a global store (like Zustand, Pinia, or Redux) to avoid prop drilling.

## Colocate state with the components that use it

**Impact: HIGH**

State should live as close as possible to the components that read and write it. When local UI state — like a search query, a toggle, or a form draft — gets pulled into a global store, every subscriber in the tree re-renders on every keystroke. Colocation keeps updates scoped, reduces cognitive overhead, and makes components portable.

**Incorrect (local UI state stored in a global store):**

```tsx
// ❌ Search query is only used by ProductSearch, but stored globally
// store/productStore.ts
import { create } from "zustand";

interface ProductStore {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
}

export const useProductStore = create<ProductStore>((set) => ({
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedCategory: "all",
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  cartItems: [],
  addToCart: (item) => set((s) => ({ cartItems: [...s.cartItems, item] })),
}));

// components/ProductSearch.tsx — the ONLY consumer of searchQuery
function ProductSearch() {
  const searchQuery = useProductStore((s) => s.searchQuery);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);

  return (
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search products…"
    />
  );
}
```

**Correct (UI state kept local, global store holds only shared state):**

```tsx
// ✅ searchQuery lives where it's used — the global store only keeps shared data
// store/productStore.ts
import { create } from "zustand";

interface ProductStore {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
}

export const useProductStore = create<ProductStore>((set) => ({
  cartItems: [],
  addToCart: (item) => set((s) => ({ cartItems: [...s.cartItems, item] })),
}));

// components/ProductSearch.tsx — owns its own transient UI state
function ProductSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <input
      value={searchQuery}
      onChange={handleChange}
      placeholder="Search products…"
    />
  );
}
```

A practical rule of thumb: if only one component reads a piece of state, that state belongs inside that component — not in a store.

---

## Derive values from state instead of storing redundant copies

**Impact: MEDIUM**

If a value can be computed from existing state, compute it — don't store it. Keeping `filteredItems` or `totalPrice` as separate state variables means you must manually keep them in sync with every mutation. One forgotten `setState` call and your UI shows stale data. Derivation guarantees consistency by construction.

**Incorrect (redundant state that must be manually synchronized):**

```tsx
// ❌ filteredProducts and productCount are copies of data already in products + filter
function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    fetchProducts().then((data) => {
      setProducts(data);
      // Must remember to update BOTH derived values here…
      const filtered = data.filter((p) => p.name.toLowerCase().includes(filter));
      setFilteredProducts(filtered);
      setProductCount(filtered.length);
    });
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setFilter(value);
    // …and here — forget one and the UI is out of sync
    const filtered = products.filter((p) => p.name.toLowerCase().includes(value));
    setFilteredProducts(filtered);
    setProductCount(filtered.length);
  };

  return (
    <div>
      <input value={filter} onChange={handleFilterChange} placeholder="Filter…" />
      <p>Showing {productCount} products</p>
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

**Correct (derived values computed from single source of truth):**

```tsx
// ✅ Only store the raw data and the filter — derive everything else
function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [products, filter],
  );

  const productCount = filteredProducts.length;

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter…"
      />
      <p>Showing {productCount} products</p>
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

The same principle applies in Vue with `computed()` — any value expressible as a pure function of reactive state should be a computed property, never a separate `ref`.

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

---

## 8. Testing {#section-8}

**Impact:** MEDIUM
**Description:** Tests should verify user-observable behavior, not implementation details. Testing Library's guiding principle — test what the user sees and does — produces resilient tests that survive refactors.

## Test user behavior, not implementation details

**Impact: MEDIUM**

Tests coupled to implementation details — internal component state, specific CSS class names, or DOM structure — break the moment you refactor, even when the actual user-facing behavior is unchanged. Following Testing Library's guiding principle ("the more your tests resemble the way your software is used, the more confidence they can give you"), you should query elements by accessible role, label, or visible text and assert on outcomes a user would observe.

**Incorrect (asserting on internal state and CSS classes):**

```tsx
// ❌ Test is coupled to implementation – breaks on any refactor
import { mount } from 'enzyme';
import Dropdown from './Dropdown';

test('opens the dropdown when clicked', () => {
  const wrapper = mount(<Dropdown items={['Apple', 'Banana', 'Cherry']} />);

  // Reaching into internal state
  expect(wrapper.state('isOpen')).toBe(false);

  wrapper.find('.dropdown-toggle').simulate('click');

  // Asserting on CSS class and internal state
  expect(wrapper.state('isOpen')).toBe(true);
  expect(wrapper.find('.dropdown-menu').exists()).toBe(true);
  expect(wrapper.find('.dropdown-menu').hasClass('is-visible')).toBe(true);
});
```

**Correct (asserting on visible user outcomes):**

```tsx
// ✅ Test mirrors real user interaction – survives refactors
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dropdown from './Dropdown';

test('shows options when the user opens the dropdown', async () => {
  const user = userEvent.setup();
  render(<Dropdown items={['Apple', 'Banana', 'Cherry']} />);

  // The listbox should not be visible initially
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  // Click the toggle button by its accessible role
  await user.click(screen.getByRole('button', { name: /select an option/i }));

  // Assert that the user can see the options
  const listbox = screen.getByRole('listbox');
  expect(listbox).toBeVisible();
  expect(screen.getByRole('option', { name: 'Apple' })).toBeVisible();
  expect(screen.getByRole('option', { name: 'Cherry' })).toBeVisible();
});
```

If your test would still pass after completely rewriting the component's internals (state management, class names, DOM nesting) while keeping the same user-facing behavior, you have a resilient test.

---

## 9. TypeScript & Type Safety {#section-9}

**Impact:** HIGH
**Description:** TypeScript's value is only realized when types are strict and explicit. Properly typed component props, discriminated unions for variants, and avoiding `any` provide compile-time safety and self-documenting APIs.

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

---
