---
name: groom
description: 'Groom a box-box GitHub issue into a Ready spec via a seeded grill-me interrogation. Use when the user asks to groom an issue, for example "/groom <issue-number>" or "$groom <issue-number>" with optional "--lens architect". Single-issue path: asks targeted questions, writes a structured spec into the issue body, sets Effort/Priority, and leaves Stage at Research for approval.'
argument-hint: <issue-number> [--lens architect]
---

# /groom — refine one issue into a Ready spec

Groom issue **$ARGUMENTS** on the box-box roadmap (Project #2): drive it from the
backlog into a fully-specified Ready ticket through a grill-me session.

## 0. Setup
- Parse the first token of the arguments as the **issue number**. An optional
  `--lens <name>` pulls in a lens overlay (currently: `architect`).
- Run: `source .agents/lib/gh.sh && project_refresh` (fresh field/item state).
- Load context **before asking anything**: `issue_json <n>`, read `CLAUDE.md`, and
  explore the code paths the issue implicates.
- Move it into grooming if it isn't already there: `set_stage <n> Research`.

## 1. Grill
- Read `.agents/personas/grill.md`. If `--lens <name>` was given, also read
  `.agents/personas/<name>.md` and apply it on top.
- Run the grill exactly per those rules: **one question at a time**, recommendation
  first, **hybrid** asking (AskUserQuestion for discrete decisions with the
  recommended option first and labelled "(Recommended)"; prose for open-ended), and
  **explore the code to self-answer** wherever possible — only ask about genuine forks.
- Track the resolved decisions as you go.

## 2. Synthesize
- When no open branches remain, summarize the shared design concept in 3–6 bullets and
  confirm it with the user.
- Then invoke the **write-spec** skill for issue `<n>`, handing it the resolved
  decisions, so it renders `.agents/prompts/ready-spec.md` into the issue body and
  sets Effort + Priority.

## 3. Hand back (human gate)
- Do **not** auto-advance to Ready — that's the user's call. Report that the spec is
  written, Stage is `Research`, and they should review the issue and flip Stage →
  `Ready` when satisfied (`set_stage <n> Ready`).
- Print the issue URL (`issue_url <n>`).

Stay focused on THIS issue's design throughout. Note but don't chase out-of-scope ideas.
