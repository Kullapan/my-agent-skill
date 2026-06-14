---
title: Configure SecurityContext to enforce non-root and prevent privilege escalation
impact: CRITICAL
impactDescription: Pods without SecurityContext run as root with privilege escalation, violating OpenShift restricted-v2 SCC.
tags: openshift, kubernetes, security-context, non-root, privilege-escalation
---

## Configure SecurityContext to enforce non-root and prevent privilege escalation

**Impact: CRITICAL**

Running containers as root is the single most common cause of privilege escalation vulnerabilities in OpenShift clusters. Without an explicit SecurityContext, the container runtime defaults to UID 0 (root) and allows privilege escalation, which violates the OpenShift restricted-v2 Security Context Constraint. Enforcing `runAsNonRoot`, disabling privilege escalation, and setting a Seccomp profile ensures your workloads comply with cluster security policies and reduces the attack surface.

**Incorrect (Deployment with no SecurityContext — runs as root):**

```yaml
# ❌ No securityContext defined — container runs as root with privilege escalation allowed
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: registry.example.com/my-app:1.4.0
          ports:
            - containerPort: 8080
          # No securityContext — defaults to root (UID 0)
          # allowPrivilegeEscalation defaults to true
          # No seccomp profile applied
```

**Correct (Deployment with SecurityContext enforcing non-root at pod and container level):**

```yaml
# ✅ SecurityContext configured at both pod and container level for restricted-v2 SCC compliance
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: my-app
          image: registry.example.com/my-app:1.4.0
          ports:
            - containerPort: 8080
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            seccompProfile:
              type: RuntimeDefault
            capabilities:
              drop:
                - ALL
```

Always define SecurityContext at both the pod and container level to ensure consistent enforcement, and verify compliance by running `oc adm policy who-can use scc restricted-v2` against your service account.
