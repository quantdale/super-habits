#!/bin/sh
# Vercel Ignored Build Step (referenced from vercel.json `ignoreCommand`).
#
# Vercel semantics (vercel.json#ignorecommand): exit 0 = the build is ignored
# (skipped); exit 1 = the build continues. We skip only on positive evidence
# that the commit range is documentation / agent-spec bookkeeping only:
#
#   - `*.md` files anywhere in the tree
#   - anything under `docs/`
#   - anything under `.agent/`
#   - anything under `openspec/`
#
# Any other changed path builds. If the diff cannot be computed at all
# (shallow clone, missing VERCEL_GIT_PREVIOUS_SHA target, no HEAD^), we BUILD
# (exit 1) and never skip. When in doubt, build.
#
# Range base: VERCEL_GIT_PREVIOUS_SHA (the commit of the previous deployment)
# when set, otherwise HEAD^.

set -u

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ]; then
  base="HEAD^"
fi

# git diff exits non-zero when the base cannot be resolved (shallow clone,
# unknown sha) or git fails otherwise: that is an unknown diff, so build.
changed="$(git diff --name-only "$base" HEAD 2>/dev/null)" || exit 1

# A successful-but-empty diff is not evidence of docs-only changes; build.
if [ -z "$changed" ]; then
  exit 1
fi

printf '%s\n' "$changed" | while IFS= read -r path; do
  case "$path" in
    *.md | docs/* | .agent/* | openspec/*) ;;
    *) exit 1 ;;
  esac
done || exit 1

exit 0
