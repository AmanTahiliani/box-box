---
name: lens-architect
description: 'Grill/analyze a box-box issue or epic from a software-architecture perspective and post the findings as a comment. Use standalone as "/lens-architect <issue-number>" for an on-the-fly architecture review, or let /groom compose it via "--lens architect". Reads the base grill + architect persona and focuses on reuse, data flow, seams, testability, and risk.'
argument-hint: <issue-number>
---

# /lens-architect — architecture lens

Target: issue **$ARGUMENTS** (box-box, Project #2).

1. `source .agents/lib/gh.sh`; load context (`issue_json <n>`, `CLAUDE.md`, and the
   relevant code paths).
2. Read `.agents/personas/grill.md` + `.agents/personas/architect.md` and run a focused
   grill from the architecture lens: hybrid asking (AskUserQuestion for discrete
   decisions, recommendation first; prose otherwise), recommend every answer, and
   explore the code to self-answer before asking.
3. When aligned, write an **"## Architecture review"** summary (decisions taken,
   files/seams affected, risks, the test seam) to a temp file and `add_comment <n> <file>`.
4. Print the issue URL.

If invoked from **within /groom**, skip the comment — instead return the architecture
decisions inline so groom can fold them into the spec.
