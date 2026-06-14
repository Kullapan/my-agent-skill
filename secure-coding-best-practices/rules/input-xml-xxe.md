---
title: Disable External Entity Processing in XML Parsers (XXE)
impact: CRITICAL
impactDescription: CWE-611 — OWASP A05 Security Misconfiguration
tags: security, xxe, xml, injection, external-entities, ssrf
---

## Disable External Entity Processing in XML Parsers (XXE)

**Impact: CRITICAL — CWE-611**

XML eXternal Entity (XXE) risks abuse insecure XML parsers to read local files (`/etc/passwd`, `.env`), perform SSRF to internal services, or cause denial of service. By default, many XML parsers allow external entity resolution. Disable it explicitly.

**Non-compliant (default XML parser config):**

```typescript
// ❌ node-expat, libxmljs — external entities enabled by default
import libxmljs from 'libxmljs'
const doc = libxmljs.parseXml(req.body)  // external entities resolved!

// ❌ SAML/XML libraries that don't disable DTD
import { parseString } from 'xml2js'
parseString(req.body, callback)  // check if noent: false is needed

// Example untrusted payload:
// <?xml version="1.0"?>
// <!DOCTYPE foo [
//   <!ENTITY xxe SYSTEM "file:///etc/passwd">
// ]>
// <data>&xxe;</data>
```

**Secure (disable external entities and DTD processing):**

```typescript
// ✅ Use fast-xml-parser — no DTD support by design
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  allowBooleanAttributes: true,
})
const result = parser.parse(req.body)

// ✅ xml2js — disable entity expansion
import { parseStringPromise } from 'xml2js'
const result = await parseStringPromise(req.body, {
  explicitArray: false,
  // xml2js uses sax.js internally which doesn't process external entities
})

// ✅ For SAML libraries — verify XXE is disabled in the library config
// Use xmldom with external entities disabled:
import { DOMParser } from '@xmldom/xmldom'
const parser = new DOMParser({
  errorHandler: {
    warning: () => {},
    error: (msg: string) => { throw new Error(msg) },
    fatalError: (msg: string) => { throw new Error(msg) },
  },
})
const doc = parser.parseFromString(xml, 'text/xml')

// ✅ If you control schema — reject XML with DOCTYPE entirely
function stripDoctype(xml: string): string {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error('DOCTYPE is not allowed')
  }
  return xml
}
const safeXml = stripDoctype(req.body)
```

Prefer JSON over XML for APIs where you control both sides. When XML is required, use libraries with no DTD/entity support by design and validate input size to prevent billion-laughs DoS.

Reference: [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
