# Sections

## 1. OpenShift Security / SCC (scc)

**Impact:** CRITICAL
**Description:** OpenShift enforces Security Context Constraints (SCC) that restrict container privileges. Containers must run as non-root, drop unnecessary capabilities, and use read-only filesystems to meet the `restricted-v2` SCC baseline.

## 2. Dockerfile Optimization (docker)

**Impact:** HIGH
**Description:** Production Dockerfiles must produce minimal, reproducible, and secure images. Multi-stage builds, version pinning, layer caching, and .dockerignore reduce image size, build time, and attack surface.

## 3. Resource Management (k8s)

**Impact:** HIGH
**Description:** Every container must define resource requests and limits, health probes, and graceful shutdown behavior. Missing configuration causes cluster instability, failed deployments, and data loss during rollouts.

## 4. Secrets & Configuration (secrets)

**Impact:** CRITICAL
**Description:** Secrets must never appear in Dockerfiles, YAML manifests, or environment variables in source control. Use Kubernetes Secrets, external secret operators, or vault injection. Application configuration should be externalized via ConfigMaps.

## 5. Networking & Traffic (net)

**Impact:** HIGH
**Description:** Network traffic must be restricted by default using NetworkPolicies. External services must use TLS termination via OpenShift Routes or Kubernetes Ingress with proper certificate management.

## 6. Deployment Strategies (deploy)

**Impact:** HIGH
**Description:** Production deployments must use rolling update strategies with PodDisruptionBudgets and rollout safeguards to achieve zero-downtime releases and automatic rollback on failure.

## 7. CI/CD & Supply Chain (cicd)

**Impact:** HIGH
**Description:** Container images must be scanned for known vulnerabilities before deployment. CI/CD pipelines should fail builds on critical CVEs to prevent shipping vulnerable software to production.
