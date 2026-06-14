---
title: Use minReadySeconds and progress deadlines to prevent bad rollouts
impact: MEDIUM
impactDescription: Without rollout safeguards, pods that pass readiness probes but crash after 10 seconds are promoted as healthy, causing cascading failures.
tags: kubernetes, openshift, deployment, rollout, minready, progress-deadline
---

## Use minReadySeconds and progress deadlines to prevent bad rollouts

**Impact: MEDIUM**

A pod that passes its readiness probe immediately but crashes 10 seconds later can be marked as "Available" before its instability is detected, causing Kubernetes to continue rolling out the bad version. `minReadySeconds` requires a pod to remain ready for a minimum duration before it counts as available. `progressDeadlineSeconds` sets a timeout for the entire rollout, automatically marking the deployment as failed if it stalls.

**Incorrect (no rollout safeguards):**

```yaml
# ❌ No minReadySeconds — pods counted as available the instant readiness probe passes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  # No progressDeadlineSeconds — rollout can hang forever
  template:
    spec:
      containers:
        - name: user-service
          image: registry.example.com/users:3.0.0
          # Pod passes readiness at t=0, crashes at t=8s
          # Kubernetes counts it as available, terminates the next old pod
          # New pod crashes → another old pod terminated → cascading failure
```

**Correct (minReadySeconds + progressDeadlineSeconds):**

```yaml
# ✅ Rollout safeguards prevent bad versions from being fully deployed
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  minReadySeconds: 15              # Pod must stay Ready for 15s before counting as Available
  progressDeadlineSeconds: 120      # Rollout must complete within 2 minutes or is marked Failed
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: user-service
          image: registry.example.com/users:3.0.0
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
```

Set `minReadySeconds` to a value that exceeds your application's typical initialization crash window (15-30s is common). Monitor rollout status with `kubectl rollout status deployment/<name>` and use `kubectl rollout undo` when `progressDeadlineSeconds` is exceeded.
