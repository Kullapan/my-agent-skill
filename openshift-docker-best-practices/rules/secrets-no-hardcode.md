---
title: Never hardcode secrets in Dockerfiles or deployment manifests
impact: CRITICAL
impactDescription: Hardcoded secrets are permanently baked into image layers and version history, accessible to anyone with image pull or repository access.
tags: security, secrets, docker, kubernetes, vault, hardcoded-credentials
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
