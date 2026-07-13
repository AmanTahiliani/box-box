import { apiFetch } from './lib/fetch'
import type {
  ArticleContent,
  CarDataSample,
  ChampionshipHub,
  DriverSummary,
  EnrichedGrid,
  EnrichedResult,
  LapsComparisonResponse,
  LiveStateResponse,
  LiveSessionMeta,
  Meeting,
  NewsItem,
  RaceHub,
  ReplayFramesResponse,
  Session,
  TrackOutline,
  Weekend,
  WeekendContext,
} from './types'

export async function fetchRaceHub(sessionKey: number, signal?: AbortSignal): Promise<RaceHub> {
  return apiFetch<RaceHub>(`/api/v1/race-hub?session_key=${sessionKey}`, {
    signal,
    dedupeKey: `race-hub:${sessionKey}`,
  })
}

export async function fetchSeasons(signal?: AbortSignal): Promise<number[]> {
  const years = await apiFetch<number[]>('/api/v1/seasons', {
    signal,
    dedupeKey: 'seasons',
  })
  return Array.isArray(years) ? years : []
}

export async function fetchLocalMeetings(year: number, signal?: AbortSignal): Promise<Meeting[]> {
  const meetings = await apiFetch<Meeting[]>(`/api/v1/meetings?year=${year}&source=local`, {
    signal,
    dedupeKey: `meetings:local:${year}`,
  })
  return Array.isArray(meetings) ? meetings : []
}

export async function fetchSeasonMeetings(year: number, signal?: AbortSignal): Promise<Meeting[]> {
  return fetchMeetings(year, 'openf1', signal)
}

export async function fetchMeetings(
  year: number,
  source = 'auto',
  signal?: AbortSignal,
): Promise<Meeting[]> {
  const meetings = await apiFetch<Meeting[]>(`/api/v1/meetings?year=${year}&source=${source}`, {
    signal,
    dedupeKey: `meetings:${source}:${year}`,
  })
  return Array.isArray(meetings) ? meetings : []
}

export async function fetchResults(
  sessionKey: number,
  source = 'auto',
  signal?: AbortSignal,
): Promise<EnrichedResult[]> {
  const results = await apiFetch<EnrichedResult[]>(
    `/api/v1/results?session_key=${sessionKey}&source=${source}`,
    { signal, dedupeKey: `results:${source}:${sessionKey}` },
  )
  return Array.isArray(results) ? results : []
}

export async function fetchStartingGrid(
  sessionKey: number,
  source = 'auto',
  signal?: AbortSignal,
): Promise<EnrichedGrid[]> {
  const grid = await apiFetch<EnrichedGrid[]>(
    `/api/v1/grid?session_key=${sessionKey}&source=${source}`,
    { signal, dedupeKey: `grid:${source}:${sessionKey}` },
  )
  return Array.isArray(grid) ? grid : []
}

export async function fetchTrackOutline(
  circuitKey: number,
  year: number,
  signal?: AbortSignal,
): Promise<TrackOutline | null> {
  try {
    const data = await apiFetch<TrackOutline & { error?: string }>(
      `/api/v1/track-outline?circuit_key=${circuitKey}&year=${year}`,
      { signal, dedupeKey: `track-outline:${circuitKey}:${year}` },
    )
    if (data?.error || !Array.isArray(data?.points) || data.points.length < 2) return null
    return data as TrackOutline
  } catch {
    return null
  }
}

export async function fetchReplayFrames(
  sessionKey: number,
  intervalMs = 5000,
  signal?: AbortSignal,
): Promise<ReplayFramesResponse> {
  const params = new URLSearchParams({
    session_key: String(sessionKey),
    interval_ms: String(intervalMs),
  })
  return apiFetch<ReplayFramesResponse>(`/api/v1/replay/frames?${params}`, {
    signal,
    dedupeKey: `replay-frames:${sessionKey}:${intervalMs}`,
  })
}

export async function fetchSessions(
  meetingKey: number,
  source = 'openf1',
  signal?: AbortSignal,
): Promise<Session[]> {
  const sessions = await apiFetch<Session[]>(
    `/api/v1/sessions?meeting_key=${meetingKey}&source=${source}`,
    { signal, dedupeKey: `sessions:${source}:${meetingKey}` },
  )
  return Array.isArray(sessions) ? sessions : []
}

export async function fetchWeekend(meetingKey: number, signal?: AbortSignal): Promise<Weekend> {
  return apiFetch<Weekend>(`/api/v1/weekend?meeting_key=${meetingKey}`, {
    signal,
    dedupeKey: `weekend:${meetingKey}`,
  })
}

