---
title: Configure rolling update strategy with PodDisruptionBudgets for zero-downtime deployments
impact: HIGH
impactDescription: Recreate strategy causes full application downtime during every deployment. Missing PDB allows cluster operations to take down all replicas simultaneously.
tags: kubernetes, openshift, rolling-update, deployment-strategy, pdb, zero-downtime
---

## Configure rolling update strategy with PodDisruptionBudgets for zero-downtime deployments

**Impact: HIGH**

The `Recreate` deployment strategy terminates all existing pods before creating new ones, causing application downtime on every deployment. Even with `RollingUpdate`, cluster operations like node drains can evict all pods simultaneously if no PodDisruptionBudget (PDB) is defined. Configure `RollingUpdate` with `maxUnavailable: 0` to ensure zero-downtime deployments, and add a PDB to protect against cluster maintenance disruptions.

**Incorrect (Recreate strategy with no PDB):**

```yaml
# ❌ Recreate strategy — all pods killed before new ones start = downtime
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
spec:
  replicas: 3
  strategy:
    type: Recreate         # All 3 pods terminated simultaneously
  template:
    spec:
      containers:
        - name: payment-api
          image: registry.example.com/payment:1.0.0
# During deployment:
#   1. All 3 pods are terminated
#   2. 0 pods running — application DOWN
#   3. New pods start and become ready
#   4. Application UP again — downtime: 30s to 5min+
```

**Correct (RollingUpdate with PDB):**

```yaml
# ✅ RollingUpdate ensures at least N pods are always running
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # Create 1 extra pod during rollout (4 total max)
      maxUnavailable: 0     # Never reduce below desired replica count
  template:
    spec:
      containers:
        - name: payment-api
          image: registry.example.com/payment:2.0.0
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            periodSeconds: 5

---
# ✅ PDB protects against node drains and cluster maintenance
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-api-pdb
spec:
  minAvailable: 2           # At least 2 of 3 pods must always be running
  selector:
    matchLabels:
      app: payment-api
```

Always pair `RollingUpdate` with readiness probes so that new pods must pass health checks before old pods are terminated. Set `maxUnavailable: 0` for critical services.
