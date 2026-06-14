---
title: Always define CPU and memory requests and limits
impact: HIGH
impactDescription: Pods without limits can consume all node resources, causing cluster-wide OutOfMemory (OOM) failures and node evictions.
tags: kubernetes, openshift, resources, limits, requests, oom, cpu, memory
---

## Always define CPU and memory requests and limits

**Impact: HIGH**

OpenShift uses **requests** to schedule pods on nodes with sufficient capacity. It uses **limits** to restrict the maximum resources a pod can consume. Without requests, your pod might be scheduled on a starved node. Without limits, a memory leak in your app will consume all node memory, causing the OS to kill critical system processes.

**Incorrect (No resource limits):**

```yaml
# ❌ Unlimited resource consumption allowed
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:1.0.0
        # 🚨 Missing resources block!
```

**Correct (Configured resources):**

```yaml
# ✅ Resources explicitly defined
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:1.0.0
        resources:
          # ✅ Guaranteed resources for scheduling
          requests:
            cpu: "100m"      # 1/10th of a CPU core
            memory: "256Mi"  # 256 Megabytes
          # ✅ Hard cap (will be OOMKilled if it exceeds memory limit)
          limits:
            cpu: "500m"      # Half a CPU core
            memory: "512Mi"  # 512 Megabytes
```

For Java applications, ensure `XX:MaxRAMPercentage` is set so the JVM respects the container's memory limit rather than the host node's total memory. For Node.js, use `--max-old-space-size` to prevent V8 from exceeding the limit.
