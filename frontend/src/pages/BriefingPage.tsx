import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNews, fetchNewsArticle, markNewsRead } from '../api'
import { stripHtml, timeAgo } from '../utils'
import type { ArticleContent, NewsItem } from '../types'

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
  onSelect,
}: {
  item: NewsItem
  isActive: boolean
  onSelect: (item: NewsItem) => void
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
        {!isVideo && (item.og_description || item.summary) && (
          <p className="bp-card-desc">
            {stripHtml(item.og_description || item.summary || '')}
          </p>
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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch article when item changes
  useEffect(() => {
    if (!item) {
      setArticle(null)
      return
    }
    setLoading(true)
    setError(null)
    setArticle(null)
    fetchNewsArticle(item.url)
      .then((data) => { setArticle(data); setLoading(false) })
      .catch((err) => { setError(String(err)); setLoading(false) })
  }, [item?.url])

  // Scroll panel to top when item changes
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
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

            {(article?.image_url || item.og_image_url) && (
              <div className="bp-reader-hero">
                <img
                  src={article?.image_url ?? item.og_image_url}
                  alt=""
                  loading="lazy"
                />
              </div>
            )}

            <div className="bp-reader-content">
              <h1 className="bp-reader-title">
                {article?.title ?? item.title}
              </h1>
              {article?.byline && (
                <div className="bp-reader-byline mono">{article.byline}</div>
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
                  // readability strips scripts/iframes; sources are all known news outlets
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
  const queryClient = useQueryClient()

  const { data: allNews = [], isLoading, isError } = useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(100),
    staleTime: 60_000,
  })

  const filtered = allNews.filter(
    (item) => activeCategory === 'all' || categoryOf(item) === activeCategory,
  )

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

  const unreadCount = allNews.filter((i) => !i.read_at).length

  return (
    <div className="bp-page" data-testid="briefing-page">
      <div className="bp-topbar">
        <span className="bp-topbar-label mono">box-box · paddock briefing</span>
        <span className="bp-topbar-meta mono">
          {unreadCount > 0 ? `${unreadCount} unread` : 'all read'}
        </span>
      </div>

      {isLoading && <div className="loading-state">loading briefing…</div>}
      {isError && <div className="error-box">Failed to load paddock briefing.</div>}

      {!isLoading && !isError && (
        <>
          <CategoryTabs
            active={activeCategory}
            counts={counts}
            onChange={(c) => { setActiveCategory(c); setSelectedItem(null) }}
          />

          {filtered.length === 0 ? (
            <div className="bp-empty">
              No {activeCategory !== 'all' ? activeCategory : ''} items available.
              Run <code>box-box --ingest-news</code> to refresh feeds.
            </div>
          ) : (
            <div className={`bp-grid${selectedItem ? ' bp-grid-narrow' : ''}`}>
              {filtered.map((item) => (
                <BriefingCard
                  key={item.url}
                  item={item}
                  isActive={selectedItem?.url === item.url}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ReaderPanel item={selectedItem} onClose={handleClose} />
    </div>
  )
}
