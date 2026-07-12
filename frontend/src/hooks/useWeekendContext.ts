import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChampionshipHub, fetchNews, fetchWeekendContext } from '../api'
import { championshipImpact, briefingItems } from '../lib/weekendContext'
import type {
  WeekendChampionshipImpact,
  WeekendBriefingItem,
  WeekendContext,
} from '../types'

export type WeekendLoadState = 'loading' | 'error' | 'ready'

export interface UseWeekendContextResult {
  /** Canonical context, present only when loadState === 'ready'. */
  context: WeekendContext | null
  loadState: WeekendLoadState
  error?: Error
  /** Supplementary championship movers (not part of the #72 contract). */
  championship?: WeekendChampionshipImpact
  /** Supplementary briefing items (not part of the #72 contract). */
  briefing: WeekendBriefingItem[]
  now: Date
  /** Refetch the canonical weekend-context read. */
  refetch: () => void
  /** True while a canonical refetch is in flight. */
  isFetching: boolean
}

/**
 * useWeekendContext reads the canonical /api/v1/weekend-context endpoint as the
 * single source of truth for the Weekend home. When the canonical read succeeds
 * it layers on two pieces of supplementary data that the contract intentionally
 * omits — championship movers and the paddock briefing — and nothing else.
 *
 * It deliberately does NOT fan out to season / meetings / per-weekend / OpenF1
 * session / live-state queries: those would defeat the local-first canonical read
 * model and can hit the rate-limited OpenF1 REST surface during active sessions.
 * Supplementary queries are gated on a successful canonical read so a failing or
 * pending endpoint issues no extra requests.
 */
export function useWeekendContext(): UseWeekendContextResult {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const nowDate = useMemo(() => new Date(now), [now])

  const contextQuery = useQuery({
    queryKey: ['weekend-context'],
    queryFn: ({ signal }) => fetchWeekendContext(signal),
    staleTime: 30_000,
  })

  const canonical = contextQuery.data ?? null
  const canonicalReady = canonical != null
  const season = canonical?.season

  // Supplementary data — only fetched once the canonical context has resolved,
  // so a pending/failed canonical read never triggers a request fan-out.
  const championshipQuery = useQuery({
    queryKey: ['championship-hub', season ?? 'current'],
    queryFn: ({ signal }) => fetchChampionshipHub(season, signal),
    enabled: canonicalReady,
    staleTime: 60_000,
  })

  const newsQuery = useQuery({
    queryKey: ['news', 6],
    queryFn: ({ signal }) => fetchNews(6, undefined, signal),
    enabled: canonicalReady,
    staleTime: 60_000,
  })

  const championship = useMemo(
    () => championshipImpact(championshipQuery.data),
    [championshipQuery.data],
  )
  const briefing = useMemo(() => briefingItems(newsQuery.data ?? []), [newsQuery.data])

  let loadState: WeekendLoadState = 'loading'
  if (contextQuery.isError) loadState = 'error'
  else if (canonicalReady) loadState = 'ready'

  return {
    context: canonical,
    loadState,
    error: contextQuery.error instanceof Error ? contextQuery.error : undefined,
    championship,
    briefing,
    now: nowDate,
    refetch: () => {
      if (!contextQuery.isFetching) void contextQuery.refetch()
    },
    isFetching: contextQuery.isFetching,
  }
}
