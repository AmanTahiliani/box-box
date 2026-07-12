import type { Chapter } from '../types'
import {
  activeChapterIndex,
  chapterKindLabel,
  chapterLapRange,
  chapterStartScrub,
} from '../lib/chapters'
import '../styles/chapters.css'

interface Props {
  chapters: Chapter[]
  scrubTime: number | null
  tMin: number
  tRange: number
  tourActive: boolean
  tourChapterIndex: number | null
  onChapterClick: (index: number, scrub: number) => void
  onTourToggle: () => void
}

export function ChapterStrip({
  chapters,
  scrubTime,
  tMin,
  tRange,
  tourActive,
  tourChapterIndex,
  onChapterClick,
  onTourToggle,
}: Props) {
  if (chapters.length === 0) {
    return (
      <div className="chapter-strip" data-testid="chapter-strip">
        <p className="chapter-strip-empty">No story chapters for this session.</p>
      </div>
    )
  }

  const activeIndex = activeChapterIndex(chapters, scrubTime, tMin, tRange)

  return (
    <div className="chapter-strip" data-testid="chapter-strip">
      <div className="chapter-strip-header">
        <span className="chapter-strip-title">Race chapters</span>
        <div className="chapter-strip-actions">
          <button
            type="button"
            className={`chapter-tour-btn ${tourActive ? 'active' : ''}`}
            onClick={onTourToggle}
            aria-pressed={tourActive}
          >
            {tourActive ? 'Exit 90s' : '90s tour'}
          </button>
        </div>
      </div>
      <div className="chapter-strip-scroll" role="list" aria-label="Race story chapters">
        {chapters.map((chapter, index) => {
          const scrub = chapterStartScrub(chapter, tMin, tRange) ?? index / Math.max(chapters.length - 1, 1)
          const isActive = tourActive
            ? tourChapterIndex === index
            : activeIndex === index
          const headline = chapter.headline || chapter.title

          return (
            <button
              key={`${chapter.kind}-${chapter.start_lap}-${index}`}
              type="button"
              role="listitem"
              className={`chapter-card ${isActive ? (tourActive ? 'tour-active' : 'active') : ''}`}
              onClick={() => onChapterClick(index, scrub)}
              aria-current={isActive ? 'true' : undefined}
              data-testid={`chapter-card-${index}`}
            >
              <div className="chapter-card-top">
                <span className={`chapter-kind chapter-kind--${chapter.kind}`}>
                  {chapterKindLabel(chapter.kind)}
                </span>
                <span className="chapter-lap-range">{chapterLapRange(chapter)}</span>
              </div>
              <span className="chapter-headline">{headline}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
