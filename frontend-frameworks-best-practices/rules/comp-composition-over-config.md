---
title: Prefer composition over configuration for flexible components
impact: HIGH
impactDescription: Mega-components with dozens of boolean configuration props become unmaintainable and impossible to extend.
tags: react, vue, components, composition, patterns, slots
---

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
