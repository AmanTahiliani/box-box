import { describe, expect, it } from 'vitest'
import {
  activeChapterIndex,
  chapterBandFill,
  chapterKindLabel,
  chapterLapRange,
  chapterStartScrub,
  chapterTourDurations,
  deCollideYPositions,
  decimatedPositionLabels,
} from '../lib/chapters'
import type { Chapter } from '../types'

const sampleChapters: Chapter[] = [
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

describe('chapters lib', () => {
  it('labels chapter kinds', () => {
    expect(chapterKindLabel('safety_car')).toBe('SC')
    expect(chapterKindLabel('finish')).toBe('FIN')
  })

  it('formats lap ranges', () => {
    expect(chapterLapRange(sampleChapters[0])).toBe('L1')
    expect(chapterLapRange(sampleChapters[1])).toBe('L12–L15')
  })

  it('maps chapter start time to scrub position', () => {
    const tMin = new Date('2025-05-25T13:00:00Z').getTime()
    const tMax = new Date('2025-05-25T13:20:00Z').getTime()
    const scrub = chapterStartScrub(sampleChapters[1], tMin, tMax - tMin)
    expect(scrub).toBeCloseTo(0.6, 2)
  })

  it('finds active chapter from scrub time', () => {
    const tMin = new Date('2025-05-25T13:00:00Z').getTime()
    const tMax = new Date('2025-05-25T13:20:00Z').getTime()
    const tRange = tMax - tMin
    const scrub = (new Date('2025-05-25T13:13:00Z').getTime() - tMin) / tRange
    expect(activeChapterIndex(sampleChapters, scrub, tMin, tRange)).toBe(1)
  })

  it('activates chapters whose timestamps clamp outside the position window', () => {
    // Position samples only cover 13:05–13:10; chapters sit before/after that window.
    const tMin = new Date('2025-05-25T13:05:00Z').getTime()
    const tMax = new Date('2025-05-25T13:10:00Z').getTime()
    const tRange = tMax - tMin
    const outOfWindow: Chapter[] = [
      {
        kind: 'start',
        title: 'Start',
        headline: 'Lights out',
        start_lap: 1,
        end_lap: 1,
        start_time: '2025-05-25T13:00:00Z',
        end_time: '2025-05-25T13:01:00Z',
        driver_numbers: [],
      },
      {
        kind: 'finish',
        title: 'Finish',
        headline: 'Chequered flag',
        start_lap: 78,
        end_lap: 78,
        start_time: '2025-05-25T13:20:00Z',
        end_time: '2025-05-25T13:21:00Z',
        driver_numbers: [],
      },
    ]

    expect(chapterStartScrub(outOfWindow[0], tMin, tRange)).toBe(0)
    expect(chapterStartScrub(outOfWindow[1], tMin, tRange)).toBe(1)
    expect(activeChapterIndex(outOfWindow, 0, tMin, tRange)).toBe(0)
    expect(activeChapterIndex(outOfWindow, 1, tMin, tRange)).toBe(1)
    expect(activeChapterIndex(outOfWindow, 0.5, tMin, tRange)).toBeNull()
  })

  it('splits 90s evenly across chapters', () => {
    expect(chapterTourDurations(sampleChapters)).toEqual([45_000, 45_000])
  })

  it('decimates position axis labels', () => {
    expect(decimatedPositionLabels(22)).toEqual([1, 5, 10, 15, 20, 22])
  })

  it('returns chapter band fills by kind', () => {
    expect(chapterBandFill('safety_car')).toContain('rgba')
    expect(chapterBandFill('virtual_safety_car')).toContain('rgba')
  })

  it('de-collides overlapping label y positions', () => {
    const adjusted = deCollideYPositions(
      [
        { key: 'a', y: 10 },
        { key: 'b', y: 12 },
        { key: 'c', y: 30 },
      ],
      12,
    )
    expect(adjusted.get('a')).toBe(10)
    expect(adjusted.get('b')).toBe(22)
    expect(adjusted.get('c')).toBe(34)
  })
})
