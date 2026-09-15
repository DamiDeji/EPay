#!/usr/bin/env bash
# Local CI parity — run the same validation stages CI runs, on your machine.
#
# Usage:
#   pnpm ci                 # every stage that the local environment supports
#   pnpm ci -- --quick      # skip the slow stages (contracts, builds, docker)
#   pnpm ci -- --only lint,typecheck,test
#   pnpm ci -- --list       # print the stage names and exit
#
# Stages that need a tool that is not installed are *reported*, not silently
# skipped: a green local run should mean the same thing as a green CI run, so
# anything that could not be executed is listed at the end and the script exits
# non-zero. Use `--allow-missing` to downgrade that to a warning when you are
# deliberately running a subset (for example on a machine without Rust).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# rustup installs outside the default PATH; make `cargo` findable so the
# contracts stage is not skipped on a machine that clearly has Rust.
if [[ -d "$HOME/.cargo/bin" ]]; then
  PATH="$HOME/.cargo/bin:$PATH"
  export PATH
fi

# ── Configuration ────────────────────────────────────────────────────────────
ALL_STAGES=(
  install
  format-check
  lint
  typecheck
  contracts
  test
  e2e
  security
  helm
  docker
)
QUICK_STAGES=(install format-check lint typecheck test)

MODES="all"
ALLOW_MISSING=0
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) MODES="quick" ;;
    --only) ONLY="$2"; shift ;;
    --only=*) ONLY="${1#*=}" ;;
    --allow-missing) ALLOW_MISSING=1 ;;
    --list)
      printf '%s\n' "${ALL_STAGES[@]}"
      exit 0
      ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ -n "$ONLY" ]]; then
  IFS=',' read -r -a STAGES <<<"$ONLY"
elif [[ "$MODES" == "quick" ]]; then
  STAGES=("${QUICK_STAGES[@]}")
else
  STAGES=("${ALL_STAGES[@]}")
fi

# ── Reporting helpers ────────────────────────────────────────────────────────
PASSED=()
FAILED=()
SKIPPED=()

hr() { printf '─%.0s' {1..72}; printf '\n'; }

stage() {
  hr
  printf '▶ %s\n' "$1"
  hr
}

record_pass() { PASSED+=("$1"); }
record_fail() { FAILED+=("$1"); }
record_skip() { SKIPPED+=("$1: $2"); printf '⚠  SKIPPED %s — %s\n' "$1" "$2"; }

# Run a stage body, capturing pass/fail without aborting the whole run.
run_stage() {
  local name="$1"
  shift
  if "$@"; then
    record_pass "$name"
    printf '✔ %s\n\n' "$name"
  else
    record_fail "$name"
    printf '✘ %s\n\n' "$name"
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

require() {
  local name="$1" tool="$2"
  if ! have "$tool"; then
    if [[ "$ALLOW_MISSING" == "1" ]]; then
      record_skip "$name" "$tool not installed"
      return 1
    fi
    echo "✘ $name requires '$tool', which is not on PATH." >&2
    echo "  Re-run with --allow-missing if you intend to skip it." >&2
    return 1
  fi
  return 0
}

# ── Stages ───────────────────────────────────────────────────────────────────
stage_install() {
  # `.npmrc` sets shamefully-hoist, and the lockfile is authoritative in CI.
  pnpm install --frozen-lockfile
}

stage_format_check() {
  pnpm format:check
}

stage_lint() {
  TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-4}" pnpm lint
}

stage_typecheck() {
  TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-4}" pnpm typecheck
}

stage_contracts() {
  require contracts cargo || return 1
  (
    cd packages/contracts
    cargo fmt --check
    # CI runs clippy with `-D warnings`, so it must be clean here too.
    # The crate's dev-dependency enables `testutils`, which is required for the
    # `Env::budget()` helper used by the funds-at-risk fuzz suites.
    cargo clippy --all-targets -- -D warnings
    cargo test --workspace
    cargo build --workspace --target wasm32-unknown-unknown --release
  )
}

stage_test() {
  # `test:coverage`, not `test`: the CI job runs the coverage-gated variant, and a
  # green local run has to mean the same thing as a green CI run.
  TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-2}" pnpm test:coverage
}

stage_security() {
  require security gitleaks || return 1
  gitleaks detect --config .gitleaks.toml --verbose --no-git
  # Advisory: `pnpm audit` reaches the network and its database changes daily.
  if ! pnpm audit --audit-level=high; then
    echo "⚠  pnpm audit reported findings; see docs/SECURITY.md for the policy." >&2
  fi
}

stage_helm() {
  require helm helm || return 1
  helm lint helm/epay
  helm template epay helm/epay --namespace epay >/dev/null
  # Production values must not render without pinned image digests.
  if helm template epay helm/epay -f helm/epay/values.production.yaml >/dev/null 2>&1; then
    echo "❌ values.production.yaml rendered without pinned image digests" >&2
    return 1
  fi
  # The committed raw manifests must match the chart.
  ./scripts/render-k8s-manifests.sh
  git diff --exit-code k8s/manifests.yaml
}

stage_e2e() {
  # The web app imports `@epay/ui` and `@epay/shared` from their built `dist/`,
  # so the workspace must be built before Playwright starts the dev server.
  pnpm build && pnpm --filter @epay/tests e2e
}

stage_docker() {
  require docker docker || return 1
  docker build -f apps/api/Dockerfile -t epay-api:ci .
}

# ── Execute ──────────────────────────────────────────────────────────────────
printf '\nEPay local CI — stages: %s\n\n' "${STAGES[*]}"

for s in "${STAGES[@]}"; do
  case "$s" in
    install) stage install && run_stage install stage_install ;;
    format-check) stage "format check" && run_stage format-check stage_format_check ;;
    lint) stage lint && run_stage lint stage_lint ;;
    typecheck) stage typecheck && run_stage typecheck stage_typecheck ;;
    contracts) stage "soroban contracts" && run_stage contracts stage_contracts ;;
    test) stage test && run_stage test stage_test ;;
    e2e)
      # Browsers are a one-time `playwright install` rather than a project
      # dependency; report the gap instead of silently passing without them.
      if [[ -d "$HOME/.cache/ms-playwright" ]]; then
        stage "e2e (playwright)" && run_stage e2e stage_e2e
      else
        record_skip e2e "playwright browsers not installed — run: pnpm --filter @epay/tests exec playwright install --with-deps"
      fi
      ;;
    security) stage "security scan" && run_stage security stage_security ;;
    helm) stage "helm / kubernetes" && run_stage helm stage_helm ;;
    docker) stage "docker build" && run_stage docker stage_docker ;;
    *)
      echo "unknown stage: $s" >&2
      exit 2
      ;;
  esac
done

# ── Summary ──────────────────────────────────────────────────────────────────
hr
printf 'Summary\n'
hr
printf 'passed:  %s\n' "${#PASSED[@]}"
printf 'failed:  %s\n' "${#FAILED[@]}"
printf 'skipped: %s\n' "${#SKIPPED[@]}"

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo
  echo "Skipped stages (not validated locally):"
  printf '  - %s\n' "${SKIPPED[@]}"
fi

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo
  echo "Failed stages:"
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi

if [[ ${#SKIPPED[@]} -gt 0 && "$ALLOW_MISSING" != "1" ]]; then
  echo
  echo "This run did not cover every stage."
  exit 1
fi

echo
echo "✔ Local CI passed."
