#!/usr/bin/env bash
# Regenerate k8s/manifests.yaml from the Helm chart.
#
# The Helm chart in helm/epay/ is the single source of truth. This script exists
# so teams that deploy with plain `kubectl apply -f` (no Helm/Tiller/Argo in the
# path) still get the same resources, generated rather than hand-maintained.
#
# CI checks that the committed file matches the chart, so drift fails the build:
#   ./scripts/render-k8s-manifests.sh && git diff --exit-code k8s/manifests.yaml
#
# Always regenerate with this script rather than `helm template > k8s/...` — see
# the normalisation step below for why the output is not byte-identical to raw
# `helm template`, and why that is deliberate.
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
#
# Normalisation: Helm 4 emits a blank line before each `---` document separator,
# and one at the end of the stream; Helm 3 emits none of them. That whitespace
# carries no meaning in YAML, but the CI drift check compares files, so without
# this step the committed manifests would match whichever Helm major happened to
# generate them and fail on the other — in CI or in a contributor's checkout.
# Drop *only* the blank lines that sit directly before a separator, plus any
# trailing blank lines; blank lines anywhere else (including inside multi-line
# values) are preserved.
helm template epay "$CHART" \
  --namespace epay \
  --include-crds \
  | awk '
      /^$/ { pending++; next }
      {
        if (pending > 0 && $0 != "---") { while (pending-- > 0) print "" }
        pending = 0
        print
      }
    ' \
  >"$OUT"

echo "wrote $OUT ($(wc -l <"$OUT" | tr -d ' ') lines)"
