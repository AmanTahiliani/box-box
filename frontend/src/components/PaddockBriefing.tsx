import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchChampionshipHub,
  fetchNews,
  fetchSeasonMeetings,
  fetchSeasons,
} from '../api'
import {
  activeDigestWindow,
  gpWindows,
  itemsForWindow,
  sinceLastLabel,
  tagColour,
  tagItems,
  topTags,
} from '../lib/digest'
import { timeAgo } from '../utils'
import '../styles/digest.css'

const SOURCE_DISPLAY: Record<string, string> = {
  'fia': 'FIA',
  'bbc-f1': 'BBC Sport',
  'autosport-f1': 'Autosport',
  'racefans-f1': 'RaceFans',
  'guardian-f1': 'Guardian',
  'racer-f1': 'RACER',
  'f1-youtube': 'F1 YouTube',
}

export function PaddockBriefing() {
  const now = useMemo(() => new Date(), [])

  const { data: news, isLoading, isError } = useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(100),
    staleTime: 60_000,
  })

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  })
  const latestSeason = seasonsQuery.data?.[0] ?? null

  const meetingsQuery = useQuery({
    queryKey: ['season-meetings', latestSeason],
    queryFn: () => fetchSeasonMeetings(latestSeason!),
    enabled: latestSeason != null,
  })

  const hubQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: () => fetchChampionshipHub(latestSeason!),
    enabled: latestSeason != null,
  })

  const meetings = meetingsQuery.data ?? []
  const hub = hubQuery.data
  const tagged = useMemo(
    () => tagItems(news ?? [], hub?.drivers ?? [], hub?.teams ?? []),
    [news, hub],
  )

  const windows = useMemo(() => gpWindows(meetings, now), [meetings, now])
  const activeWindow = useMemo(
    () => activeDigestWindow(windows, meetings, now),
    [windows, meetings, now],
  )
  const sinceItems = useMemo(
    () => itemsForWindow(tagged, activeWindow),
    [tagged, activeWindow],
  )
  const sinceTags = useMemo(() => topTags(sinceItems, 4), [sinceItems])
  const sinceLabel = sinceLastLabel(meetings, now)

  const unreadCount = news?.filter((i) => !i.read_at).length ?? 0
  const preview = sinceItems.length > 0 ? sinceItems.slice(0, 5) : (tagged.slice(0, 5))

  return (
    <section className="cc-briefing" data-testid="paddock-briefing">
      <div className="sec-header">
        <span className="sec-title">
          Paddock Briefing
          {unreadCount > 0 && (
            <span className="cc-brief-unread">{unreadCount}</span>
          )}
        </span>
        <Link to="/briefing" className="sec-action mono">
          View all →
        </Link>
      </div>

      {meetings.length > 0 && (
        <div className="cc-brief-digest-meta" data-testid="cc-brief-digest-meta">
          <span>Since {sinceLabel}</span>
          <span>·</span>
          <span>{sinceItems.length} items</span>
          {sinceTags.length > 0 && (
            <div className="cc-brief-digest-tags">
              {sinceTags.map((tag) => (
                <span
                  key={tag.key}
                  className="cc-brief-tag"
                  style={{ borderColor: tagColour(tag.colour) }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="briefing-state loading-state">loading…</div>}
      {isError && <div className="briefing-state error-box">Failed to load briefing</div>}

      {!isLoading && !isError && preview.length === 0 && (
        <div className="briefing-state">
          No items. Run <code>box-box --ingest-news</code> to populate.
        </div>
      )}

      {preview.length > 0 && (
        <div className="cc-brief-strip" role="list">
          {preview.map((item) => (
            <Link
              key={item.url}
              to="/briefing"
              className={`cc-brief-item${item.read_at ? ' is-read' : ''}`}
              role="listitem"
            >
              <div className="cc-brief-item-meta mono">
                <span className="cc-brief-source">
                  {SOURCE_DISPLAY[item.source] ?? item.source}
                </span>
                <span className="cc-brief-age">
                  {timeAgo(item.published_at ?? item.fetched_at)}
                </span>
              </div>
              <span className="cc-brief-title">{item.title}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
