---
name: openshift-docker-best-practices
description: Best practices for containerization and deployment to Red Hat OpenShift. Focuses on Dockerfile optimization, SCC (Security Context Constraints) compliance, non-root users, and Kubernetes resources.
license: MIT
metadata:
  author: "Platform Engineering"
  version: "1.0.0"
  tags: [docker, openshift, kubernetes, containers, security, scc, devops]
---

# OpenShift & Docker Best Practices

Guidelines for creating Docker images and Kubernetes manifests tailored for Red Hat OpenShift. OpenShift is more secure by default than vanilla Kubernetes, strictly enforcing Security Context Constraints (SCC) such as preventing containers from running as `root`.

## When to Apply

Apply these rules when:
- Writing `Dockerfile`s for applications
- Defining Kubernetes Deployments or DeploymentConfigs
- Configuring liveness and readiness probes
- Setting CPU and memory limits

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | OpenShift Security (SCC) | CRITICAL | `scc-` |
| 2 | Dockerfile Optimization | HIGH | `docker-` |
| 3 | Resource Management | HIGH | `k8s-` |

## Quick Reference

### 1. OpenShift Security (SCC) (CRITICAL)
- `scc-non-root` — Never run as root; OpenShift assigns a random high UID

### 2. Dockerfile Optimization (HIGH)
- `docker-multi-stage` — Use multi-stage builds to keep production images small and free of build tools

### 3. Resource Management (HIGH)
- `k8s-probes` — Implement both liveness and readiness probes
- `k8s-resource-limits` — Always define CPU and memory requests and limits

## How to Use

Read individual rule files for detailed explanations and code examples.
