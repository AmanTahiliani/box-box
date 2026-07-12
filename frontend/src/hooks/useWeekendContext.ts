import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  fetchChampionshipHub,
  fetchLiveState,
  fetchLocalMeetings,
  fetchNews,
  fetchSeasonMeetings,
  fetchSeasons,
  fetchSessions,
  fetchWeekend,
  fetchWeekendContext,
} from '../api'
import { pickFocusMeeting } from '../lib/schedule'
import { deriveWeekendContext } from '../lib/weekendContext'
import type { NewsItem, Weekend, WeekendContext } from '../types'

export interface UseWeekendContextResult {
  context: WeekendContext
  /** True when the payload came from the canonical /api/v1/weekend-context endpoint. */
  fromEndpoint: boolean
  now: Date
}

/**
 * useWeekendContext prefers the canonical /api/v1/weekend-context endpoint and
 * falls back to deriving the same contract client-side from existing endpoints
 * so the Weekend home works even when the backend handler (sibling story #72) is
 * not yet deployed.
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
    queryFn: fetchWeekendContext,
    staleTime: 30_000,
  })

  const seasonsQuery = useQuery({ queryKey: ['seasons'], queryFn: fetchSeasons })
  const season = seasonsQuery.data?.[0] ?? null

  const localMeetingsQuery = useQuery({
    queryKey: ['meetings', season, 'local'],
    queryFn: () => fetchLocalMeetings(season!),
    enabled: season != null,
  })

  const seasonMeetingsQuery = useQuery({
    queryKey: ['season-meetings', season],
    queryFn: () => fetchSeasonMeetings(season!),
    enabled: season != null,
  })

  const championshipQuery = useQuery({
    queryKey: ['championship-hub', season],
    queryFn: () => fetchChampionshipHub(season!),
    enabled: season != null,
  })

  const liveQuery = useQuery({ queryKey: ['live-state'], queryFn: fetchLiveState, staleTime: 5_000 })

  const newsQuery = useQuery({ queryKey: ['news', 6], queryFn: () => fetchNews(6) })

  const localMeetings = useMemo(() => localMeetingsQuery.data ?? [], [localMeetingsQuery.data])
  const seasonMeetings = seasonMeetingsQuery.data?.length ? seasonMeetingsQuery.data : localMeetings

  const weekendQueries = useQueries({
    queries: localMeetings.map((meeting) => ({
      queryKey: ['weekend', meeting.meeting_key],
      queryFn: () => fetchWeekend(meeting.meeting_key),
      enabled: localMeetings.length > 0,
      staleTime: 60_000,
    })),
  })

  const weekendsByKey = useMemo(() => {
    const map = new Map<number, Weekend>()
    localMeetings.forEach((meeting, i) => {
      const data = weekendQueries[i]?.data
      if (data) map.set(meeting.meeting_key, data)
    })
    return map
  }, [localMeetings, weekendQueries])

  const focusMeeting = useMemo(() => pickFocusMeeting(seasonMeetings, nowDate), [seasonMeetings, nowDate])
  const focusHasLocal = focusMeeting ? weekendsByKey.has(focusMeeting.meeting_key) : false

  const focusSessionsQuery = useQuery({
    queryKey: ['sessions', focusMeeting?.meeting_key, 'openf1'],
    queryFn: () => fetchSessions(focusMeeting!.meeting_key, 'openf1'),
    enabled: focusMeeting != null && !focusHasLocal,
    staleTime: 60_000,
  })

  const news: NewsItem[] = newsQuery.data ?? []

  const derived = useMemo(
    () =>
      deriveWeekendContext({
        season,
        meetings: seasonMeetings,
        weekendsByKey,
        championship: championshipQuery.data,
        liveActive: liveQuery.data?.is_live === true,
        news,
        focusSessions: focusSessionsQuery.data,
        now: nowDate,
      }),
    [
      season,
      seasonMeetings,
      weekendsByKey,
      championshipQuery.data,
      liveQuery.data,
      news,
      focusSessionsQuery.data,
      nowDate,
    ],
  )

  if (contextQuery.data) {
    return { context: contextQuery.data, fromEndpoint: true, now: nowDate }
  }

  if (seasonsQuery.isLoading || (season != null && seasonMeetingsQuery.isLoading && localMeetingsQuery.isLoading)) {
    return { context: { state: 'loading', season: season ?? 0 }, fromEndpoint: false, now: nowDate }
  }

  if (seasonsQuery.isError) {
    return {
      context: {
        state: 'error',
        season: 0,
        message: seasonsQuery.error instanceof Error ? seasonsQuery.error.message : 'Failed to load Weekend',
      },
      fromEndpoint: false,
      now: nowDate,
    }
  }

  return { context: derived, fromEndpoint: false, now: nowDate }
}
