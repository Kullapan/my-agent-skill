---
title: Drop all Linux capabilities and add only what is needed
impact: HIGH
impactDescription: Default Linux capabilities include dangerous permissions like NET_RAW that enable network-level attacks from within the container.
tags: openshift, kubernetes, security, capabilities, least-privilege
---

## Drop all Linux capabilities and add only what is needed

**Impact: HIGH**

Linux capabilities split root's monolithic power into ~40 individual privileges. By default, containers retain a subset of these (e.g., `NET_RAW`, `MKNOD`, `AUDIT_WRITE`) that can be exploited for ARP spoofing, packet sniffing, or device creation. Dropping all capabilities and selectively adding back only what's required follows the principle of least privilege and is required by OpenShift's `restricted-v2` SCC.

**Non-compliant (no capabilities dropped):**

```yaml
# ❌ No capabilities block — container retains default capabilities including NET_RAW
apiVersion: v1
kind: Pod
metadata:
  name: api-server
spec:
  containers:
    - name: api-server
      image: registry.example.com/api:2.1.0
      ports:
        - containerPort: 8080
      securityContext:
        runAsNonRoot: true
        # No capabilities block — defaults include:
        # NET_RAW (ARP spoofing), MKNOD (device creation),
        # AUDIT_WRITE, FOWNER, SETUID, SETGID, etc.
```

**Correct (drop all, add back only what's needed):**

```yaml
# ✅ Drop ALL capabilities, add back only the minimum required
apiVersion: v1
kind: Pod
metadata:
  name: api-server
spec:
  containers:
    - name: api-server
      image: registry.example.com/api:2.1.0
      ports:
        - containerPort: 8080
      securityContext:
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL          # Remove every Linux capability
          # Only add back capabilities if absolutely required:
          # add:
          #   - NET_BIND_SERVICE  # Only if binding to ports < 1024
```

Most applications need zero capabilities. Only add back specific capabilities with a documented justification. Common legitimate additions include `NET_BIND_SERVICE` (binding to privileged ports) — but prefer using ports > 1024 instead.
