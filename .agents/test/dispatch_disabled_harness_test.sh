#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/.agents/lib/dispatch.sh"

issue_title() { echo "Disable agy harness smoke"; }
issue_body() { echo "## Spec"; echo; echo "Smoke prompt body"; }
get_field() { echo "Ready"; }
set_stage() { echo "unexpected set_stage $*" >&2; return 99; }
run_gate() { echo "unexpected run_gate $*" >&2; return 99; }

unexpected_git_file="$(mktemp "${TMPDIR:-/tmp}/boxbox-agy-git.XXXX")"
rm -f "$unexpected_git_file"
git() {
  if [ "${1:-}" = "rev-parse" ]; then
    command git "$@"
    return
  fi
  echo "unexpected git $*" >&2
  touch "$unexpected_git_file"
  return 99
}

set +e
non_dry_output="$(dispatch 47 agy 2>&1)"
non_dry_status=$?
set -e

[ "$non_dry_status" -eq 2 ] || {
  echo "expected agy non-dry-run to exit 2, got $non_dry_status" >&2
  echo "$non_dry_output" >&2
  exit 1
}
[[ "$non_dry_output" == *"harness 'agy' is disabled"* ]] || {
  echo "expected disabled-harness message" >&2
  echo "$non_dry_output" >&2
  exit 1
}
[ ! -e "$unexpected_git_file" ] || {
  echo "agy non-dry-run reached git before failing" >&2
  echo "$non_dry_output" >&2
  exit 1
}

dry_output="$(dispatch 47 agy --dry-run 2>&1)"
[[ "$dry_output" == *"[dry-run] no worktree / harness / PR / state change"* ]] || {
  echo "expected agy dry-run to render dispatch preview" >&2
  echo "$dry_output" >&2
  exit 1
}
[[ "$dry_output" == *"Smoke prompt body"* ]] || {
  echo "expected agy dry-run prompt body" >&2
  echo "$dry_output" >&2
  exit 1
}
