---
title: Keep presentation components pure and stateless
impact: CRITICAL
impactDescription: Mixing business logic, data fetching, and UI rendering makes components untestable and impossible to reuse.
tags: react, vue, components, pure, presentation, architecture
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
