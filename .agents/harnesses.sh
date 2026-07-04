#!/usr/bin/env bash
# .agents/harnesses.sh — headless harness adapters.
#
# ONE function per harness:  harness_<name> <workdir> <promptfile>
# Each runs the harness NON-INTERACTIVELY inside <workdir>, feeding it the rendered
# prompt, expected to edit files (and ideally commit). This is the ONLY harness-specific
# code in the toolkit — tune the exact flags here per tool/version.
#
# Autonomy note: these run unattended, so each uses the tool's "just do it" mode
# (accept edits / full-auto). Only run harnesses you trust on code you can review via PR.

# ---- MUST-HAVE ----

harness_disabled_reason() {              # <name> -> reason on stdout; 0 means disabled
  case "$1" in
    agy)
      cat <<'EOF'
agy is disabled for implementation dispatch as of 2026-07-04: Antigravity headless mode was observed to ignore prompts with --new-project, resume stale conversations without it, and hang past print timeouts. Use codex or cursor until a fresh headless invocation is verified.
EOF
      return 0
      ;;
    *) return 1 ;;
  esac
}

harness_claude() {                      # Claude Code — print mode, auto-accept edits
  local dir="$1" prompt="$2"
  ( cd "$dir" && claude -p "$(cat "$prompt")" --permission-mode acceptEdits )
}

harness_codex() {                       # OpenAI Codex CLI — non-interactive exec, full auto
  local dir="$1" prompt="$2"
  ( cd "$dir" && codex exec --full-auto "$(cat "$prompt")" )
}

harness_opencode() {                    # opencode — non-interactive run
  local dir="$1" prompt="$2"
  ( cd "$dir" && opencode run "$(cat "$prompt")" )
}

harness_cursor() {                      # Cursor CLI agent — composer-2.5, headless full-auto
  local dir="$1" prompt="$2"
  ( cd "$dir" && cursor-agent -p "$(cat "$prompt")" --model composer-2.5 --force --trust )
}

harness_agy() {                         # Antigravity CLI — disabled until headless is verified
  local reason
  reason="$(harness_disabled_reason agy)"
  echo "harness_agy: $reason" >&2
  return 2
}

# ---- NICE-TO-HAVE (verify the exact invocation for your version before trusting) ----

harness_pi() {                          # pi — CONFIRM headless CLI + flags
  local dir="$1" prompt="$2"
  ( cd "$dir" && pi run "$(cat "$prompt")" )        # placeholder — verify
}

# ---- build/typecheck gate (fast, local) ----
# Returns non-zero on failure. This is a smoke gate — CI runs the full suite. Tune freely.
run_gate() {
  local dir="$1"
  ( cd "$dir" && go build ./... ) || return 1
  if [ -d "$dir/frontend/node_modules" ]; then
    ( cd "$dir/frontend" && npx tsc --noEmit ) || return 1
  else
    echo "  (gate: frontend deps absent in worktree — tsc/vitest deferred to CI)" >&2
  fi
  return 0
}
