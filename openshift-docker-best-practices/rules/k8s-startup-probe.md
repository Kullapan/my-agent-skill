---
title: Use startup probes for slow-starting applications
impact: MEDIUM
impactDescription: Without startup probes, liveness checks kill slow-starting pods (Spring Boot, JVM apps) before they finish initializing.
tags: kubernetes, openshift, startup-probe, spring-boot, health-checks
---

## Use startup probes for slow-starting applications

**Impact: MEDIUM**

Applications with heavy initialization—such as Spring Boot or JVM-based services—can take 30 seconds or more to become ready. Without a startup probe, the liveness probe begins checking immediately and will restart the container before it finishes booting. A startup probe delays liveness and readiness checks until the application signals it has fully started.

**Incorrect (liveness probe kills slow-starting Spring Boot app):**

```yaml
# ❌ Liveness probe starts immediately and kills the pod during Spring Boot init
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: inventory-service
  template:
    metadata:
      labels:
        app: inventory-service
    spec:
      containers:
        - name: inventory-service
          image: registry.example.com/inventory-service:1.4.0
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
```

**Correct (startup probe protects slow-starting app):**

```yaml
# ✅ Startup probe allows up to 60s for init before liveness kicks in
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: inventory-service
  template:
    metadata:
      labels:
        app: inventory-service
    spec:
      containers:
        - name: inventory-service
          image: registry.example.com/inventory-service:1.4.0
          ports:
            - containerPort: 8080
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            periodSeconds: 5
            failureThreshold: 3
```

Set `failureThreshold * periodSeconds` on the startup probe to cover the worst-case boot time for your application, and always pair it with separate liveness and readiness probes for runtime monitoring.
