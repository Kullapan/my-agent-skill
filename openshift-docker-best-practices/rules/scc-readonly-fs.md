---
title: Use read-only root filesystem to prevent runtime tampering
impact: HIGH
impactDescription: Writable root filesystems allow attackers to modify application binaries, install malware, or persist backdoors inside running containers.
tags: openshift, kubernetes, security, readonly-filesystem, immutable
---

## Use read-only root filesystem to prevent runtime tampering

**Impact: HIGH**

A writable root filesystem allows an attacker with code execution to modify application binaries, drop malicious scripts, or install tools like `curl` and `netcat` for lateral movement. Setting `readOnlyRootFilesystem: true` makes the container's filesystem immutable at runtime, forcing all writes to explicitly mounted volumes that can be scoped and monitored.

**Incorrect (writable root filesystem):**

```yaml
# ❌ No readOnlyRootFilesystem — attacker can modify any file in the container
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
    - name: web-app
      image: registry.example.com/webapp:3.0.0
      securityContext:
        runAsNonRoot: true
        # Root filesystem is writable by default
        # An attacker could:
        #   - Replace /app/server.js with a backdoor
        #   - Write cron jobs or scripts to /tmp
        #   - Install tools via package managers
```

**Correct (read-only root filesystem with explicit writable mounts):**

```yaml
# ✅ Immutable root filesystem with only necessary writable directories
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
    - name: web-app
      image: registry.example.com/webapp:3.0.0
      securityContext:
        runAsNonRoot: true
        readOnlyRootFilesystem: true     # Make the entire root filesystem read-only
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
      volumeMounts:
        - name: tmp
          mountPath: /tmp                # Application temp files
        - name: cache
          mountPath: /var/cache          # Cache directory if needed
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 100Mi                 # Limit temp disk usage
    - name: cache
      emptyDir:
        sizeLimit: 200Mi
```

Test your application with `readOnlyRootFilesystem: true` in development to identify all directories that need writable mounts. Common paths include `/tmp`, `/var/cache`, `/var/run`, and application-specific log directories.
