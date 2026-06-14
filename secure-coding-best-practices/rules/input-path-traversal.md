---
title: Prevent Path Traversal by Validating File Paths
impact: CRITICAL
impactDescription: CWE-22 — OWASP A01 Broken Access Control
tags: security, path-traversal, file-system, directory-traversal, input-validation
---

## Prevent Path Traversal by Validating File Paths

**Impact: CRITICAL — CWE-22**

Path traversal risks use `../` sequences in filenames to escape the intended directory and read arbitrary files (`/etc/passwd`, `.env`, private keys). Never construct file paths from user input without resolving and verifying they remain within the expected directory.

**Non-compliant (unsanitized path from user input):**

```typescript
// ❌ Untrusted client sends: filename=../../.env
app.get('/files/:filename', (req, res) => {
  const filePath = path.join('/uploads', req.params.filename)
  res.sendFile(filePath)
  // resolves to: /uploads/../../.env → /.env
})

// ❌ URL-encoded traversal — %2F..%2F..%2Fetc%2Fpasswd
app.get('/static', (req, res) => {
  const file = path.join('./public', req.query.file as string)
  res.sendFile(file)
})
```

**Secure (resolve and verify prefix):**

```typescript
import path from 'path'
import fs from 'fs'

const UPLOAD_DIR = path.resolve('/app/uploads')

// ✅ Resolve full path, then verify it starts with the allowed directory
app.get('/files/:filename', (req, res) => {
  const requestedPath = path.resolve(UPLOAD_DIR, req.params.filename)

  // Prevent traversal — resolved path must be inside UPLOAD_DIR
  if (!requestedPath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!fs.existsSync(requestedPath)) {
    return res.status(404).json({ error: 'Not found' })
  }

  res.sendFile(requestedPath)
})

// ✅ Use an allowlist of file IDs instead of filenames
app.get('/files/:fileId', requireAuth, async (req, res) => {
  const file = await db.files.findFirst({
    where: { id: req.params.fileId, ownerId: req.user.id }
  })
  if (!file) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.resolve(UPLOAD_DIR, file.storedName))
})
```

Prefer the allowlist approach: store files with server-generated names (UUIDs) and look up the real path from the database. This eliminates the need for path validation entirely.

Reference: [OWASP Path Traversal](https://owasp.org/www-community/risks/Path_Traversal)
