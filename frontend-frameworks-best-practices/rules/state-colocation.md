---
title: Colocate state with the components that use it
impact: HIGH
impactDescription: Hoisting all state to the root causes unnecessary re-renders across the entire component tree.
tags: react, vue, state, colocation, local-state, architecture
---

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
