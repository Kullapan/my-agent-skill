---
title: Secure File Upload Handling
impact: HIGH
impactDescription: CWE-434 — OWASP A05 Injection
tags: security, file-upload, validation, mime-type, injection, path-traversal
---

## Secure File Upload Handling

**Impact: HIGH — CWE-434**

Unrestricted file uploads are one of the most dangerous code gaps — they can lead to remote code execution (uploading web shells), stored XSS (uploading HTML/SVG with scripts), denial of service (uploading enormous files), and path traversal (overwriting critical files). The client-provided filename and MIME type cannot be trusted — untrusted clients rename `shell.php` to `shell.jpg` and set the Content-Type to `image/jpeg`.

**Non-compliant (trusting client-provided file metadata):**

```typescript
// ❌ Trusting filename, MIME type, and size from the client
import multer from 'multer'

const upload = multer({
  dest: 'public/uploads/',  // Stored in publicly accessible directory!
  // No file size limit
  // No file type validation
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file!
  // ❌ Using original filename — path traversal: "../../../etc/cron.d/backdoor"
  const finalPath = `public/uploads/${file.originalname}`
  await fs.rename(file.path, finalPath)

  // File is now served at https://app.com/uploads/untrusted.html
  // If it contains <script>alert(document.cookie)</script> → stored XSS
  res.json({ url: `/uploads/${file.originalname}` })
})
```

**Secure (validated uploads with safe storage):**

```typescript
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import crypto from 'crypto'
import path from 'path'

// ✅ Strict file size limit
const upload = multer({
  dest: '/tmp/uploads/',                  // Temporary staging — NOT public
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB max
})

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
])

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file!

  // ✅ Step 1: Validate MIME type by reading magic bytes (not trusting headers)
  const buffer = await fs.readFile(file.path)
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    await fs.unlink(file.path)  // Clean up rejected file
    return res.status(400).json({ error: 'File type not allowed' })
  }

  // ✅ Step 2: Generate a safe random filename (ignore client filename entirely)
  const safeFilename = `${crypto.randomUUID()}${ALLOWED_TYPES.get(detected.mime)}`

  // ✅ Step 3: Store outside the webroot — serve via a controller, not static files
  const storagePath = path.join('/var/app/storage/uploads', safeFilename)
  await fs.rename(file.path, storagePath)

  // ✅ Step 4: Store metadata in database, serve through an authenticated endpoint
  const record = await db.uploads.create({
    id: crypto.randomUUID(),
    filename: safeFilename,
    originalName: file.originalname,
    mimeType: detected.mime,
    size: file.size,
    uploadedBy: req.user.id,
  })

  res.json({ id: record.id, url: `/api/files/${record.id}` })
})
```

Never trust client-provided filenames or MIME types. Validate file types by reading magic bytes. Store uploads outside the webroot. Generate random filenames. Serve files through authenticated controllers with proper `Content-Type` and `Content-Disposition` headers.

Reference: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
