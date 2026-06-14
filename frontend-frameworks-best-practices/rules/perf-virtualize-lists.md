---
title: Virtualize long lists instead of rendering all items to the DOM
impact: MEDIUM
impactDescription: Rendering 1000+ DOM nodes for a scrollable list causes jank, high memory usage, and slow initial mount.
tags: react, vue, performance, virtualization, lists, dom
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