// fetchWeekendContext consumes the canonical /api/v1/weekend-context endpoint
// (backend story #72). The response is the authoritative WeekendContext shape and
// is used verbatim as the Weekend home's source of truth. Any HTTP error throws
// so the hook can surface an explicit error state; there is no client-side
// re-derivation of the contract. Race Hub bare-default landing also reads this
// for `default_analysis_session` (#75).
export async function fetchWeekendContext(signal?: AbortSignal): Promise<WeekendContext> {
  return apiFetch<WeekendContext>('/api/v1/weekend-context', {
    signal,
    dedupeKey: 'weekend-context',
  })
}

export async function fetchChampionshipHub(
  year?: number,
  signal?: AbortSignal,
): Promise<ChampionshipHub> {
  const params = new URLSearchParams({ source: 'auto' })
  if (year) params.set('year', year.toString())
  return apiFetch<ChampionshipHub>(`/api/v1/championship/hub?${params.toString()}`, {
    signal,
    dedupeKey: `championship-hub:${year ?? 'latest'}`,
  })
}

export async function fetchDriverSummary(
  driverNumber: number,
  year?: number,
  signal?: AbortSignal,
): Promise<DriverSummary> {
  const params = new URLSearchParams({ driver_number: String(driverNumber), source: 'auto' })
  if (year) params.set('year', String(year))
  return apiFetch<DriverSummary>(`/api/v1/driver/summary?${params.toString()}`, {
    signal,
    dedupeKey: `driver-summary:${driverNumber}:${year ?? 'latest'}`,
  })
}

export async function fetchLiveState(signal?: AbortSignal): Promise<LiveStateResponse> {
  return apiFetch<LiveStateResponse>('/api/v1/live/state', {
    signal,
    dedupeKey: 'live-state',
  })
}

export async function fetchLiveTrackOutline(
  session: LiveSessionMeta,
  year = new Date().getFullYear(),
  signal?: AbortSignal,
): Promise<TrackOutline> {
  const params = new URLSearchParams({ year: year.toString() })
  if (session.MeetingName) params.set('meeting_name', session.MeetingName)
  if (session.CircuitName) params.set('circuit_name', session.CircuitName)
  return apiFetch<TrackOutline>(`/api/v1/track-outline?${params.toString()}`, {
    signal,
    dedupeKey: `live-track-outline:${year}:${session.MeetingName ?? ''}:${session.CircuitName ?? ''}`,
  })
}

export async function fetchNews(
  limit?: number,
  source?: string,
  signal?: AbortSignal,
): Promise<NewsItem[]> {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit.toString())
  if (source) params.set('source', source)

  const query = params.toString()
  const url = query ? `/api/v1/news?${query}` : '/api/v1/news'

  return apiFetch<NewsItem[]>(url, {
    signal,
    dedupeKey: `news:${limit ?? 'all'}:${source ?? 'all'}`,
  })
}

export async function fetchNewsArticle(
  articleUrl: string,
  signal?: AbortSignal,
): Promise<ArticleContent> {
  return apiFetch<ArticleContent>(
    `/api/v1/news/article?url=${encodeURIComponent(articleUrl)}`,
    { signal },
  )
}

export async function markNewsRead(articleUrl: string): Promise<void> {
  await fetch('/api/v1/news/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: articleUrl }),
  })
}

export async function fetchTelemetry(
  sessionKey: number,
  driverNumber: number,
  signal?: AbortSignal,
): Promise<CarDataSample[]> {
  const data = await apiFetch<CarDataSample[]>(
    `/api/v1/telemetry?session_key=${sessionKey}&driver_number=${driverNumber}`,
    { signal, dedupeKey: `telemetry:${sessionKey}:${driverNumber}` },
  )
  return Array.isArray(data) ? data : []
}

export async function fetchLapsComparison(
  sessionKey: number,
  drivers?: number[],
  signal?: AbortSignal,
): Promise<LapsComparisonResponse> {
  const params = new URLSearchParams({ session_key: String(sessionKey) })
  if (drivers?.length) {
    params.set('drivers', drivers.join(','))
  }
  return apiFetch<LapsComparisonResponse>(`/api/v1/laps/comparison?${params}`, {
    signal,
    dedupeKey: `laps-comparison:${sessionKey}:${drivers?.join(',') ?? 'all'}`,
  })
}
