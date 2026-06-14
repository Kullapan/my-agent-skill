---
title: Ensure containers run without root privileges (OpenShift SCC)
impact: CRITICAL
impactDescription: Containers built to require 'root' will fail to start (CrashLoopBackOff) in OpenShift.
tags: openshift, docker, scc, security, root, permissions, uid
---

## Ensure containers run without root privileges (OpenShift SCC)

**Impact: CRITICAL**

By default, OpenShift runs containers using a randomly assigned, high user ID (UID) for security. If your container relies on the `root` user to read/write files or bind to ports < 1024, it will crash immediately. You must adjust permissions so that the root group (`gid=0`) has read/write access, because the random UID is always a member of the root group.

**Incorrect (Requires root):**

```dockerfile
# ❌ Runs as root by default
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install

# ❌ Tries to bind to a privileged port (requires root)
ENV PORT=80 
EXPOSE 80

CMD ["node", "server.js"]
# Will fail in OpenShift: "listen EACCES: permission denied 0.0.0.0:80"
```

**Correct (OpenShift SCC Compliant):**

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ✅ Bind to an unprivileged port
ENV PORT=8080
EXPOSE 8080

# ✅ OpenShift assigns a random UID, but always uses GID 0 (root group).
# We must ensure GID 0 can read and write necessary directories.
RUN chgrp -R 0 /app && \
    chmod -R g=u /app

# ✅ Explicitly set a non-root user (good practice, though OpenShift will override the UID)
USER 1001

CMD ["node", "server.js"]
```

Never use `USER root` in production Dockerfiles targeted at OpenShift.
