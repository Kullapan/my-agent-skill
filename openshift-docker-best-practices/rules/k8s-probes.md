---
title: Implement both liveness and readiness probes
impact: HIGH
impactDescription: Missing probes result in traffic being routed to unready pods or deadlocked pods remaining in the load balancer.
tags: kubernetes, openshift, probes, liveness, readiness, health-checks
---

## Implement both liveness and readiness probes

**Impact: HIGH**

Kubernetes and OpenShift rely on probes to manage pod lifecycles. 
- **Readiness Probes** tell the router when the pod is ready to accept traffic. Without this, OpenShift routes traffic to your pod the second the process starts, resulting in 502 Bad Gateway errors while your app finishes booting.
- **Liveness Probes** tell the kubelet if the pod is deadlocked and needs to be restarted.

**Incorrect (Missing probes):**

```yaml
# ❌ Deployment without health checks
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
        ports:
        - containerPort: 8080
        # 🚨 OpenShift will blindly send traffic and will never restart deadlocked pods
```

**Correct (Configured probes):**

```yaml
# ✅ Deployment with robust health checks
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
        ports:
        - containerPort: 8080
        
        # ✅ Liveness: "Am I deadlocked?" (Restart if this fails)
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
          
        # ✅ Readiness: "Am I ready for traffic?" (Remove from load balancer if this fails)
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          successThreshold: 1
          failureThreshold: 3
```

In Spring Boot, use `spring-boot-starter-actuator` with `management.endpoint.health.probes.enabled=true`. In Node.js, create explicit `/health/liveness` and `/health/readiness` endpoints.
