---
title: Derive values from state instead of storing redundant copies
impact: MEDIUM
impactDescription: Storing derived data as separate state creates synchronization bugs and stale data.
tags: react, vue, state, derived, computed, redundant-state
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
