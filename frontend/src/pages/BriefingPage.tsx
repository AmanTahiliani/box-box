import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchChampionshipHub,
  fetchNews,
  fetchNewsArticle,
  fetchSeasonMeetings,
  fetchSeasons,
  markNewsRead,
} from '../api'
import {
  activeDigestWindow,
  filterByTag,
  groupByWindow,
  gpWindows,
  itemsForWindow,
  sinceLastLabel,
  sortWindowBucketsNewestFirst,
  tagColour,
  tagItems,
  topTags,
  type DigestTag,
  type TaggedNewsItem,
} from '../lib/digest'
import { stripHtml, timeAgo } from '../utils'
import type { ArticleContent, NewsItem } from '../types'
import { DataNotice, RouteState } from '../components/RouteState'
import { noticeFromResponse, noticeMessage } from '../lib/availability'
import '../styles/digest.css'

type Category = 'all' | 'official' | 'news' | 'video'

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  official: 'Official',
  news: 'News',
  video: 'Video',
}

const SOURCE_DISPLAY: Record<string, string> = {
  'fia': 'FIA',
  'bbc-f1': 'BBC Sport',
  'autosport-f1': 'Autosport',
  'racefans-f1': 'RaceFans',
  'guardian-f1': 'Guardian',
  'racer-f1': 'RACER',
  'f1-youtube': 'F1 YouTube',
}

function displaySource(id: string): string {
  return SOURCE_DISPLAY[id] ?? id
}

function categoryOf(item: NewsItem): Category {
  const c = (item.category ?? '').toLowerCase()
  if (c === 'official') return 'official'
  if (c === 'video') return 'video'
  return 'news'
}

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

