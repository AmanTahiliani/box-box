import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../api'
import { timeAgo } from '../utils'

export function PaddockBriefing() {
  const { data: news, isLoading, isError } = useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(12),
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="briefing-state loading-state">loading paddock briefing…</div>
  }

  if (isError || !news) {
    return <div className="briefing-state error-box">Failed to load paddock briefing</div>
  }

  if (news.length === 0) {
    return <div className="briefing-state empty-box">No briefing items available.</div>
  }

  return (
    <section className="cc-briefing" data-testid="paddock-briefing">
      <div className="sec-header">
        <span className="sec-title">Paddock Briefing</span>
        <span className="sec-meta mono">Latest intel</span>
      </div>
      <div className="briefing-grid" role="list">
        {news.map((item, i) => {
          const age = timeAgo(item.published_at || item.fetched_at)
          return (
            <a
              key={`${item.url}-${i}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="briefing-card"
              role="listitem"
            >
              <div className="briefing-card-head mono">
                <span className="briefing-source">{item.source}</span>
                <span className="briefing-age">{age}</span>
              </div>
              <h3 className="briefing-title">{item.title}</h3>
              {item.summary && (
                <p className="briefing-summary">
                  {item.summary.length > 120 ? item.summary.substring(0, 117) + '...' : item.summary}
                </p>
              )}
              {item.category && (
                <div className="briefing-cat mono">{item.category.toLowerCase()}</div>
              )}
            </a>
          )
        })}
      </div>
    </section>
  )
}
