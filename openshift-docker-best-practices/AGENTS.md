# Openshift Docker Best Practices

> **Version:** 1.0.0

## Table of Contents

1. [Dockerfile Optimization](#section-1)
2. [Resource Management](#section-2)
3. [OpenShift Security (SCC)](#section-3)

---

## 1. Dockerfile Optimization {#section-1}

**Impact:** UNKNOWN

## Use multi-stage builds to optimize image size and security

**Impact: HIGH**

Production container images should only contain the compiled artifact and the minimal runtime required to execute it. Including source code, testing frameworks, and build tools (like `maven`, `gcc`, or `npm`) inside the final image increases the surface area for CVEs and slows down OpenShift deployments due to massive image sizes.

**Incorrect (Single-stage build):**

```dockerfile
# ❌ Pulls the heavy JDK, copies all source code, builds, and runs in the same image
FROM maven:3.9-eclipse-temurin-17
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# 🚨 The final image contains the JDK, Maven, and all original source code!
CMD ["java", "-jar", "target/myapp.jar"]
```

**Correct (Multi-stage build):**

```dockerfile
# ✅ Stage 1: Build Environment (heavy, contains tools)
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
# Cache dependencies
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

# ✅ Stage 2: Minimal Production Runtime (JRE only, no source code)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy ONLY the compiled artifact from the builder stage
COPY --from=builder /app/target/myapp.jar ./myapp.jar

# Apply OpenShift SCC permissions
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001

CMD ["java", "-jar", "myapp.jar"]
```

Multi-stage builds drastically reduce image sizes (e.g., from 800MB to 150MB) and inherently reduce vulnerability counts in SCA scans (like Trivy or JFrog Xray).

---

## 2. Resource Management {#section-2}

**Impact:** UNKNOWN

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

---

## 3. OpenShift Security (SCC) {#section-3}

**Impact:** UNKNOWN

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

---
