---
name: write-spec
description: Render a groomed design into the box-box Ready-spec template and write it into a GitHub issue body, then set Effort and Priority. Called by /groom after a grill session, or run standalone as "/write-spec <issue-number>" to (re)write an issue's spec from agreed decisions. Does not change Stage.
argument-hint: <issue-number>
---

# /write-spec — write the Ready spec into an issue

Target issue: **$ARGUMENTS** (box-box, Project #2).

## Steps
1. `source .agents/lib/gh.sh`
2. Gather the agreed design decisions: from the current grooming conversation if one
   is in progress; otherwise ask the user for the key points, or read the issue and
   explore the code to draft them and confirm.
3. Read `.agents/prompts/ready-spec.md` and fill every placeholder:
   - Concrete, **behavioural** acceptance criteria (checkboxes).
   - Technical approach grounded in **real files/paths** and the chosen data source.
   - Test plan mapped to the actual suites (`go test` · `vitest` · hermetic Playwright).
   - Explicit out-of-scope.
   - Keep the Definition of Done checklist verbatim.
   - Stamp the footer: date (from the current-date context), Effort (S/M/L),
     Priority (P0–P2).
4. Write it into the issue body: save the filled template to a temp file under the
   scratchpad and `set_issue_body <n> <file>`. The spec is the single source of truth —
   only preserve prior body text that captures decisions the spec doesn't.
5. Set fields: `set_effort <n> <S|M|L>` and `set_priority <n> <P0|P1|P2>`.
6. Print the issue URL and a one-line summary of what was written.

Do **not** change Stage — `/groom` owns state transitions.
