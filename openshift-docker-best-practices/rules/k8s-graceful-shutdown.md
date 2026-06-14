---
title: Handle SIGTERM for graceful shutdown during pod termination
impact: HIGH
impactDescription: Applications that ignore SIGTERM cause failed requests during rollouts, data corruption from interrupted transactions, and connection leaks.
tags: kubernetes, openshift, graceful-shutdown, sigterm, lifecycle
---

## Handle SIGTERM for graceful shutdown during pod termination

**Impact: HIGH**

When Kubernetes terminates a pod (during scaling, rollouts, or eviction), it sends `SIGTERM` to the container's main process and waits `terminationGracePeriodSeconds` (default 30s) before sending `SIGKILL`. Applications that don't handle `SIGTERM` are killed abruptly — in-flight HTTP requests receive connection resets, database transactions are interrupted, and message consumers lose uncommitted work.

**Incorrect (application ignores SIGTERM):**

```yaml
# ❌ No graceful shutdown handling — requests fail during rollouts
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      # Default terminationGracePeriodSeconds: 30
      containers:
        - name: order-service
          image: registry.example.com/orders:1.0.0
          # No lifecycle hooks
          # App doesn't handle SIGTERM:
          #   - In-flight requests get connection reset
          #   - Database transactions are interrupted
          #   - Message queue consumers lose uncommitted messages
```

**Correct (graceful shutdown with preStop hook and SIGTERM handling):**

```yaml
# ✅ Graceful shutdown with proper lifecycle management
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60    # Give the app 60s to drain
      containers:
        - name: order-service
          image: registry.example.com/orders:2.0.0
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  # Wait for the pod to be removed from Service endpoints
                  # before starting application shutdown
                  - sleep 5
          # Spring Boot: set graceful shutdown in application.yml:
          #   server.shutdown: graceful
          #   spring.lifecycle.timeout-per-shutdown-phase: 30s
          #
          # Node.js: handle SIGTERM in code:
          #   process.on('SIGTERM', () => {
          #     server.close(() => process.exit(0));
          #   });
```

The `preStop` sleep allows time for kube-proxy to remove the pod from Service endpoints, preventing new requests from arriving during shutdown. Configure your application framework's graceful shutdown support (Spring Boot: `server.shutdown: graceful`, Express: `server.close()`).