function CategoryTabs({
  active,
  counts,
  onChange,
}: {
  active: Category
  counts: Record<Category, number>
  onChange: (c: Category) => void
}) {
  return (
    <div className="bp-cats" role="tablist" aria-label="Briefing categories">
      {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
        <button
          key={cat}
          role="tab"
          aria-selected={active === cat}
          className={`bp-cat${active === cat ? ' active' : ''}`}
          onClick={() => onChange(cat)}
        >
          {CATEGORY_LABELS[cat]}
          {counts[cat] > 0 && (
            <span className="bp-cat-count">{counts[cat]}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function TagChip({
  tag,
  active,
  onClick,
  className = 'digest-tag-chip',
}: {
  tag: DigestTag
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`${className}${active ? ' active' : ''}`}
      style={{ '--tag-colour': tagColour(tag.colour) } as React.CSSProperties}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="digest-tag-dot" aria-hidden="true" />
      {tag.label}
    </button>
  )
}

function OGImage({ url, title }: { url?: string; title: string }) {
  const [failed, setFailed] = useState(false)
  const initial = (title[0] ?? '?').toUpperCase()

  if (!url || failed) {
    return (
      <div className="bp-card-img bp-card-img-fallback" aria-hidden="true">
        <span className="bp-card-img-initial">{initial}</span>
      </div>
    )
  }
  return (
    <div className="bp-card-img-wrap">
      <img
        className="bp-card-img"
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function BriefingCard({
  item,
  isActive,
  activeTag,
  onSelect,
  onTagClick,
}: {
  item: TaggedNewsItem
  isActive: boolean
  activeTag: string | null
  onSelect: (item: NewsItem) => void
  onTagClick: (tag: DigestTag) => void
}) {
  const isRead = !!item.read_at
  const isVideo = categoryOf(item) === 'video'

  return (
    <article
      className={`bp-card${isActive ? ' bp-card-active' : ''}${isRead ? ' bp-card-read' : ''}`}
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(item)}
      aria-pressed={isActive}
    >
      <OGImage url={item.og_image_url} title={item.title} />
      {isVideo && <span className="bp-video-badge">▶ Video</span>}
      <div className="bp-card-body">
        <div className="bp-card-meta mono">
          <span className="bp-card-source">{displaySource(item.source)}</span>
          <span className="bp-card-age">{timeAgo(item.published_at ?? item.fetched_at)}</span>
        </div>
        <h3 className="bp-card-title">{item.title}</h3>
        {(item.og_description || item.summary) && (
          <p className="bp-card-desc">
            {stripHtml(item.og_description || item.summary || '')}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="bp-card-tags">
            {item.tags.map((tag) => (
              <button
                key={tag.key}
                type="button"
                className={`bp-card-tag${activeTag === tag.key ? ' active' : ''}`}
                style={{ '--tag-colour': tagColour(tag.colour) } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation()
                  onTagClick(tag)
                }}
              >
                <span className="digest-tag-dot" aria-hidden="true" />
                {tag.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function ReaderPanel({
  item,
  onClose,
}: {
  item: NewsItem | null
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [article, setArticle] = useState<ArticleContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!item) {
      setArticle(null)
      return
    }
    if (categoryOf(item) === 'video') {
      setArticle(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setArticle(null)
    fetchNewsArticle(item.url)
      .then((data) => { setArticle(data); setLoading(false) })
      .catch((err) => { setError(String(err)); setLoading(false) })
  }, [item?.url, item ? categoryOf(item) : ''])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (typeof panel.scrollTo === 'function') {
      panel.scrollTo({ top: 0 })
    } else {
      panel.scrollTop = 0
    }
  }, [item?.url])

  const isOpen = item !== null

  return (
    <>
      {isOpen && (
        <div className="bp-reader-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        ref={panelRef}
        className={`bp-reader${isOpen ? ' open' : ''}`}
        aria-label="Article reader"
        aria-hidden={!isOpen}
      >
        {item && (
          <>
            <div className="bp-reader-toolbar">
              <div className="bp-reader-toolbar-meta mono">
                <span>{displaySource(item.source)}</span>
                <span className="bp-reader-dot">·</span>
                <span>{timeAgo(item.published_at ?? item.fetched_at)}</span>
              </div>
              <div className="bp-reader-toolbar-actions">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bp-reader-open"
                  title="Open in browser"
                >
                  ↗
                </a>
                <button
                  className="bp-reader-close"
                  onClick={onClose}
                  aria-label="Close reader"
                >
                  ✕
                </button>
              </div>
            </div>

            {categoryOf(item) === 'video' ? (
              <div className="bp-reader-video-container">
                <iframe
                  className="bp-reader-video-iframe"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(item.url)}?autoplay=1&rel=0`}
                  title={item.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              (article?.image_url || item.og_image_url) && (
                <div className="bp-reader-hero">
                  <img
                    src={article?.image_url ?? item.og_image_url}
                    alt=""
                    loading="lazy"
                  />
                </div>
              )
            )}

            <div className="bp-reader-content">
              <h1 className="bp-reader-title">
                {article?.title ?? item.title}
              </h1>
              {article?.byline && (
                <div className="bp-reader-byline mono">{article.byline}</div>
              )}

              {categoryOf(item) === 'video' && (
                <div className="bp-reader-video-desc">
                  {(item.og_description || item.summary) && (
                    <p className="bp-reader-fallback" style={{ marginBottom: '16px' }}>
                      {stripHtml(item.og_description || item.summary || '')}
                    </p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bp-reader-ext-link"
                    style={{ fontSize: '13px', fontWeight: 600 }}
                  >
                    Open in YouTube ↗
                  </a>
                </div>
              )}

              {loading && (
                <div className="bp-reader-loading">Loading article…</div>
              )}

              {error && !loading && (
                <div className="bp-reader-error">
                  <p>Could not load full article.</p>
                  {(item.og_description || item.summary) && (
                    <p className="bp-reader-fallback">
                      {stripHtml(item.og_description || item.summary || '')}
                    </p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bp-reader-ext-link"
                  >
                    Open in browser ↗
                  </a>
                </div>
              )}

              {article && !loading && article.content && (
                <div
                  className="bp-reader-body"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              )}

              {article && !loading && !article.content && (
                <div className="bp-reader-error">
                  <p>No article content found.</p>
                  {(item.og_description || item.summary) && (
                    <p className="bp-reader-fallback">
                      {stripHtml(item.og_description || item.summary || '')}
                    </p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bp-reader-ext-link"
                  >
                    Open in browser ↗
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

export function BriefingPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const now = useMemo(() => new Date(), [])

  const { data: allNews = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['news'],
    queryFn: ({ signal }) => fetchNews(100, undefined, signal),
    staleTime: 60_000,
  })

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: ({ signal }) => fetchSeasons(signal),
  })
  const latestSeason = seasonsQuery.data?.[0] ?? null

  const meetingsQuery = useQuery({
    queryKey: ['season-meetings', latestSeason],
    queryFn: ({ signal }) => fetchSeasonMeetings(latestSeason!, signal),
    enabled: latestSeason != null,
  })

  const hubQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: ({ signal }) => fetchChampionshipHub(latestSeason!, signal),
    enabled: latestSeason != null,
  })

  const meetings = meetingsQuery.data ?? []
  const hub = hubQuery.data

  const taggedNews = useMemo(
    () => tagItems(allNews, hub?.drivers ?? [], hub?.teams ?? []),
    [allNews, hub],
  )

  const categoryFiltered = useMemo(
    () => taggedNews.filter(
      (item) => activeCategory === 'all' || categoryOf(item) === activeCategory,
    ),
    [taggedNews, activeCategory],
  )

  const tagFiltered = useMemo(
    () => filterByTag(categoryFiltered, activeTag),
    [categoryFiltered, activeTag],
  )

  const windows = useMemo(() => gpWindows(meetings, now), [meetings, now])
  const grouped = useMemo(() => groupByWindow(tagFiltered, windows), [tagFiltered, windows])
  const windowSections = useMemo(
    () => sortWindowBucketsNewestFirst(grouped.windows),
    [grouped.windows],
  )

  const activeWindow = useMemo(
    () => activeDigestWindow(windows, meetings, now),
    [windows, meetings, now],
  )

  const sinceLastItems = useMemo(
    () => itemsForWindow(tagFiltered, activeWindow),
    [tagFiltered, activeWindow],
  )

  const sinceLastTags = useMemo(() => topTags(sinceLastItems), [sinceLastItems])
  const sinceLabel = sinceLastLabel(meetings, now)

  const taggedByUrl = useMemo(() => {
    const map = new Map<string, TaggedNewsItem>()
    for (const item of tagFiltered) map.set(item.url, item)
    return map
  }, [tagFiltered])

  const recentTagged = useMemo(() => {
    const urls = new Set(grouped.recent.map((item) => item.url))
    return tagFiltered.filter((item) => urls.has(item.url))
  }, [grouped.recent, tagFiltered])

  const counts: Record<Category, number> = {
    all: allNews.length,
    official: allNews.filter((i) => categoryOf(i) === 'official').length,
    news: allNews.filter((i) => categoryOf(i) === 'news').length,
    video: allNews.filter((i) => categoryOf(i) === 'video').length,
  }

  const handleSelect = useCallback(
    (item: NewsItem) => {
      setSelectedItem((prev) => (prev?.url === item.url ? null : item))
      if (!item.read_at) {
        markNewsRead(item.url).then(() => {
          queryClient.setQueryData<NewsItem[]>(['news'], (old) =>
            old?.map((n) =>
              n.url === item.url ? { ...n, read_at: new Date().toISOString() } : n,
            ),
          )
        })
      }
    },
    [queryClient],
  )

  const handleClose = useCallback(() => setSelectedItem(null), [])

  const handleTagClick = useCallback((tag: DigestTag) => {
    setActiveTag((current) => (current === tag.key ? null : tag.key))
    setSelectedItem(null)
  }, [])

  const unreadCount = allNews.filter((i) => !i.read_at).length
  const hasDigest = meetings.length > 0
  const showEmpty = tagFiltered.length === 0 && grouped.recent.length === 0

  const supplementsLimited =
    !isLoading &&
    !isError &&
    ((meetingsQuery.isError && !meetingsQuery.isFetching) ||
      (hubQuery.isError && !hubQuery.isFetching) ||
      (seasonsQuery.isError && !seasonsQuery.isFetching))

  const newsAvailability = noticeFromResponse(allNews, { includeLocal: true })
  const hubAvailability = noticeFromResponse(hub, { includeLocal: false })
  const meetingsAvailability = noticeFromResponse(meetings, { includeLocal: false })
  const availability = newsAvailability ?? hubAvailability ?? meetingsAvailability

  return (
    <div className="bp-page" data-testid="briefing-page">
      <div className="bp-topbar">
        <span className="bp-topbar-label mono">box-box · paddock briefing</span>
        <span className="bp-topbar-meta mono">
          {unreadCount > 0 ? `${unreadCount} unread` : 'all read'}
        </span>
      </div>

      {isLoading && (
        <RouteState kind="loading" title="loading briefing…" testId="briefing-loading" />
      )}
      {isError && (
        <RouteState
          kind="error"
          title="Briefing unavailable"
          error={error}
          onRetry={() => {
            if (!isFetching) void refetch()
          }}
          retrying={isFetching}
          testId="briefing-error"
        />
      )}

      {!isLoading && !isError && (
        <>
          {supplementsLimited && (
            <DataNotice
              availability="limited"
              message="Weekend grouping or driver tags are limited. Articles are still available."
              onRetry={() => {
                if (meetingsQuery.isError && !meetingsQuery.isFetching) void meetingsQuery.refetch()
                if (hubQuery.isError && !hubQuery.isFetching) void hubQuery.refetch()
                if (seasonsQuery.isError && !seasonsQuery.isFetching) void seasonsQuery.refetch()
              }}
              testId="briefing-data-notice"
            />
          )}
          {!supplementsLimited && availability && (
            <DataNotice
              availability={availability}
              message={noticeMessage(availability)}
              onRetry={() => {
                if (!isFetching) void refetch()
              }}
              retrying={isFetching}
              testId="briefing-data-notice"
            />
          )}

          <CategoryTabs
            active={activeCategory}
            counts={counts}
            onChange={(c) => {
              setActiveCategory(c)
              setSelectedItem(null)
              setActiveTag(null)
            }}
          />

          {hasDigest && (
            <div className="digest-sticky" data-testid="digest-sticky-header">
              <div className="digest-sticky-head">
                <h2 className="digest-sticky-title">Since {sinceLabel}</h2>
                <span className="digest-sticky-count">
                  {sinceLastItems.length} item{sinceLastItems.length === 1 ? '' : 's'}
                </span>
              </div>
              {(sinceLastTags.length > 0 || activeTag) && (
                <div className="digest-sticky-tags">
                  {sinceLastTags.map((tag) => (
                    <TagChip
                      key={tag.key}
                      tag={tag}
                      active={activeTag === tag.key}
                      onClick={() => handleTagClick(tag)}
                    />
                  ))}
                  {activeTag && (
                    <button
                      type="button"
                      className="digest-filter-clear"
                      onClick={() => setActiveTag(null)}
                      data-testid="digest-filter-clear"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {showEmpty ? (
            <div className="bp-empty">
              No {activeCategory !== 'all' ? activeCategory : ''} items available.
              {activeTag ? ' Try clearing the tag filter.' : ''}
              {!activeTag && (
                <>
                  {' '}
                  Run <code>box-box --ingest-news</code> to refresh feeds.
                </>
              )}
            </div>
          ) : (
            <>
              {windowSections.map(({ window, items }) => (
                <section
                  key={window.meeting_key}
                  className="digest-section"
                  data-testid={`digest-window-${window.meeting_key}`}
                >
                  <div className="digest-section-head">
                    <h3 className="digest-section-title">{window.meeting_name}</h3>
                    <span className="digest-section-count">{items.length}</span>
                  </div>
                  <div className={`bp-grid${selectedItem ? ' bp-grid-narrow' : ''}`}>
                    {items.map((item) => {
                      const tagged = taggedByUrl.get(item.url) ?? { ...item, tags: [] }
                      return (
                        <BriefingCard
                          key={item.url}
                          item={tagged}
                          isActive={selectedItem?.url === item.url}
                          activeTag={activeTag}
                          onSelect={handleSelect}
                          onTagClick={handleTagClick}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}

              {recentTagged.length > 0 && (
                <section className="digest-section digest-recent-section" data-testid="digest-recent">
                  <div className="digest-section-head">
                    <h3 className="digest-section-title">Recent</h3>
                    <span className="digest-section-count">{recentTagged.length}</span>
                  </div>
                  <div className={`bp-grid${selectedItem ? ' bp-grid-narrow' : ''}`}>
                    {recentTagged.map((item) => (
                      <BriefingCard
                        key={item.url}
                        item={item}
                        isActive={selectedItem?.url === item.url}
                        activeTag={activeTag}
                        onSelect={handleSelect}
                        onTagClick={handleTagClick}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <ReaderPanel item={selectedItem} onClose={handleClose} />
    </div>
  )
}
