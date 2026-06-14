# OpenShift & Docker Best Practices

Guidelines for creating container images and Kubernetes manifests that comply with Red Hat OpenShift's strict security model.

This skill is designed to guide AI coding assistants when generating Dockerfiles, Helm charts, or Kubernetes YAML files intended for OpenShift environments.

## Overview

Unlike standard Kubernetes, OpenShift enforces `restricted` Security Context Constraints (SCC) by default. This means containers cannot run as the `root` user, cannot bind to privileged ports (< 1024), and must handle random high UID execution.

Furthermore, proper resource management (CPU/Memory limits) and health checks (Probes) are essential for cluster stability.

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> openshift-docker-best-practices
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).
