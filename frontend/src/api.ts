import type { ArticleContent, LiveStateResponse, Meeting, NewsItem, RaceHub, Weekend } from './types'

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

export async function fetchWeekend(meetingKey: number): Promise<Weekend> {
  const res = await fetch(`/api/v1/weekend?meeting_key=${meetingKey}`)
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
