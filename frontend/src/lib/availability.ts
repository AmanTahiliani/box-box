import { getResponseAvailability, type ResponseAvailability } from './fetch'
import type { ContextSession, WeekendContext } from '../types'

/** Shared Weekend Context terminology for coverage / availability indicators. */
export type DataAvailability = 'local' | 'partial' | 'stale' | 'archive' | 'limited' | 'missing'

/** Freshness values that warrant a non-blocking DataNotice. */
const NOTICE_FRESHNESS = new Set<string>(['stale', 'partial', 'local', 'limited', 'archive'])

/**
 * Product-impact severity for aggregating conflicting reported freshness.
 * Higher wins so routine Local cannot mask Limited/Partial/Stale/Archive.
 */
const NOTICE_SEVERITY: Record<DataAvailability, number> = {
  local: 1,
  archive: 2,
  stale: 3,
  partial: 4,
  limited: 5,
  missing: 6,
}

/**
 * Map a reported freshness string onto shared DataNotice vocabulary.
 * Returns null for unreported / routine-success values (`fresh`, `live`, …).
 * Never invents stale from React Query staleTime.
 */
export function noticeFromFreshness(
  freshness: string | undefined | null,
  opts?: { includeLocal?: boolean },
): DataAvailability | null {
  if (!freshness) return null
  const includeLocal = opts?.includeLocal ?? true
  if (freshness === 'local' && !includeLocal) return null
  if (!NOTICE_FRESHNESS.has(freshness)) return null
  return freshness as DataAvailability
}

/** Prefer header freshness, then optional typed payload freshness. */
export function noticeFromResponse(
  data: unknown,
  opts?: { includeLocal?: boolean; fallbackFreshness?: string },
): DataAvailability | null {
  const meta = getResponseAvailability(data)
  return (
    noticeFromFreshness(meta?.freshness, opts) ??
    noticeFromFreshness(opts?.fallbackFreshness, opts)
  )
}

/**
 * Pick the worst (highest product-impact) reported notice among sources.
 * Equivalent kinds collapse to one; Local never masks a stronger disclosure.
 */
export function aggregateNotices(
  notices: Array<DataAvailability | null | undefined>,
): DataAvailability | null {
  let worst: DataAvailability | null = null
  for (const notice of notices) {
    if (!notice) continue
    if (!worst || NOTICE_SEVERITY[notice] > NOTICE_SEVERITY[worst]) {
      worst = notice
    }
  }
  return worst
}

export function noticeMessage(kind: DataAvailability): string {
  switch (kind) {
    case 'stale':
      return 'Showing stale cached data. Retry to refresh.'
    case 'partial':
      return 'Coverage is partial for this view.'
    case 'local':
      return 'Showing local season data.'
    case 'limited':
      return 'Some optional details are unavailable. Core data is still shown.'
    case 'archive':
      return 'Showing an archived snapshot.'
    case 'missing':
      return 'Some expected data is missing.'
  }
}

/**
 * Session whose state the Weekend shell is presenting — mirrors backend
 * focusedContextSession so an older terminal session never overrides focus.
 */
export function focusedContextSession(context: WeekendContext): ContextSession | undefined {
  if (context.active_session) return context.active_session
  if (!context.focus_meeting) return undefined
  const focusKey = context.focus_meeting.meeting_key
  for (const ref of [
    context.next_session,
    context.previous_completed_session,
    context.default_analysis_session,
  ]) {
    if (ref?.meeting?.meeting_key === focusKey) return ref
    // Session.meeting_key is always present even when meeting identity is sparse.
    if (ref && ref.session.meeting_key === focusKey) return ref
  }
  return undefined
}

/**
 * Weekend shell notice from authoritative response headers when present.
 * A header that intentionally maps to no notice (e.g. focused local/local with
 * Local suppressed) must not fall through to older previous-session archive/partial.
 * When headers are absent, typed focus-session freshness may be used.
 */
export function weekendContextNotice(
  context: WeekendContext,
  responseMeta?: ResponseAvailability,
): DataAvailability | null {
  const headerMeta = responseMeta ?? getResponseAvailability(context)
  if (headerMeta) {
    return noticeFromFreshness(headerMeta.freshness, { includeLocal: false })
  }

  const focus = focusedContextSession(context)
  return noticeFromFreshness(focus?.availability.freshness, { includeLocal: false })
}

/**
 * Embedded Preview should disclose its own freshness unless the Weekend shell
 * already shows an equivalent notice (same DataAvailability kind).
 */
export function shouldShowEmbeddedNotice(
  notice: DataAvailability | null | undefined,
  shellNotice: DataAvailability | null | undefined,
): boolean {
  if (!notice) return false
  if (!shellNotice) return true
  return notice !== shellNotice
}
