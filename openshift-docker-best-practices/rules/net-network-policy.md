---
title: Define NetworkPolicies for default-deny and least-privilege network access
impact: HIGH
impactDescription: Without NetworkPolicies, any compromised pod can freely communicate with every other pod in the cluster, enabling lateral movement.
tags: kubernetes, openshift, network-policy, security, zero-trust
---

## Define NetworkPolicies for default-deny and least-privilege network access

**Impact: HIGH**

By default, Kubernetes allows unrestricted pod-to-pod communication within a cluster. If an attacker compromises a single pod, they can reach every other pod — including databases, internal APIs, and control plane components. NetworkPolicies implement zero-trust networking by denying all traffic by default and explicitly allowing only required communication paths.

**Incorrect (no NetworkPolicy — all pods can communicate freely):**

```yaml
# ❌ No NetworkPolicy in the namespace — any pod can reach any other pod
apiVersion: v1
kind: Namespace
metadata:
  name: production
# Without NetworkPolicies:
#   - Compromised frontend pod can directly query the database
#   - Any pod can scan the internal network
#   - Lateral movement is trivial for attackers
```

**Correct (default-deny with explicit allow rules):**

```yaml
# ✅ Step 1: Default deny ALL ingress traffic in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}        # Applies to ALL pods in the namespace
  policyTypes:
    - Ingress             # Deny all incoming traffic by default

---
# ✅ Step 2: Allow specific traffic — frontend → backend on port 8080 only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend-api
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend          # Only frontend pods can reach backend
      ports:
        - protocol: TCP
          port: 8080                 # Only on port 8080

---
# ✅ Step 3: Allow backend → database on port 5432 only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-database
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend-api       # Only backend can reach the database
      ports:
        - protocol: TCP
          port: 5432
```

Start with `default-deny-ingress` and `default-deny-egress` policies, then add explicit allow rules. Test connectivity after each policy change using tools like `kubectl exec` and `netcat`.
