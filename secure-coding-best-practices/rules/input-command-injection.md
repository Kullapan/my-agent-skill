---
title: Never Construct Shell Commands from User Input
impact: CRITICAL
impactDescription: CWE-78 — OWASP A03 Injection (Command Injection)
tags: security, injection, command-injection, shell, exec, spawn
---

## Never Construct Shell Commands from User Input

**Impact: CRITICAL — CWE-78**

OS command injection lets untrusted clients execute arbitrary commands on the server with the application's privileges. Any use of `exec`, `execSync`, or shell-interpolating functions with user-controlled data is non-compliant. Use `spawn` with an argument array instead, which never invokes a shell.

**Non-compliant (shell command injection):**

```typescript
import { exec, execSync } from 'child_process'

// ❌ Untrusted client sends: filename='; rm -rf /; echo '
exec(`convert /uploads/${req.body.filename} output.jpg`, callback)

// ❌ execSync with template literal
const result = execSync(`ping ${req.query.host}`)
// ?host=8.8.8.8; cat /etc/passwd

// ❌ Shell option enabled — still dangerous
const { exec } = require('child_process')
exec('ls ' + userInput, { shell: true }, callback)
```

**Secure (spawn with arg array — no shell invocation):**

```typescript
import { spawn } from 'child_process'
import path from 'path'

// ✅ spawn with array of arguments — never interpreted as shell commands
function convertImage(filename: string): Promise<string> {
  // Validate the filename first
  if (!/^[a-zA-Z0-9_\-]+\.(jpg|png|gif|webp)$/.test(filename)) {
    throw new Error('Invalid filename')
  }

  const inputPath  = path.resolve('/uploads', filename)
  const outputPath = path.resolve('/processed', `${Date.now()}.jpg`)

  return new Promise((resolve, reject) => {
    const proc = spawn('convert', [inputPath, outputPath], {
      shell: false,  // ✅ explicitly disable shell
      timeout: 10000,
    })
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`convert exited with ${code}`))
      else resolve(outputPath)
    })
  })
}

// ✅ For ping — allowlist hosts, use spawn
function ping(host: string) {
  const allowedHosts = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
  if (!allowedHosts.includes(host)) throw new Error('Host not allowed')

  return spawn('ping', ['-c', '4', host], { shell: false })
}
```

If you need shell features (pipes, redirects), use them in static scripts and pass only validated data as arguments. Never allow user input to reach the shell command string itself.

Reference: [OWASP Command Injection](https://owasp.org/www-community/risks/Command_Injection)
