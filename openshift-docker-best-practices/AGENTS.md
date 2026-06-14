# Openshift Docker Best Practices

> **Version:** 2.0.0

## Table of Contents

1. [CI/CD & Supply Chain](#section-1)
2. [Deployment Strategies](#section-2)
3. [Dockerfile Optimization](#section-3)
4. [Resource Management](#section-4)
5. [Networking & Traffic](#section-5)
6. [OpenShift Security / SCC](#section-6)
7. [Secrets & Configuration](#section-7)

---

## 1. CI/CD & Supply Chain {#section-1}

**Impact:** HIGH
**Description:** Container images must be scanned for known vulnerabilities before deployment. CI/CD pipelines should fail builds on critical CVEs to prevent shipping vulnerable software to production.

## Scan container images for vulnerabilities in CI/CD pipelines

**Impact: HIGH**

Container images inherit vulnerabilities from their base OS packages, language runtimes, and application dependencies. Without scanning, known CVEs with public exploits ship directly to production. Integrating image scanning into the CI/CD pipeline catches critical vulnerabilities before deployment and provides an auditable record of the security posture of every image.

**Incorrect (build and push without scanning):**

```yaml
# ❌ GitHub Actions pipeline that builds and deploys without any security scanning
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t registry.example.com/app:${{ github.sha }} .

      # No scanning step — CVEs ship directly to production!

      - name: Push image
        run: docker push registry.example.com/app:${{ github.sha }}

      - name: Deploy to OpenShift
        run: oc set image deployment/app app=registry.example.com/app:${{ github.sha }}
```

**Correct (scan with Trivy and fail on critical vulnerabilities):**

```yaml
# ✅ GitHub Actions pipeline with Trivy vulnerability scanning
name: Build, Scan, and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t registry.example.com/app:${{ github.sha }} .

      # ✅ Scan the image for OS and library vulnerabilities
      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: registry.example.com/app:${{ github.sha }}
          format: table
          exit-code: 1               # Fail the build if vulnerabilities found
          severity: CRITICAL,HIGH     # Only fail on CRITICAL and HIGH CVEs
          ignore-unfixed: true        # Skip CVEs with no available fix

      - name: Push image
        run: docker push registry.example.com/app:${{ github.sha }}

      - name: Deploy to OpenShift
        run: oc set image deployment/app app=registry.example.com/app:${{ github.sha }}
```

```bash
# ✅ Local/generic scanning with Trivy CLI
trivy image --severity CRITICAL,HIGH --exit-code 1 registry.example.com/app:latest

# ✅ Alternative: Grype scanner
grype registry.example.com/app:latest --fail-on high
```

Scan images in CI before pushing to the registry. Consider also scanning at admission time using OpenShift's image policy or Kubernetes admission controllers (Kyverno, OPA Gatekeeper).

---

## 2. Deployment Strategies {#section-2}

**Impact:** HIGH
**Description:** Production deployments must use rolling update strategies with PodDisruptionBudgets and rollout safeguards to achieve zero-downtime releases and automatic rollback on failure.

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

---

## 3. Dockerfile Optimization {#section-3}

**Impact:** HIGH
**Description:** Production Dockerfiles must produce minimal, reproducible, and secure images. Multi-stage builds, version pinning, layer caching, and .dockerignore reduce image size, build time, and attack surface.

## Use .dockerignore to exclude unnecessary files from build context

**Impact: MEDIUM**

When you run `docker build`, the entire directory tree is sent to the Docker daemon as the build context. Without a `.dockerignore` file, this includes `.git` (which can be hundreds of MB), `node_modules`, test files, documentation, `.env` files with secrets, and IDE configuration. This slows builds, bloats images, and can accidentally leak credentials into the final image.

**Incorrect (no .dockerignore — everything sent to build context):**

```dockerfile
# ❌ Without .dockerignore, COPY . . includes everything:
#   .git/          — 100-500MB of version history
#   node_modules/  — redundant, will be reinstalled
#   .env           — contains DATABASE_URL, API_KEY secrets!
#   test/          — test files not needed in production
#   *.md           — documentation not needed in production
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
# .env file with secrets is now baked into the image layer!
```

**Correct (proper .dockerignore file):**

```text
# ✅ .dockerignore — exclude unnecessary and sensitive files
# Version control
.git
.gitignore

# Dependencies (will be installed fresh in the image)
node_modules
vendor

# Environment and secrets
.env
.env.*
*.pem
*.key

# IDE and editor config
.idea
.vscode
*.swp
*.swo

# Tests and docs (not needed in production)
test/
tests/
__tests__/
*.test.js
*.spec.js
*.md
LICENSE
CHANGELOG.md

# Build artifacts and CI
docker-compose*.yml
Dockerfile*
.dockerignore
.github
coverage/
dist/
```

Always create a `.dockerignore` file at the project root before writing your Dockerfile. Review it regularly as new file types are added to the project.

---

## Order Dockerfile instructions to maximize layer caching

**Impact: MEDIUM**

Docker caches each instruction as a layer. If a layer changes, all subsequent layers are rebuilt. Placing frequently changing instructions (like `COPY . .`) before dependency installation means every code change re-downloads and re-installs all dependencies. Ordering instructions from least to most frequently changing maximizes cache hits and can reduce build times from minutes to seconds.

**Incorrect (cache busted on every code change):**

```dockerfile
# ❌ COPY . . before dependency install — any code change re-runs npm install
FROM node:22-alpine
WORKDIR /app

# This copies EVERYTHING — including source code
COPY . .

# npm install runs on every build, even if only a .js file changed
RUN npm install

EXPOSE 8080
CMD ["node", "server.js"]
```

**Correct (dependency files copied first for cache-friendly builds):**

```dockerfile
# ✅ Copy dependency manifests first, then install, then copy source code
FROM node:22-alpine
WORKDIR /app

# Step 1: Copy only dependency files (changes rarely)
COPY package.json package-lock.json ./

# Step 2: Install dependencies (cached unless package files change)
RUN npm ci --omit=dev

# Step 3: Copy source code (changes frequently, but doesn't bust dependency cache)
COPY . .

EXPOSE 8080
USER 1001
CMD ["node", "server.js"]

# ✅ Same pattern for Java/Gradle:
# COPY build.gradle.kts settings.gradle.kts ./
# COPY gradle ./gradle
# RUN ./gradlew dependencies --no-daemon
# COPY src ./src
# RUN ./gradlew bootJar --no-daemon
```

Place `RUN apt-get install`, dependency installation, and other slow operations early in the Dockerfile. Place `COPY . .` (source code) as late as possible.

---

## Use minimal or distroless base images for production

**Impact: HIGH**

Full OS images like `ubuntu:24.04` or `node:22` include package managers, shells, and hundreds of system utilities that are never needed at runtime but dramatically increase the attack surface and image size. A compromised container with a shell and package manager allows attackers to install tools, explore the network, and escalate attacks. Distroless and Alpine-based images strip away everything except the language runtime.

**Incorrect (full OS base image with unnecessary tools):**

```dockerfile
# ❌ Full Ubuntu image — ~600MB+ with shell, package manager, and hundreds of tools
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    openjdk-21-jdk \
    curl \
    wget \
    vim \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

COPY target/app.jar /app/app.jar
WORKDIR /app

# Shell, curl, wget, vim are all available to an attacker
CMD ["java", "-jar", "app.jar"]
```

**Correct (distroless or Alpine-based minimal image):**

```dockerfile
# ✅ Option 1: Distroless — no shell, no package manager, ~100MB
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./gradlew bootJar

FROM gcr.io/distroless/java21-debian12
COPY --from=build /app/build/libs/app.jar /app/app.jar
WORKDIR /app
USER 1001
ENTRYPOINT ["java", "-jar", "app.jar"]

# ✅ Option 2: JRE-only Alpine — minimal shell, ~120MB
# FROM eclipse-temurin:21-jre-alpine
# COPY --from=build /app/build/libs/app.jar /app/app.jar
# USER 1001
# ENTRYPOINT ["java", "-jar", "app.jar"]
```

Prefer distroless for maximum security (no shell access). Use Alpine when you need a minimal shell for debugging. Image size comparison: `ubuntu` ~600MB → `alpine` ~120MB → `distroless` ~100MB.

---

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

## Pin base image versions instead of using latest tag

**Impact: HIGH**

Using the `latest` tag means your build can pull a completely different image tomorrow than it did today, leading to non-reproducible builds and unpredictable failures. A base image update may introduce breaking changes, incompatible libraries, or unpatched CVEs without any visible change in your Dockerfile. Pinning to a specific version or digest ensures every build produces the same artifact and gives you full control over when to upgrade.

**Incorrect (using latest tag — non-reproducible):**

```dockerfile
# ❌ latest tag resolves to a different image on every pull
FROM node:latest
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```dockerfile
# ❌ Same problem with Java — builds break when OpenJDK bumps a major version
FROM openjdk:latest
WORKDIR /app
COPY build/libs/myservice.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Correct (pinned version or digest — reproducible):**

```dockerfile
# ✅ Pin to an exact version and minimal variant
FROM node:22.5.1-alpine3.20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# ✅ Or pin by digest for maximum reproducibility
FROM node@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Always pin your base images to a specific version tag (e.g., `node:22.5.1-alpine3.20`) or, for maximum reproducibility, use a SHA256 digest. Review and update pinned versions on a regular cadence to pick up security patches.

---

## 4. Resource Management {#section-4}

**Impact:** HIGH
**Description:** Every container must define resource requests and limits, health probes, and graceful shutdown behavior. Missing configuration causes cluster instability, failed deployments, and data loss during rollouts.

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

---

## 5. Networking & Traffic {#section-5}

**Impact:** HIGH
**Description:** Network traffic must be restricted by default using NetworkPolicies. External services must use TLS termination via OpenShift Routes or Kubernetes Ingress with proper certificate management.

## Define NetworkPolicies for default-deny and least-privilege network access

**Impact: HIGH**

By default, Kubernetes allows unrestricted pod-to-pod communication within a cluster. If an attacker compromises a single pod, they can reach every other pod — including databases, internal APIs, and control plane components. NetworkPolicies implement zero-trust networking by denying all traffic by default and explicitly allowing only required communication paths.

**Incorrect (no NetworkPolicy — all pods can communicate freely):**

```yaml
# ❌ No NetworkPolicy in the namespace — any pod can reach any other pod
apiVersion: v1
kind: Namespace
metadata:
  name: production
# Without NetworkPolicies:
#   - Compromised frontend pod can directly query the database
#   - Any pod can scan the internal network
#   - Lateral movement is trivial for attackers
```

**Correct (default-deny with explicit allow rules):**

```yaml
# ✅ Step 1: Default deny ALL ingress traffic in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}        # Applies to ALL pods in the namespace
  policyTypes:
    - Ingress             # Deny all incoming traffic by default

---
# ✅ Step 2: Allow specific traffic — frontend → backend on port 8080 only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend-api
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend          # Only frontend pods can reach backend
      ports:
        - protocol: TCP
          port: 8080                 # Only on port 8080

---
# ✅ Step 3: Allow backend → database on port 5432 only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-database
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend-api       # Only backend can reach the database
      ports:
        - protocol: TCP
          port: 5432
```

Start with `default-deny-ingress` and `default-deny-egress` policies, then add explicit allow rules. Test connectivity after each policy change using tools like `kubectl exec` and `netcat`.

---

## Use appropriate service types and configure TLS for external traffic

**Impact: MEDIUM**

Using `NodePort` or `LoadBalancer` service types without TLS exposes traffic in plain text across the network. NodePort also exposes high ports directly on cluster nodes, bypassing ingress controllers and their security policies. Internal services should use `ClusterIP` (unreachable from outside the cluster), while external services should be exposed through OpenShift Routes or Kubernetes Ingress with TLS termination.

**Incorrect (NodePort with no TLS):**

```yaml
# ❌ NodePort exposes the service on every node's IP — no TLS, no access control
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: NodePort           # Exposed on a random high port on every node
  selector:
    app: api-server
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080       # Accessible at http://<any-node-ip>:30080
# Traffic is unencrypted
# No rate limiting, WAF, or access control
# Port must be opened in firewall on every node
```

**Correct (ClusterIP with OpenShift Route / Ingress TLS):**

```yaml
# ✅ Internal service — ClusterIP (default, not accessible from outside)
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: ClusterIP           # Only accessible within the cluster
  selector:
    app: api-server
  ports:
    - port: 8080
      targetPort: 8080

---
# ✅ OpenShift Route with edge TLS termination
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: api-route
spec:
  to:
    kind: Service
    name: api-service
  port:
    targetPort: 8080
  tls:
    termination: edge                     # TLS terminated at the router
    insecureEdgeTerminationPolicy: Redirect  # HTTP → HTTPS redirect

# Alternative: Kubernetes Ingress with cert-manager TLS
# apiVersion: networking.k8s.io/v1
# kind: Ingress
# metadata:
#   name: api-ingress
#   annotations:
#     cert-manager.io/cluster-issuer: letsencrypt-prod
# spec:
#   tls:
#     - hosts: [api.example.com]
#       secretName: api-tls-cert
#   rules:
#     - host: api.example.com
#       http:
#         paths:
#           - path: /
#             pathType: Prefix
#             backend:
#               service:
#                 name: api-service
#                 port:
#                   number: 8080
```

Use `ClusterIP` for all internal services. Expose external services through Routes or Ingress with TLS. Never use `NodePort` in production.

---

## 6. OpenShift Security / SCC {#section-6}

**Impact:** CRITICAL
**Description:** OpenShift enforces Security Context Constraints (SCC) that restrict container privileges. Containers must run as non-root, drop unnecessary capabilities, and use read-only filesystems to meet the `restricted-v2` SCC baseline.

## Drop all Linux capabilities and add only what is needed

**Impact: HIGH**

Linux capabilities split root's monolithic power into ~40 individual privileges. By default, containers retain a subset of these (e.g., `NET_RAW`, `MKNOD`, `AUDIT_WRITE`) that can be exploited for ARP spoofing, packet sniffing, or device creation. Dropping all capabilities and selectively adding back only what's required follows the principle of least privilege and is required by OpenShift's `restricted-v2` SCC.

**Incorrect (no capability restrictions):**

```yaml
# ❌ No capabilities block — container retains default capabilities including NET_RAW
apiVersion: v1
kind: Pod
metadata:
  name: api-server
spec:
  containers:
    - name: api-server
      image: registry.example.com/api:2.1.0
      ports:
        - containerPort: 8080
      securityContext:
        runAsNonRoot: true
        # No capabilities block — defaults include:
        # NET_RAW (ARP spoofing), MKNOD (device creation),
        # AUDIT_WRITE, FOWNER, SETUID, SETGID, etc.
```

**Correct (drop all, add back only what's needed):**

```yaml
# ✅ Drop ALL capabilities, add back only the minimum required
apiVersion: v1
kind: Pod
metadata:
  name: api-server
spec:
  containers:
    - name: api-server
      image: registry.example.com/api:2.1.0
      ports:
        - containerPort: 8080
      securityContext:
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL          # Remove every Linux capability
          # Only add back capabilities if absolutely required:
          # add:
          #   - NET_BIND_SERVICE  # Only if binding to ports < 1024
```

Most applications need zero capabilities. Only add back specific capabilities with a documented justification. Common legitimate additions include `NET_BIND_SERVICE` (binding to privileged ports) — but prefer using ports > 1024 instead.

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

---

## 7. Secrets & Configuration {#section-7}

**Impact:** CRITICAL
**Description:** Secrets must never appear in Dockerfiles, YAML manifests, or environment variables in source control. Use Kubernetes Secrets, external secret operators, or vault injection. Application configuration should be externalized via ConfigMaps.

## Separate application configuration from container images using ConfigMaps

**Impact: MEDIUM**

Configuration embedded in Docker images via `COPY config.yaml /app/` violates the Twelve-Factor App principle of strict separation between config and code. Every environment (dev, staging, production) requires a separate image build, increasing CI time and risk of deploying dev config to production. ConfigMaps allow the same image to run in any environment with environment-specific configuration injected at deployment time.

**Incorrect (configuration baked into the image):**

```dockerfile
# ❌ Config baked into the image — requires rebuild per environment
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Environment-specific config is part of the image
COPY config/production.yaml /app/config.yaml

# Changing database host requires a full image rebuild and push
CMD ["node", "server.js"]
```

**Correct (ConfigMap mounted as volume or projected as env vars):**

```yaml
# ✅ ConfigMap with environment-specific configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  config.yaml: |
    server:
      port: 8080
    database:
      host: prod-db.internal.example.com
      pool-size: 20
    logging:
      level: INFO

---
# ✅ Mount ConfigMap as a file — same image works in all environments
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
        - name: api-server
          image: registry.example.com/api:2.0.0   # Same image for all envs
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: app-config    # Different ConfigMap per namespace/environment
```

Use separate ConfigMaps per namespace (dev, staging, production) to configure the same image. For sensitive values, use Secrets instead of ConfigMaps.

---

## Never hardcode secrets in Dockerfiles or deployment manifests

**Impact: CRITICAL**

Secrets placed in Dockerfiles via `ENV` or `ARG` are permanently stored in image layers — even if deleted in a later layer, they remain in the layer history accessible via `docker history`. Secrets in YAML manifests committed to version control are visible to anyone with repository access. Both patterns have led to major data breaches. Use Kubernetes Secrets, external secret operators, or vault injection instead.

**Incorrect (secrets hardcoded in Dockerfile and YAML):**

```dockerfile
# ❌ Secrets baked into image layers — visible via `docker history`
FROM node:22-alpine
WORKDIR /app

ENV DB_HOST=prod-db.internal.example.com
ENV DB_PASSWORD=super_secret_password_123
ENV API_KEY=sk-live-abc123xyz789

COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
```

```yaml
# ❌ Secrets in plain text in deployment YAML — committed to git
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: DB_PASSWORD
              value: "super_secret_password_123"   # Plain text in version control!
            - name: API_KEY
              value: "sk-live-abc123xyz789"
```

**Correct (secrets managed via Kubernetes Secrets):**

```yaml
# ✅ Step 1: Create a Secret (or use External Secrets Operator / Sealed Secrets)
apiVersion: v1
kind: Secret
metadata:
  name: app-credentials
type: Opaque
stringData:
  db-password: "super_secret_password_123"    # base64-encoded at rest
  api-key: "sk-live-abc123xyz789"

---
# ✅ Step 2: Reference secrets in Deployment — never inline values
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-credentials
                  key: db-password
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: app-credentials
                  key: api-key
          # Alternative: mount all secrets as files
          # volumeMounts:
          #   - name: secrets
          #     mountPath: /etc/secrets
          #     readOnly: true
```

For production, use an external secret management system (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault) with operators like External Secrets Operator or Sealed Secrets to avoid storing Secret manifests in git.

---
