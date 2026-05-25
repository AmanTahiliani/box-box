# Visual Design Direction

## Summary

The visual direction should be F1-native without falling into generic dashboard
habits. The app should feel like an operations room for following a race
weekend: technical, fast, sharp, and legible. It should avoid AI-slop patterns
such as endless decorative cards, vague gradient panels, giant generic hero
sections, and meaningless visual chrome.

## Design North Star

Use the phrase "F1 Ops Room" as the working direction.

Qualities:

- Dense but controlled.
- High signal.
- Fast to scan.
- Precise typography.
- Strong hierarchy.
- Team color used as information, not decoration.
- Good on phone and iPad, not just desktop.

## Density

Density should be configurable:

- Compact: timing-wall mode, maximum data per viewport.
- Comfortable: default mode for most users.
- Touch: larger hit targets and panel spacing for phone/iPad.

Density affects:

- Table row height.
- Visible columns.
- Panel spacing.
- Chart label detail.
- Header size.
- Control grouping.

## Timing-Wall Ergonomics

Live timing should prioritize scan speed:

- Position and driver identity must be easy to locate.
- Gap/interval changes should be visually distinct.
- Pit state, retired state, and tyre state should be obvious.
- Race-control alerts should interrupt without becoming noisy.
- Pinned drivers should remain available across live views.

## Team Color Discipline

Team colors are useful data, but they can quickly become visual noise.

Rules:

- Use team color for identity markers, row accents, chart lines, and selected
  driver focus.
- Avoid flooding large surfaces with saturated team color.
- Always preserve contrast and legibility.
- Avoid making the whole interface a rainbow unless the context is explicitly
  comparative.

## Layout Principles

Prefer:

- Full-width information bands.
- Dense tables with strong alignment.
- Split panes.
- Sticky session headers.
- Bottom navigation on phone.
- Clear panel switching on smaller screens.
- Charts that explain race state, not just decorate.

Avoid:

- Card sludge: every concept boxed into a decorative card.
- Floating cards inside cards.
- Generic SaaS dashboard grids.
- Purple/blue gradient panels with no product meaning.
- Decorative orbs, bokeh, or random glow effects.
- Vague hero sections.
- Overly large typography inside operational surfaces.

## F1-Native References To Research

Research should study:

- Official F1 timing tower ergonomics.
- Broadcast graphics hierarchy.
- FIA timing/result sheet density.
- Race control message formatting.
- Pit wall and telemetry workstation patterns.
- Motorsport data overlays.

The goal is not to copy official F1 branding. The goal is to understand the
information hierarchy and pacing of motorsport interfaces.

## Mobile And iPad

The app should work well on phone and iPad because those are likely primary
second-screen devices during race sessions.

Phone:

- Prioritize Live Timing, alerts, pinned drivers, and quick switching.
- Use stacked panels and sticky status.
- Keep interactions thumb-friendly.

iPad:

- Use two-pane and three-pane layouts.
- Keep charts inspectable.
- Make side panels easy to swap.

Desktop:

- Allow dense multi-panel layouts.
- Show more simultaneous context.
- Preserve keyboard and pointer efficiency.

