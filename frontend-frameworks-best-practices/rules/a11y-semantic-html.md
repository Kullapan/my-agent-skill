---
title: Use semantic HTML elements instead of generic divs and spans
impact: CRITICAL
impactDescription: Styled divs with onClick handlers are invisible to screen readers and break keyboard navigation for millions of users.
tags: accessibility, a11y, semantic-html, aria, screen-reader
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
