# Sections

## 1. OpenShift Security (SCC) (scc)

**Impact:** CRITICAL
**Description:** OpenShift prevents containers from running as `root`. Dockerfiles must assign appropriate group permissions (`chgrp -R 0`) to allow the arbitrary high UID assigned by OpenShift to read and write necessary files.

## 2. Dockerfile Optimization (docker)

**Impact:** HIGH
**Description:** Production images should be as small as possible. Avoid shipping source code, compilers, or build tools in your final image by using Docker multi-stage builds.

## 3. Resource Management (k8s)

**Impact:** HIGH
**Description:** Deployments must define resource requests and limits to prevent noisy neighbors and cluster OutOfMemory (OOM) events. Liveness and readiness probes are required for zero-downtime deployments.
