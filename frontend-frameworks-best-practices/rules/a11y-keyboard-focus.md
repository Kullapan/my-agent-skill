---
title: Ensure all interactive elements are keyboard-accessible with visible focus indicators
impact: HIGH
impactDescription: Removing focus outlines or using non-focusable elements breaks the experience for keyboard-only users.
tags: accessibility, a11y, keyboard, focus, tab-order, focus-visible
---

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
