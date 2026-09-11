#!/usr/bin/env bash
# Regenerate k8s/manifests.yaml from the Helm chart.
#
# The Helm chart in helm/epay/ is the single source of truth. This script exists
# so teams that deploy with plain `kubectl apply -f` (no Helm/Tiller/Argo in the
# path) still get the same resources, generated rather than hand-maintained.
#
# CI checks that the committed file matches the chart, so drift fails the build:
#   ./scripts/render-k8s-manifests.sh && git diff --exit-code k8s/manifests.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART="$ROOT/helm/epay"
OUT="$ROOT/k8s/manifests.yaml"

if ! command -v helm >/dev/null 2>&1; then
  echo "helm is required but was not found on PATH" >&2
  exit 1
fi

mkdir -p "$ROOT/k8s"

# The release name is fixed so the generated file is deterministic; the
# committed output is meant for a cluster where the resources are named exactly
# as the chart renders them.
helm template epay "$CHART" \
  --namespace epay \
  --include-crds \
  >"$OUT"

echo "wrote $OUT ($(wc -l <"$OUT" | tr -d ' ') lines)"
