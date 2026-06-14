---
title: Use multi-stage builds to optimize image size and security
impact: HIGH
impactDescription: Shipping compilers and source code in production images increases the attack surface and slows down deployments.
tags: docker, multi-stage, build, optimization, security, image-size
---

## Use multi-stage builds to optimize image size and security

**Impact: HIGH**

Production container images should only contain the compiled artifact and the minimal runtime required to execute it. Including source code, testing frameworks, and build tools (like `maven`, `gcc`, or `npm`) inside the final image increases the surface area for CVEs and slows down OpenShift deployments due to massive image sizes.

**Incorrect (Single-stage build):**

```dockerfile
# ❌ Pulls the heavy JDK, copies all source code, builds, and runs in the same image
FROM maven:3.9-eclipse-temurin-17
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# 🚨 The final image contains the JDK, Maven, and all original source code!
CMD ["java", "-jar", "target/myapp.jar"]
```

**Correct (Multi-stage build):**

```dockerfile
# ✅ Stage 1: Build Environment (heavy, contains tools)
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
# Cache dependencies
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

# ✅ Stage 2: Minimal Production Runtime (JRE only, no source code)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy ONLY the compiled artifact from the builder stage
COPY --from=builder /app/target/myapp.jar ./myapp.jar

# Apply OpenShift SCC permissions
RUN chgrp -R 0 /app
RUN chmod -R g=u /app
USER 1001

CMD ["java", "-jar", "myapp.jar"]
```

Multi-stage builds drastically reduce image sizes (e.g., from 800MB to 150MB) and inherently reduce vulnerability counts in SCA scans (like Trivy or JFrog Xray).
