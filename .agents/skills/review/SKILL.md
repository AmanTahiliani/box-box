---
name: review
description: 'Locally review a box-box PR against its linked GitHub issue spec, run tests, capture visual screenshots when applicable, create a .review packet, and post a GitHub PR comment. Use when a ticket implementation is ready for independent local review before the human merge gate.'
argument-hint: <pr-number> [--harness <name>] [--publish-screenshots]
---

# /review — local independent PR review

Review PR **$ARGUMENTS** for box-box using the local-only lifecycle. You are
reviewing, not implementing. Do not merge the PR.

## 0. Setup
- Parse the PR number. Optional `--harness <name>` records which reviewer harness is
  acting; optional `--publish-screenshots` allows pushing visual artifacts to a
  dedicated artifact branch.
- Read `.agents/prompts/review.md`, `AGENTS.md`, the PR metadata/diff, and the linked
  issue body.
- Identify the implementer harness from the PR body when present. If it matches the
  reviewer harness, call that out as a reduced independence caveat.
- Create `.review/issue-<issue>-pr-<pr>/logs`, `screenshots`, and `artifacts`.

## 1. Verify
- Run the smallest meaningful gates first, then broaden based on risk:
  `go test` for touched Go packages, `npm run test` and `npm run build` for frontend
  changes, and hermetic Playwright when user-facing routes changed.
- Save all command output to `.review/issue-<issue>-pr-<pr>/logs`.
- Inspect the diff for spec conformance, scope leaks, missing tests, and known project
  conventions from `AGENTS.md`.

## 2. Visual Packet
- If the PR changes UI, start a local seeded or mocked preview and capture desktop and
  mobile screenshots for affected routes.
- Prefer hermetic mocks/seeded data over live external state.
- Save screenshots under `.review/issue-<issue>-pr-<pr>/screenshots`.
- Create a concise `summary.md`; create `index.html` when screenshots exist.

## 3. Publish
- If `--publish-screenshots` is present, publish only review artifacts to a dedicated
  branch such as `review-artifacts/pr-<pr>/` and use raw GitHub URLs in the comment.
- Post a PR comment with:
  - reviewer harness and implementer harness
  - result: pass, pass with caveats, or needs changes
  - local packet path
  - gates run and results
  - acceptance-criteria checklist
  - screenshots or artifact links when available
  - caveats that the human must inspect
- If the result is pass/pass-with-caveats, set the linked issue's custom Project
  `Stage` to `In Review` using `.agents/lib/gh.sh`. Do not set `Done`.

## 4. Hand Back
- Tell the human exactly what to open locally and what decision remains theirs.
- Do not merge or delete worktrees.
