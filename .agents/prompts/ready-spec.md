## Context
{one paragraph: the problem and why it matters, grounded in the grooming}

## Acceptance Criteria
- [ ] {observable behaviour 1}
- [ ] {observable behaviour 2}

## Technical Approach
- **Files to touch:** {real paths}
- **Data source:** {OpenF1 live | domain DB | cache | ...}
- **Endpoints/components:** {new or extended — note route-registration order if new}
- **Key decisions:** {the forks resolved during the grill}

## Test Plan
- {cases mapped to the real suites: go test · vitest · hermetic Playwright}

## Out of Scope
- {explicitly deferred}

## Definition of Done
- [ ] Tests added and green (`go test` · `vitest` · `tsc --noEmit` · hermetic Playwright as applicable)
- [ ] Matches CLAUDE.md conventions (route order, cache TTLs, `api.ts`/`types.ts` mirrors)
- [ ] No console / preview errors (UI verified in preview)
- [ ] Story-sized PR, linked to this issue

---
_Groomed {date} · Effort {S|M|L} · Priority {P0|P1|P2} · via /groom_
