import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChapterStrip } from '../components/ChapterStrip'
import type { Chapter } from '../types'

const chapters: Chapter[] = [
  {
    kind: 'start',
    title: 'Start',
    headline: 'Lights out — the field charges into Turn 1',
    start_lap: 1,
    end_lap: 1,
    start_time: '2025-05-25T13:00:00Z',
    end_time: '2025-05-25T13:01:00Z',
    driver_numbers: [],
  },
  {
    kind: 'safety_car',
    title: 'Safety Car (L12-L15)',
    headline: 'Sainz incident brings out the Safety Car — leaders dive for the pits',
    start_lap: 12,
    end_lap: 15,
    start_time: '2025-05-25T13:12:00Z',
    end_time: '2025-05-25T13:15:00Z',
    driver_numbers: [55],
  },
]

const tMin = new Date('2025-05-25T13:00:00Z').getTime()
const tMax = new Date('2025-05-25T13:20:00Z').getTime()
const tRange = tMax - tMin

function renderStrip(
  overrides: Partial<{
    scrubTime: number | null
    onChapterClick: (index: number, scrub: number) => void
  }> = {},
) {
  const onChapterClick = overrides.onChapterClick ?? vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ChapterStrip
        chapters={chapters}
        scrubTime={overrides.scrubTime ?? null}
        tMin={tMin}
        tRange={tRange}
        tourActive={false}
        tourChapterIndex={null}
        onChapterClick={onChapterClick}
        onTourToggle={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return { onChapterClick }
}

describe('ChapterStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders chapter headlines and lap ranges', () => {
    renderStrip()
    expect(screen.getByTestId('chapter-strip')).toBeInTheDocument()
    expect(screen.getByText('Lights out — the field charges into Turn 1')).toBeInTheDocument()
    expect(screen.getByText('L12–L15')).toBeInTheDocument()
  })

  it('renders an empty-state card when there are no chapters', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ChapterStrip
          chapters={[]}
          scrubTime={null}
          tMin={tMin}
          tRange={tRange}
          tourActive={false}
          tourChapterIndex={null}
          onChapterClick={vi.fn()}
          onTourToggle={vi.fn()}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('chapter-strip-empty')).toBeInTheDocument()
  })

  it('highlights the active chapter from scrub time', () => {
    const scrub = (new Date('2025-05-25T13:13:00Z').getTime() - tMin) / tRange
    renderStrip({ scrubTime: scrub })
    expect(screen.getByTestId('chapter-card-1')).toHaveClass('active')
    expect(screen.getByTestId('chapter-card-0')).not.toHaveClass('active')
  })

  it('calls click handler to jump scrubber', () => {
    const onChapterClick = vi.fn<(index: number, scrub: number) => void>()
    renderStrip({ onChapterClick })
    fireEvent.click(screen.getByTestId('chapter-card-1'))
    expect(onChapterClick).toHaveBeenCalledTimes(1)
    const [index, scrub] = onChapterClick.mock.calls[0]
    expect(index).toBe(1)
    expect(scrub).toBeCloseTo(0.6, 2)
  })
})
