import { getResponseAvailability, type ResponseAvailability } from './fetch'
import type { ContextSession, WeekendContext } from '../types'

/** Shared Weekend Context terminology for coverage / availability indicators. */
export type DataAvailability = 'local' | 'partial' | 'stale' | 'archive' | 'limited' | 'missing'

/** Freshness values that warrant a non-blocking DataNotice. */
const NOTICE_FRESHNESS = new Set<string>(['stale', 'partial', 'local', 'limited', 'archive'])

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

/** Pick the first notable freshness from Weekend Context session refs. */
export function weekendContextNotice(
  context: WeekendContext,
  responseMeta?: ResponseAvailability,
): DataAvailability | null {
  const fromHeader =
    noticeFromFreshness(responseMeta?.freshness, { includeLocal: false }) ??
    noticeFromFreshness(getResponseAvailability(context)?.freshness, { includeLocal: false })
  if (fromHeader) return fromHeader

  const refs: Array<ContextSession | undefined> = [
    context.active_session,
    context.next_session,
    context.previous_completed_session,
    context.default_analysis_session,
  ]
  for (const ref of refs) {
    const notice = noticeFromFreshness(ref?.availability.freshness, { includeLocal: false })
    if (notice) return notice
  }
  return null
}
