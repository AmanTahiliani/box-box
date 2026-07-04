import type {
  ArticleContent,
  CarDataSample,
  ChampionshipHub,
  LapsComparisonResponse,
  LiveStateResponse,
  LiveSessionMeta,
  Meeting,
  NewsItem,
  RaceHub,
  Session,
  TrackOutline,
  Weekend,
} from './types'

export async function fetchRaceHub(sessionKey: number): Promise<RaceHub> {
  const res = await fetch(`/api/v1/race-hub?session_key=${sessionKey}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchSeasons(): Promise<number[]> {
  const res = await fetch('/api/v1/seasons')
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  const years = await res.json()
  return Array.isArray(years) ? years : []
}

export async function fetchLocalMeetings(year: number): Promise<Meeting[]> {
  const res = await fetch(`/api/v1/meetings?year=${year}&source=local`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  const meetings = await res.json()
  return Array.isArray(meetings) ? meetings : []
}

export async function fetchSeasonMeetings(year: number): Promise<Meeting[]> {
  const res = await fetch(`/api/v1/meetings?year=${year}&source=openf1`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  const meetings = await res.json()
  return Array.isArray(meetings) ? meetings : []
}

export async function fetchSessions(meetingKey: number, source = 'openf1'): Promise<Session[]> {
  const res = await fetch(`/api/v1/sessions?meeting_key=${meetingKey}&source=${source}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  const sessions = await res.json()
  return Array.isArray(sessions) ? sessions : []
}

export async function fetchWeekend(meetingKey: number): Promise<Weekend> {
  const res = await fetch(`/api/v1/weekend?meeting_key=${meetingKey}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchChampionshipHub(year?: number): Promise<ChampionshipHub> {
  const params = new URLSearchParams({ source: 'auto' })
  if (year) params.set('year', year.toString())
  const url = `/api/v1/championship/hub?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchLiveState(): Promise<LiveStateResponse> {
  const res = await fetch('/api/v1/live/state')
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchLiveTrackOutline(
  session: LiveSessionMeta,
  year = new Date().getFullYear(),
): Promise<TrackOutline> {
  const params = new URLSearchParams({ year: year.toString() })
  if (session.MeetingName) params.set('meeting_name', session.MeetingName)
  if (session.CircuitName) params.set('circuit_name', session.CircuitName)
  const res = await fetch(`/api/v1/track-outline?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchNews(limit?: number, source?: string): Promise<NewsItem[]> {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit.toString())
  if (source) params.set('source', source)

  const query = params.toString()
  const url = query ? `/api/v1/news?${query}` : '/api/v1/news'

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchNewsArticle(articleUrl: string): Promise<ArticleContent> {
  const res = await fetch(`/api/v1/news/article?url=${encodeURIComponent(articleUrl)}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
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
): Promise<CarDataSample[]> {
  const res = await fetch(
    `/api/v1/telemetry?session_key=${sessionKey}&driver_number=${driverNumber}`,
  )
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchLapsComparison(
  sessionKey: number,
  drivers?: number[],
): Promise<LapsComparisonResponse> {
  const params = new URLSearchParams({ session_key: String(sessionKey) })
  if (drivers?.length) {
    params.set('drivers', drivers.join(','))
  }
  const res = await fetch(`/api/v1/laps/comparison?${params}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}
