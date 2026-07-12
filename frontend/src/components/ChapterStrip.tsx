import { useEffect, useRef } from 'react'
import { BookOpen } from 'lucide-react'
import type { Chapter } from '../types'
import {
  activeChapterIndex,
  chapterKindLabel,
  chapterLapRange,
  chapterStartScrub,
} from '../lib/chapters'
import { EmptyStateCard } from './EmptyStateCard'
import '../styles/chapters.css'

interface Props {
  chapters: Chapter[]
  scrubTime: number | null
  tMin: number
  tRange: number
  tourActive: boolean
  tourChapterIndex: number | null
  /** Explicit selection from a chapter click; wins over scrub-derived active. */
  selectedChapterIndex?: number | null
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
  selectedChapterIndex = null,
  onChapterClick,
  onTourToggle,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeIndex = activeChapterIndex(chapters, scrubTime, tMin, tRange)
  const highlightedIndex = tourActive
    ? tourChapterIndex
    : (selectedChapterIndex ?? activeIndex)

  useEffect(() => {
    if (highlightedIndex === null || !scrollRef.current) return
    const card = scrollRef.current.querySelector<HTMLElement>(
      `[data-testid="chapter-card-${highlightedIndex}"]`,
    )
    card?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [highlightedIndex])

  if (chapters.length === 0) {
    return (
      <div className="chapter-strip" data-testid="chapter-strip">
        <EmptyStateCard
          icon={BookOpen}
          title="No story chapters"
          hint="This session does not have enough race-control or position data to build narrative chapters."
          testId="chapter-strip-empty"
          className="chapter-strip-empty-card"
        />
      </div>
    )
  }

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
      <div className="chapter-strip-scroll-wrap">
        <div
          ref={scrollRef}
          className="chapter-strip-scroll"
          role="list"
          aria-label="Race story chapters"
        >
          {chapters.map((chapter, index) => {
            const scrub = chapterStartScrub(chapter, tMin, tRange) ?? index / Math.max(chapters.length - 1, 1)
            const isActive = highlightedIndex === index
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
    </div>
  )
}
