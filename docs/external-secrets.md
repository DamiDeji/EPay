# External Secrets

How EPay gets its credentials in Kubernetes without ever storing them in git or in
a long-lived Kubernetes Secret.

## The problem

The Helm chart mounts a Secret named `epay-secrets` (`.Values.secrets.existingSecret`)
into the API, indexer, and dashboards. Something has to populate it. The options,
ranked by how much damage a compromise does:

| Approach                             | Verdict                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Literal values in `values.yaml`      | ❌ Never. The file is in git; the secret is now public forever.                                                                         |
| Hand-created `kubectl create secret` | ⚠️ Works, but nobody knows the provenance, rotation is manual, and it drifts.                                                           |
| Sealed Secrets                       | ✅ Good for small teams; secrets live encrypted in git. Rotating still means a commit.                                                  |
| **External Secrets Operator (ESO)**  | ✅ **What this repo ships.** The source of truth is your cloud secret manager; the Kubernetes Secret is a cache the operator refreshes. |

With ESO, the credential's lifecycle lives where you already rotate credentials
(AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, …) and Kubernetes
simply follows. Removing a secret from the manager removes it from the cluster.

## How it is wired here

`helm/epay/templates/external-secrets.yaml` renders one `ExternalSecret` when
`externalSecrets.enabled=true`. It:

1. reads keys from `externalSecrets.remoteKey` (e.g. `epay/production`) in the
   store named by `externalSecrets.secretStoreRef`,
2. writes them into the Secret `externalSecrets.targetSecret`
   (**must** equal `secrets.existingSecret`, default `epay-secrets`), and
3. refreshes every `externalSecrets.refreshInterval` (default `1h`).

```yaml
# values.production.yaml (excerpt)
externalSecrets:
  enabled: true
  targetSecret: epay-secrets
  remoteKey: epay/production
  secretStoreRef:
    name: epay-secrets-store
    kind: ClusterSecretStore
  keys:
    - key: POSTGRES_PASSWORD
    - key: JWT_SECRET
    - key: WEBHOOK_SECRET
    - key: METRICS_TOKEN
      remoteKey: metrics-token # different name in the manager
      property: value # JSON field, for a JSON secret
    - key: ANTHROPIC_API_KEY
```

## Setup

### 1. Install the operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace \
  --set installCRDs=true
```

### 2. Create a ClusterSecretStore

The examples below use **workload identity / OIDC**, so no static cloud
credentials are stored in the cluster. That is the whole point — a static key in a
SecretStore is the problem this is meant to solve.

**AWS Secrets Manager** (IRSA on the operator's service account):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: epay-secrets-store
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

**GCP Secret Manager** (Workload Identity Federation):

```yaml
spec:
  provider:
    gcpsm:
      projectID: epay-production
      auth:
        workloadIdentity:
          clusterLocation: us-central1
          clusterName: epay-prod
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

**HashiCorp Vault** (Kubernetes auth):

```yaml
spec:
  provider:
    vault:
      server: https://vault.internal:8200
      path: secret
      version: v2
      auth:
        kubernetes:
          mountPath: kubernetes
          role: epay
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

### 3. Populate the store

```bash
# AWS
aws secretsmanager create-secret --name epay/production \
  --secret-string '{"POSTGRES_PASSWORD":"...","JWT_SECRET":"...","WEBHOOK_SECRET":"...","METRICS_TOKEN":"...","ANTHROPIC_API_KEY":"..."}'
```

Keys are addressed as `{remoteKey}/{key}` by default. If your manager stores one
JSON blob instead of flat keys, keep the default `remoteRef.key` and add the
`property` for each entry as shown above.

### 4. Deploy

```bash
helm upgrade --install epay ./helm/epay \
  -f helm/epay/values.production.yaml \
  --set externalSecrets.enabled=true
```

## Verify

```bash
kubectl get externalsecret -n epay
# NAME          STORE                  REFRESH INTERVAL   STATUS              READY
# epay-secrets  epay-secrets-store     1h                 SecretSynced        True

kubectl get secret epay-secrets -n epay -o jsonpath='{.data}' | jq 'keys'
```

`READY: False` with `SecretSyncedError` means the store reference, region, or IAM
permission is wrong — check the operator logs:

```bash
kubectl logs -n external-secrets deploy/external-secrets
```

## Rotation

The operator syncs on every refresh interval, so rotation is:

1. Write the new value to the secret manager.
2. Wait for `refreshInterval` (or force it):
   ```bash
   kubectl annotate externalsecret epay-secrets -n epay \
     force-sync="$(date +%s)" --overwrite
   ```
3. Restart the workloads that read the value at boot:
   ```bash
   kubectl rollout restart deployment/epay-api deployment/epay-indexer -n epay
   ```

Secrets injected only as environment variables are read once at process start, so
a rotation without a restart leaves the old value in memory. That is a
deliberate trade-off: EPay does not yet read secrets from files on every use.

**`WEBHOOK_SECRET` rotation has an ordering constraint** — receivers must accept
both secrets before you switch. See
[webhook-receiver.md § Secret rotation](./webhook-receiver.md#secret-rotation).

## Security notes

- The operator's own credentials should be workload-identity based and scoped to
  read only the `epay/*` path.
- Restrict who can read the `epay-secrets` Secret with RBAC; anyone who can
  `get secret` can read every credential.
- Keep `encryption at rest` enabled on the API server so the synchronized Secret
  is encrypted in etcd.
- Never enable `secrets.create` in production — it renders placeholder values from
  `values.yaml`. The chart's production values file does not set it.

## Fallback

If the operator is unavailable (air-gapped cluster, no CRDs), use Sealed Secrets
or a CI step that materialises the Secret, and leave `externalSecrets.enabled=false`.
The rest of the chart is unchanged because it only ever references the Secret by
name.
