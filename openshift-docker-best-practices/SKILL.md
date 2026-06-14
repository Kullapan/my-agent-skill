---
name: openshift-docker-best-practices
description: Best practices for containerization and deployment to Red Hat OpenShift and Kubernetes. Covers Dockerfile optimization, SCC compliance, security context hardening, secrets management, networking policies, deployment strategies, resource management, and CI/CD supply chain security.
license: MIT
metadata:
  author: "Platform Engineering"
  version: "2.0.0"
  tags: [docker, openshift, kubernetes, containers, security, scc, devops, networking, deployment, secrets, cicd, supply-chain]
---

# OpenShift & Docker Best Practices

Guidelines for building secure container images and deploying applications to OpenShift and Kubernetes clusters. These rules prevent security misconfigurations, deployment downtime, secret leaks, and cluster instability caused by missing resource limits and network policies.

## When to Apply

Apply these rules when:
- Writing Dockerfiles for production applications
- Creating Kubernetes/OpenShift Deployment manifests
- Configuring pod security contexts and SCC compliance
- Managing secrets and application configuration
- Setting up networking policies and service exposure
- Configuring deployment strategies and rollout safeguards
- Building CI/CD pipelines with image scanning

## Rule Categories by Priority

| Priority | Category | Severity | Prefix |
|----------|----------|----------|--------|
| 1 | OpenShift Security / SCC | CRITICAL | `scc-` |
| 2 | Secrets & Configuration | CRITICAL | `secrets-` |
| 3 | Dockerfile Optimization | HIGH | `docker-` |
| 4 | Resource Management | HIGH | `k8s-` |
| 5 | Networking & Traffic | HIGH | `net-` |
| 6 | Deployment Strategies | HIGH | `deploy-` |
| 7 | CI/CD & Supply Chain | HIGH | `cicd-` |

## Quick Reference

### 1. OpenShift Security / SCC (CRITICAL)
- `scc-non-root` — Ensure containers run without root privileges (OpenShift SCC)
- `scc-security-context` — Configure SecurityContext to enforce non-root and prevent privilege escalation
- `scc-drop-capabilities` — Drop all Linux capabilities and add only what is needed
- `scc-readonly-fs` — Use read-only root filesystem to prevent runtime tampering

### 2. Secrets & Configuration (CRITICAL)
- `secrets-no-hardcode` — Never hardcode secrets in Dockerfiles or deployment manifests
- `secrets-configmap` — Separate application configuration from container images using ConfigMaps

### 3. Dockerfile Optimization (HIGH)
- `docker-multi-stage` — Use multi-stage builds to optimize image size and security
- `docker-pin-versions` — Pin base image versions instead of using latest tag
- `docker-minimal-base` — Use minimal or distroless base images for production
- `docker-layer-caching` — Order Dockerfile instructions to maximize layer caching
- `docker-ignore-file` — Use .dockerignore to exclude unnecessary files from build context

### 4. Resource Management (HIGH)
- `k8s-resource-limits` — Always define CPU and memory requests and limits
- `k8s-probes` — Implement both liveness and readiness probes
- `k8s-startup-probe` — Use startup probes for slow-starting applications
- `k8s-graceful-shutdown` — Handle SIGTERM for graceful shutdown during pod termination

### 5. Networking & Traffic (HIGH)
- `net-network-policy` — Define NetworkPolicies for default-deny and least-privilege network access
- `net-service-exposure` — Use appropriate service types and configure TLS for external traffic

### 6. Deployment Strategies (HIGH)
- `deploy-rolling-update` — Configure rolling update strategy with PodDisruptionBudgets for zero-downtime deployments
- `deploy-health-gates` — Use minReadySeconds and progress deadlines to prevent bad rollouts

### 7. CI/CD & Supply Chain (HIGH)
- `cicd-image-scanning` — Scan container images for vulnerabilities in CI/CD pipelines

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/scc-non-root.md
rules/docker-multi-stage.md
rules/secrets-no-hardcode.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code/config example with explanation
- Correct code/config example with explanation
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
