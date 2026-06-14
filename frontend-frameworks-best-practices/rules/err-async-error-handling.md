---
title: Handle all async states: loading, error, and empty
impact: HIGH
impactDescription: Components that only handle the success case show blank screens or crash when API calls fail or return empty data.
tags: react, vue, async, error-handling, loading, empty-state, data-fetching
---

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
