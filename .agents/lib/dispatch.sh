#!/usr/bin/env bash
# .agents/lib/dispatch.sh — implement a Ready issue with a chosen harness in an
# isolated git worktree, run the build gate, and open a PR.
#
# Source it, then:  dispatch <issue#> <harness> [--dry-run] [--base <branch>]
# (or use the CLI:  .agents/bin/dev implement <issue#> --harness <name> [--dry-run])

_AGENTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$_AGENTS_DIR/lib/gh.sh"
# shellcheck source=/dev/null
source "$_AGENTS_DIR/harnesses.sh"

_slug() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40; }

_render_prompt() { # <issue#> <title> <body>
  echo "# Implement: $2"
  echo
  cat "$_AGENTS_DIR/prompts/implement.md"
  echo; echo "---"; echo
  echo "## Spec — issue #$1"
  echo
  echo "$3"
}

_pr_body() { # <issue#> <harness> <gate>
  cat <<EOF
Implements #$1.

- **Harness:** $2 (dispatched via \`.agents/bin/dev\`)
- **Local gate** (\`go build\` + \`tsc --noEmit\`): **$3**
- Full test suite + independent review run in CI / by a reviewer harness.

See #$1 for the groomed spec, Test Plan, and Definition of Done.

Closes #$1
EOF
}

dispatch() { # <issue#> <harness> [--dry-run] [--base <branch>]
  local issue="$1" harness="$2"; shift 2 || { echo "usage: dispatch <issue#> <harness> [--dry-run] [--base <branch>]"; return 2; }
  local dry=0 base="main"
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run) dry=1 ;;
      --base)    base="$2"; shift ;;
      *) echo "dispatch: unknown flag '$1'" >&2; return 2 ;;
    esac; shift
  done

  # adapter must exist
  if ! declare -f "harness_$harness" >/dev/null 2>&1; then
    echo "no adapter for harness '$harness' — add harness_$harness() to .agents/harnesses.sh" >&2; return 2
  fi
  if [ "$dry" != 1 ] && declare -f harness_disabled_reason >/dev/null 2>&1; then
    local disabled_reason
    if disabled_reason="$(harness_disabled_reason "$harness")"; then
      echo "harness '$harness' is disabled for non-dry-run dispatch." >&2
      echo "  $disabled_reason" >&2
      echo "  Use --dry-run for prompt inspection, or dispatch with --harness codex/cursor." >&2
      return 2
    fi
  fi

  local repo_root title body slug branch wt prompt
  repo_root="$(git rev-parse --show-toplevel)" || return 1
  title="$(issue_title "$issue")" || { echo "issue #$issue not found on $REPO" >&2; return 1; }
  body="$(issue_body "$issue")"
  slug="$(_slug "$title")"
  branch="feat/issue-${issue}-${slug}"
  wt="$repo_root/.worktrees/issue-${issue}"
  prompt="$(mktemp "${TMPDIR:-/tmp}/boxbox-prompt-${issue}.XXXX")"
  _render_prompt "$issue" "$title" "$body" > "$prompt"

  echo "── dispatch #$issue → $harness ──"
  echo "  title    : $title"
  echo "  branch   : $branch"
  echo "  worktree : $wt"
  echo "  base     : $base"
  echo "  prompt   : $prompt"

  if [ "$dry" = 1 ]; then
    echo "  [dry-run] no worktree / harness / PR / state change. Prompt preview:"
    sed 's/^/    | /' "$prompt"
    return 0
  fi

  # preflight: warn (don't block) if not Ready
  local stage; stage="$(get_field "$issue" Stage)"
  [ "$stage" = "Ready" ] || echo "  ⚠ Stage is '$stage' (not Ready) — dispatching anyway"

  # isolated worktree
  if [ -d "$wt" ]; then
    echo "  worktree exists — reusing"
  else
    git -C "$repo_root" worktree add -b "$branch" "$wt" "$base" || return 1
  fi

  set_stage "$issue" "In Progress"

  echo "  running $harness (headless)…"
  ( harness_"$harness" "$wt" "$prompt" ); local hrc=$?
  echo "  $harness exited ($hrc)"

  # fallback commit: guarantee a PR-able branch even if the harness didn't commit
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    git -C "$wt" add -A
    git -C "$wt" commit -q -m "feat(#$issue): $title

Implemented by $harness via .agents/dev dispatch." && echo "  committed leftover changes"
  fi

  # gate
  local gate="passed"
  run_gate "$wt" || gate="FAILED"
  echo "  gate: $gate"

  # PR (only if there are commits ahead of base)
  if [ -n "$(git -C "$wt" log "$base..$branch" --oneline 2>/dev/null)" ]; then
    git -C "$wt" push -u origin "$branch" || { echo "  push failed — inspect $wt" >&2; return 1; }
    local draft=""; [ "$gate" = "FAILED" ] && draft="--draft"
    local pr
    pr="$(gh pr create -R "$REPO" --head "$branch" --base "$base" $draft \
      --title "$title (#$issue)" --body "$(_pr_body "$issue" "$harness" "$gate")")" || { echo "  gh pr create failed" >&2; return 1; }
    echo "  PR: $pr${draft:+  (draft — gate failed)}"
    set_stage "$issue" "In Review"
  else
    echo "  no commits on $branch — leaving Stage 'In Progress'. Inspect the worktree: $wt" >&2
  fi
}
