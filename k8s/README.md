# Raw Kubernetes manifests

`manifests.yaml` contains the full EPay platform as plain Kubernetes YAML:
Namespace-scoped ConfigMap, PostgreSQL StatefulSet, the API and indexer
Deployments, the three Next.js dashboards, Ingress, HPAs, PDBs, and
NetworkPolicies.

## This file is generated — do not hand-edit it

`helm/epay/` is the single source of truth. Regenerate with:

```bash
./scripts/render-k8s-manifests.sh
```

CI runs the same script and fails if `k8s/manifests.yaml` differs from the chart,
so the two can never drift.

## Apply

```bash
# 1. Create the namespace and the secrets the chart expects (the chart never
#    renders credentials).
kubectl create namespace epay

kubectl -n epay create secret generic epay-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  --from-literal=METRICS_TOKEN="$(openssl rand -hex 32)" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

kubectl -n epay create secret generic epay-postgres \
  --from-literal=password="$(openssl rand -hex 24)"

# 2. Apply. The chart is namespace-agnostic (like any Helm chart), so pass the
#    target namespace explicitly — the generated manifests carry no
#    metadata.namespace of their own.
kubectl apply -n epay -f k8s/manifests.yaml

# 3. Watch the rollout.
kubectl -n epay rollout status deploy/epay-epay-api
```

The `epay-postgres` Secret must exist **before** applying: both the StatefulSet
and the API read the same key, so the app and the database agree on the password.

## Why both Helm and raw manifests?

| Path                 | Use when                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `helm/epay/`         | You want values overrides, digest enforcement, and release history. This is the maintained path. |
| `k8s/manifests.yaml` | You deploy with `kubectl apply`, or you need to diff exactly what will hit the cluster.          |

Argo CD deploys the Helm chart (see `gitops/argocd-application.yaml`), not this
file.
