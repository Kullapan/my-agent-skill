---
title: Separate application configuration from container images using ConfigMaps
impact: MEDIUM
impactDescription: Baking configuration into images requires a full rebuild and redeployment for every environment-specific change.
tags: kubernetes, openshift, configmap, configuration, twelve-factor
---

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
