---
title: Use appropriate service types and configure TLS for external traffic
impact: MEDIUM
impactDescription: Exposing services without TLS transmits credentials and data in plain text, and using NodePort bypasses load balancing and firewall controls.
tags: kubernetes, openshift, service, route, ingress, tls
---

## Use appropriate service types and configure TLS for external traffic

**Impact: MEDIUM**

Using `NodePort` or `LoadBalancer` service types without TLS exposes traffic in plain text across the network. NodePort also exposes high ports directly on cluster nodes, bypassing ingress controllers and their security policies. Internal services should use `ClusterIP` (unreachable from outside the cluster), while external services should be exposed through OpenShift Routes or Kubernetes Ingress with TLS termination.

**Incorrect (NodePort with no TLS):**

```yaml
# ❌ NodePort exposes the service on every node's IP — no TLS, no access control
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: NodePort           # Exposed on a random high port on every node
  selector:
    app: api-server
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080       # Accessible at http://<any-node-ip>:30080
# Traffic is unencrypted
# No rate limiting, WAF, or access control
# Port must be opened in firewall on every node
```

**Correct (ClusterIP with OpenShift Route / Ingress TLS):**

```yaml
# ✅ Internal service — ClusterIP (default, not accessible from outside)
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: ClusterIP           # Only accessible within the cluster
  selector:
    app: api-server
  ports:
    - port: 8080
      targetPort: 8080

---
# ✅ OpenShift Route with edge TLS termination
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: api-route
spec:
  to:
    kind: Service
    name: api-service
  port:
    targetPort: 8080
  tls:
    termination: edge                     # TLS terminated at the router
    insecureEdgeTerminationPolicy: Redirect  # HTTP → HTTPS redirect

# Alternative: Kubernetes Ingress with cert-manager TLS
# apiVersion: networking.k8s.io/v1
# kind: Ingress
# metadata:
#   name: api-ingress
#   annotations:
#     cert-manager.io/cluster-issuer: letsencrypt-prod
# spec:
#   tls:
#     - hosts: [api.example.com]
#       secretName: api-tls-cert
#   rules:
#     - host: api.example.com
#       http:
#         paths:
#           - path: /
#             pathType: Prefix
#             backend:
#               service:
#                 name: api-service
#                 port:
#                   number: 8080
```

Use `ClusterIP` for all internal services. Expose external services through Routes or Ingress with TLS. Never use `NodePort` in production.
