# Kotlin WebFlux Best Practices

Guidelines for developing reactive applications using Spring WebFlux with Kotlin. WebFlux offers excellent performance for I/O-bound applications, but requires strict adherence to non-blocking principles. Kotlin Coroutines provide a significant ergonomic advantage over raw Project Reactor (`Flux`/`Mono`) APIs.

This skill is designed to be used by AI coding assistants to ensure generated code follows non-blocking reactive paradigms.

## Setup

These rules assume a standard Spring Boot 3+ WebFlux setup:

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactive")
    // Use R2DBC for reactive database access
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
}
```

## Installing to Another Project

To install this specific skill into a target project using the GitHub CLI (`gh`), navigate to your target project's root directory and run:

```bash
gh skill install <OWNER>/<REPO> kotlin-webflux-best-practices
```

### Prerequisites
- GitHub CLI (`gh`) v2.90.0 or later installed and authenticated.
- Replace `<OWNER>/<REPO>` with the path of the repository hosting this skill library (e.g., `your-org/shared-skills`).
