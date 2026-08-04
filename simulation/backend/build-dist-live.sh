#!/usr/bin/env bash
# ============================================================================
# Guarded `dist-live/` export for the disposable-backend lane (design D8,
# task 8.4).
#
# Produces a static web export pointed at the DISPOSABLE Supabase project, and
# ONLY inside the guarded disposable job (main/nightly). It is never run in a
# PR lane and never committed to the repo output (dist-live/ is gitignored).
#
# The guard (`provision.ts check`) runs BEFORE the disposable env is sourced,
# against the CURRENT ambient shell plus the emitted live-env target:
#   - production-host:      the target host must not match a production host.
#   - production-credentials: no ambient EXPO_PUBLIC_SUPABASE_* in the shell.
#   - disposable-marker:    the target project must carry the disposable marker.
# If the guard aborts, THIS SCRIPT EXITS NON-ZERO and NO export is produced.
#
# Preconditions: run `npx tsx simulation/backend/provision.ts run` first (it
# writes simulation/backend/state/live-env.sh) and set
# SIMULATION_PRODUCTION_SUPABASE_HOSTS in the job.
#
# Runner note: no tsx dependency is added to the repo (constraint); invoke with
# `npx tsx` (one-off) or compile-then-run via the repo's tsc.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIVE_ENV="$ROOT/simulation/backend/state/live-env.sh"

if [[ ! -f "$LIVE_ENV" ]]; then
  echo "ABORT[build-dist-live]: $LIVE_ENV missing — provision a disposable project first" >&2
  echo "  (npx tsx simulation/backend/provision.ts run). The dist-live build may not proceed unguarded." >&2
  exit 1
fi

if [[ -z "${SIMULATION_PRODUCTION_SUPABASE_HOSTS:-}" ]]; then
  echo "ABORT[build-dist-live]: SIMULATION_PRODUCTION_SUPABASE_HOSTS is not set;" >&2
  echo "  the guard cannot prove the target is not production." >&2
  exit 1
fi

# 1) GUARD against the current ambient shell + the emitted target (before
#    sourcing the disposable env, so the guard still sees a clean ambient shell).
echo "[build-dist-live] running disposable-backend guard ..."
npx tsx "$ROOT/simulation/backend/provision.ts" check

# 2) Guard passed — bring the disposable env into scope and export to dist-live/.
set -a
# shellcheck disable=SC1090
source "$LIVE_ENV"
set +a

echo "[build-dist-live] guard passed; exporting to dist-live/ for $EXPO_PUBLIC_SUPABASE_URL"
npx expo export -p web --output-dir dist-live

echo "[build-dist-live] done: dist-live/ (never commit — gitignored)."