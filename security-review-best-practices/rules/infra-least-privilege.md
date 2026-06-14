---
title: Apply Least Privilege to Service Accounts and IAM Roles
impact: MEDIUM
impactDescription: CWE-250 — OWASP A01 Broken Access Control
tags: security, infrastructure, iam, least-privilege, cloud, aws, service-accounts
---

## Apply Least Privilege to Service Accounts and IAM Roles

**Impact: MEDIUM — CWE-250**

Overly permissive IAM roles and service accounts amplify the blast radius of any compromise. If a Lambda function is compromised and has `AdministratorAccess`, the attacker owns your entire AWS account. Scope every role to only the specific actions and resources it actually uses.

**Vulnerable (overly permissive IAM):**

```json
// ❌ Lambda execution role with full admin — one compromise = full account takeover
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}

// ❌ App connects to DB with root credentials
// DATABASE_URL=postgresql://root:password@db.example.com/mydb
// Root can DROP TABLE, CREATE USER, GRANT — far more than app needs
```

**Secure (minimal permission policy scoped to exact resources):**

```json
// ✅ Lambda role — only the S3 bucket and operations it needs
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-app-uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789:secret:prod/myapp/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/my-function:*"
    }
  ]
}
```

```sql
-- ✅ DB user with only the permissions the app needs
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- NOT GRANTED: DROP, CREATE TABLE, ALTER, TRUNCATE, pg_read_file

-- ✅ Read-only user for analytics/reporting
CREATE USER analytics_user WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;
```

```typescript
// ✅ Use environment-specific roles
// Development: ReadOnly access to dev resources
// Staging: Write access to staging resources only
// Production: Write access to prod, never cross-account

// ✅ Rotate service account credentials regularly
// Use IAM roles (not access keys) wherever possible — no key rotation needed
```

Review IAM policies with AWS IAM Access Analyzer or similar tools. Enable CloudTrail for all API calls. Alert on `iam:CreateUser`, `iam:AttachRolePolicy`, and `s3:PutBucketPolicy` events.

Reference: [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
