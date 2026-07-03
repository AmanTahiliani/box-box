# `.agents/` — harness-agnostic agentic dev toolkit

Portable skills, prompts, and scripts that drive the box-box development lifecycle.
Any harness (Claude, Codex, opencode, …) can read these — the canonical workflows
live here, not in a tool-specific folder. The shared project context every harness
reads is `AGENTS.md` (→ `CLAUDE.md`).

## Layout

```
skills/          Codex/open agent skills: groom, write-spec, implement, review, lenses
personas/        grill.md (base) + lens overlays (architect, …) — the interrogation voices
prompts/         ready-spec.md (groomed spec), implement.md/review.md dispatch prompts
lib/gh.sh        GitHub issue + Project (#2) state helpers: issue_*, set_stage/effort/priority
lib/dispatch.sh  dispatch(): Ready issue → worktree → harness → gate → PR
harnesses.sh     headless adapters (one fn per harness) + run_gate — the ONLY tool-specific code
bin/dev          CLI: `dev implement <issue#> --harness <name> [--dry-run]`
```

## The lifecycle

`Icebox → Research → Ready → In Progress → In Review → Done` (the Project `Stage` field).

- **Groom** (interactive, Claude): `/groom <issue#>` runs a seeded grill-me → writes a
  Ready spec into the issue body → sets Effort/Priority → leaves Stage at `Research`.
  You review and flip to `Ready`.
- **Implement** (any harness): `.agents/bin/dev implement <issue#> --harness <name>`
  (or `/implement …` in Claude to supervise) → isolated worktree → runs the harness
  headless on the spec → build gate → opens a PR → sets Stage `In Review`.
- **Review + merge**: use the `review` skill from a harness different from the
  implementer to create a local review packet and PR comment, then you merge.

## Skills and harnesses

`.agents/skills` is the canonical home for reusable workflows. Codex discovers
repo skills from that path directly, and Claude can use the same files through
`.claude/skills -> ../.agents/skills`. Other harnesses can read the same
`SKILL.md` files explicitly or enter the workflow through `.agents/bin/dev`.
Do not put canonical workflow instructions under `.claude/`; that directory is
local adapter state.

## Adding / fixing a harness

Edit one function in `harnesses.sh`: `harness_<name> <workdir> <promptfile>`, running the
tool non-interactively in `<workdir>` on the prompt. `claude`/`codex`/`opencode` are
wired; `pi`/`cursor` are stubs — confirm their headless flags before trusting.

Always `--dry-run` a new harness first: it renders the exact prompt and plan, touching
nothing (no worktree, PR, or state change).
