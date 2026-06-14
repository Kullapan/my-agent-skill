---
title: Order Dockerfile instructions to maximize layer caching
impact: MEDIUM
impactDescription: Poor instruction ordering busts the Docker layer cache on every code change, increasing build times from seconds to minutes.
tags: docker, layer-caching, build-performance, optimization
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
