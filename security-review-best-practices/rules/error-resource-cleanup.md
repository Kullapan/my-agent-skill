---
title: Ensure Exception-Safe Resource Cleanup
impact: MEDIUM
impactDescription: CWE-404 — OWASP A10 Mishandling of Exceptional Conditions
tags: security, error-handling, resource-cleanup, connection-leak, file-handle, finally
---

## Ensure Exception-Safe Resource Cleanup

**Impact: MEDIUM — CWE-404**

Resources like database connections, file handles, network sockets, and encryption contexts must be released even when exceptions occur. Leaked resources exhaust connection pools, fill file descriptor tables, and eventually crash the application. In high-traffic systems, a single missing `finally` block can cause a denial-of-service condition within hours as the connection pool drains to zero.

**Vulnerable (resources leaked on exception):**

```typescript
// ❌ Database connection leaked if query throws
async function getUserOrders(userId: string): Promise<Order[]> {
  const connection = await pool.getConnection()
  // If this query throws, the connection is never released
  const orders = await connection.query('SELECT * FROM orders WHERE user_id = ?', [userId])
  connection.release()  // Never reached on error!
  return orders
}

// ❌ File handle leaked if processing throws
async function processUpload(filePath: string): Promise<void> {
  const handle = await fs.open(filePath, 'r')
  const content = await handle.readFile('utf-8')
  const parsed = JSON.parse(content)  // Throws on malformed JSON
  await processData(parsed)
  await handle.close()  // Never reached on error!
}

// ❌ Temporary file not cleaned up
async function generateReport(data: ReportData): Promise<string> {
  const tempPath = `/tmp/report-${Date.now()}.pdf`
  await writePDF(tempPath, data)
  const url = await uploadToS3(tempPath)  // If this throws, temp file remains on disk
  await fs.unlink(tempPath)  // Never reached on error!
  return url
}
```

**Secure (exception-safe resource cleanup):**

```typescript
// ✅ try/finally ensures connection is always released
async function getUserOrders(userId: string): Promise<Order[]> {
  const connection = await pool.getConnection()
  try {
    const orders = await connection.query('SELECT * FROM orders WHERE user_id = ?', [userId])
    return orders
  } finally {
    connection.release()  // Always runs, even on exception
  }
}

// ✅ Using Symbol.asyncDispose (TC39 Explicit Resource Management)
async function processUpload(filePath: string): Promise<void> {
  await using handle = await fs.open(filePath, 'r')
  // handle is automatically closed when scope exits, even on exception
  const content = await handle.readFile('utf-8')
  const parsed = JSON.parse(content)
  await processData(parsed)
}

// ✅ Cleanup in finally for temporary files
async function generateReport(data: ReportData): Promise<string> {
  const tempPath = `/tmp/report-${Date.now()}.pdf`
  try {
    await writePDF(tempPath, data)
    const url = await uploadToS3(tempPath)
    return url
  } finally {
    // Clean up temp file regardless of success or failure
    await fs.unlink(tempPath).catch(() => {})  // Ignore "file not found" errors
  }
}
```

Every resource acquisition must have a corresponding release in a `finally` block, `using` declaration, or equivalent. Audit code for connection `.getConnection()`, file `.open()`, and lock `.acquire()` calls without matching cleanup.

Reference: [CWE-404: Improper Resource Shutdown or Release](https://cwe.mitre.org/data/definitions/404.html)
