# Kotlin RESTful Best Practices

Guidelines for developing traditional Spring Boot REST APIs using Kotlin. This skill focuses on taking full advantage of Kotlin's language features (like data classes, extension functions, and null safety) to write concise, safe, and maintainable controllers and API contracts.

This skill is designed for AI coding assistants to generate idiomatic Kotlin Spring MVC code.

## Setup

These rules apply to standard Spring Boot MVC projects:

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
}
```

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> kotlin-restful-best-practices
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).
