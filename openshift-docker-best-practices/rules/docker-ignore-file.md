---
title: Use .dockerignore to exclude unnecessary files from build context
impact: MEDIUM
impactDescription: Without .dockerignore, the entire project directory (including .git, node_modules, secrets) is sent to the Docker daemon, slowing builds and leaking sensitive files.
tags: docker, dockerignore, build-context, performance, security
---

## Use .dockerignore to exclude unnecessary files from build context

**Impact: MEDIUM**

When you run `docker build`, the entire directory tree is sent to the Docker daemon as the build context. Without a `.dockerignore` file, this includes `.git` (which can be hundreds of MB), `node_modules`, test files, documentation, `.env` files with secrets, and IDE configuration. This slows builds, bloats images, and can accidentally leak credentials into the final image.

**Incorrect (no .dockerignore — everything sent to build context):**

```dockerfile
# ❌ Without .dockerignore, COPY . . includes everything:
#   .git/          — 100-500MB of version history
#   node_modules/  — redundant, will be reinstalled
#   .env           — contains DATABASE_URL, API_KEY secrets!
#   test/          — test files not needed in production
#   *.md           — documentation not needed in production
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
# .env file with secrets is now baked into the image layer!
```

**Correct (proper .dockerignore file):**

```text
# ✅ .dockerignore — exclude unnecessary and sensitive files
# Version control
.git
.gitignore

# Dependencies (will be installed fresh in the image)
node_modules
vendor

# Environment and secrets
.env
.env.*
*.pem
*.key

# IDE and editor config
.idea
.vscode
*.swp
*.swo

# Tests and docs (not needed in production)
test/
tests/
__tests__/
*.test.js
*.spec.js
*.md
LICENSE
CHANGELOG.md

# Build artifacts and CI
docker-compose*.yml
Dockerfile*
.dockerignore
.github
coverage/
dist/
```

Always create a `.dockerignore` file at the project root before writing your Dockerfile. Review it regularly as new file types are added to the project.
