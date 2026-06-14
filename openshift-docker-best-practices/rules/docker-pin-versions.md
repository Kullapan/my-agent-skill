---
title: Pin base image versions instead of using latest tag
impact: HIGH
impactDescription: Using latest tags creates non-reproducible builds that may break without warning and introduce unpatched vulnerabilities.
tags: docker, base-image, versioning, reproducibility, security
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
