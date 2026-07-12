# v0.4.0 — Current Weekend & Product Truth

Product research references for the v0.4.0 feature sprint.

## Direction

The sprint replaces route-first navigation with a state-aware Weekend experience:

- Weekend is the adaptive home for what happened, what is live, and what is next.
- Preview content folds into Weekend before a session.
- Live remains a stable deep link and becomes Weekend's active-session state.
- Race Hub remains explicit completed-session analysis rather than a primary landing destination.
- Championship and Briefing remain dedicated destinations.
- Explore owns secondary discovery; Admin moves to operator utility.

## Mockups

- `mockups/weekend-between-races.png` — desktop between-races/post-weekend state.
- `mockups/weekend-live.png` — desktop active-session state; the circuit is static sector context, not live GPS.
- `mockups/weekend-between-sessions-mobile.png` — 390×844 between-session state.

These are directional references, not pixel-perfect specifications. Implementations must preserve the established box-box visual language, accessibility, data constraints, and responsive behavior while satisfying their issue acceptance criteria.

## Constraints

- No OpenF1 REST dependency during active sessions.
- Public live GPS is not assumed to be available.
- Championship round numbers exclude tests and cancelled meetings.
- Connection health, live-session state, archive availability, and local-analysis readiness are separate concepts.
- Future sessions must not render empty post-session analysis.

The authoritative product decisions and research packet are recorded in GitHub issue #71 under epic #70.
