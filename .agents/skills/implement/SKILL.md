---
name: implement
description: 'Dispatch a Ready box-box issue to a coding harness (claude/codex/opencode/pi/cursor) in an isolated git worktree, run the build gate, and open a PR. Use when supervising implementation via "/implement <issue-number> --harness <name> [--dry-run]" or from any harness terminal with .agents/bin/dev.'
argument-hint: <issue-number> --harness <claude|codex|opencode|pi|cursor> [--dry-run]
---

# /implement — dispatch an issue to a harness (supervised)

Supervise the implementation of issue **$ARGUMENTS**. You are SUPERVISING, not coding —
a fresh harness does the work in its own isolated worktree with clean context. Do not
edit project files yourself.

## Steps
1. Parse: `<issue-number> --harness <name> [--dry-run] [--base <branch>]`.
2. **Preflight (report, don't hard-block):** `source .agents/lib/gh.sh` and check
   `get_field <n> Stage` is `Ready` and the issue body has an "## Acceptance Criteria"
   section (a groomed spec). If it's not Ready or has no spec, say so and recommend
   `/groom <n>` first — proceed only if the user confirms.
3. **Dispatch:** run `.agents/bin/dev implement <n> --harness <name> [flags]`. For a
   first run against an unfamiliar harness, suggest `--dry-run` first so the user can
   eyeball the prompt.
4. **Report the outcome:** branch, worktree path, gate result (pass/FAILED → draft PR),
   and the PR URL. On success, Stage will be `In Review`.
5. If no PR was created (no changes, or push failed), surface exactly why and point at
   the worktree (`.worktrees/issue-<n>`) so the user can inspect. Diagnose from the
   dispatcher output; recommend a fix or re-run — don't silently take over the coding.

## Notes
- The harness adapters and the gate live in `.agents/harnesses.sh` — the single place
  to tune per-tool flags.
- From any harness shell, run the same thing directly:
  `.agents/bin/dev implement <n> --harness <name>`.
