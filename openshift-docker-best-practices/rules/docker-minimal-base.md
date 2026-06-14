---
title: Use minimal or distroless base images for production
impact: HIGH
impactDescription: Full OS base images contain hundreds of unnecessary packages that increase attack surface and image size by 5-10x.
tags: docker, base-image, distroless, alpine, security, image-size
---

## Use minimal or distroless base images for production

**Impact: HIGH**

Full OS images like `ubuntu:24.04` or `node:22` include package managers, shells, and hundreds of system utilities that are never needed at runtime but dramatically increase the attack surface and image size. A compromised container with a shell and package manager allows attackers to install tools, explore the network, and escalate attacks. Distroless and Alpine-based images strip away everything except the language runtime.

**Incorrect (full OS base image with unnecessary tools):**

```dockerfile
# ❌ Full Ubuntu image — ~600MB+ with shell, package manager, and hundreds of tools
FROM ubuntu:24.04

RUN apt-get update
RUN apt-get install -y openjdk-21-jdk curl wget vim net-tools

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
