import { describe, expect, it } from 'vitest'
import {
  MAX_GAP_SAMPLES,
  gapTrend,
  parseIntervalSeconds,
  recordGapSamples,
  sparklinePoints,
} from '../lib/gapHistory'
import type { GapHistoryMap } from '../lib/gapHistory'

describe('parseIntervalSeconds', () => {
  it('parses signed and unsigned decimal gaps', () => {
    expect(parseIntervalSeconds('+1.234')).toBe(1.234)
    expect(parseIntervalSeconds('1.234')).toBe(1.234)
    expect(parseIntervalSeconds('+0.4')).toBe(0.4)
    expect(parseIntervalSeconds('12')).toBe(12)
    expect(parseIntervalSeconds('-0.5')).toBe(-0.5)
  })

  it('parses minute-form gaps', () => {
    expect(parseIntervalSeconds('+1:05.234')).toBeCloseTo(65.234)
  })

  it('rejects leader, lapped, and garbage markers', () => {
    expect(parseIntervalSeconds('')).toBeNull()
    expect(parseIntervalSeconds('   ')).toBeNull()
    expect(parseIntervalSeconds(undefined)).toBeNull()
    expect(parseIntervalSeconds(null)).toBeNull()
    expect(parseIntervalSeconds('LAP 12')).toBeNull()
    expect(parseIntervalSeconds('1L')).toBeNull()
    expect(parseIntervalSeconds('+1 LAP')).toBeNull()
    expect(parseIntervalSeconds('2 LAPS')).toBeNull()
    expect(parseIntervalSeconds('abc')).toBeNull()
  })
})

describe('recordGapSamples', () => {
  it('appends one sample per snapshot and does not mutate the input', () => {
    const initial = { '1': [1.0] }
    const next = recordGapSamples(initial, [
      { racingNumber: '1', interval: '+0.9' },
      { racingNumber: '4', interval: '+1.5' },
    ])
    expect(next['1']).toEqual([1.0, 0.9])
    expect(next['4']).toEqual([1.5])
    expect(initial['1']).toEqual([1.0])
  })

  it('keeps existing history when the interval is unparsable', () => {
    const next = recordGapSamples({ '1': [1.2, 1.1] }, [{ racingNumber: '1', interval: '1L' }])
    expect(next['1']).toEqual([1.2, 1.1])
  })

  it('prunes drivers missing from the snapshot', () => {
    const next = recordGapSamples({ '99': [3.0] }, [{ racingNumber: '1', interval: '+0.5' }])
    expect(next['99']).toBeUndefined()
  })

  it('caps the ring buffer', () => {
    let history: GapHistoryMap = {}
    for (let i = 0; i < 50; i++) {
      history = recordGapSamples(history, [{ racingNumber: '1', interval: `+${i}.0` }])
    }
    expect(history['1']).toHaveLength(MAX_GAP_SAMPLES)
    expect(history['1'][MAX_GAP_SAMPLES - 1]).toBe(49)
    expect(history['1'][0]).toBe(50 - MAX_GAP_SAMPLES)
  })

  it('respects a custom cap', () => {
    const next = recordGapSamples({ '1': [1, 2, 3] }, [{ racingNumber: '1', interval: '+4.0' }], 3)
    expect(next['1']).toEqual([2, 3, 4])
  })
})

describe('gapTrend', () => {
  it('detects a closing gap', () => {
    expect(gapTrend([2.0, 1.8, 1.6, 1.4, 1.2, 1.0])).toBe('closing')
  })

  it('detects an opening gap', () => {
    expect(gapTrend([1.0, 1.2, 1.4, 1.6, 1.8, 2.0])).toBe('opening')
  })

  it('reports steady within the threshold', () => {
    expect(gapTrend([1.0, 1.02, 0.98, 1.01, 1.0, 0.99])).toBe('steady')
  })

  it('needs at least three samples', () => {
    expect(gapTrend([])).toBeNull()
    expect(gapTrend([1.0])).toBeNull()
    expect(gapTrend([1.0, 0.5])).toBeNull()
  })
})

describe('sparklinePoints', () => {
  it('returns empty for insufficient samples', () => {
    expect(sparklinePoints([], 56, 14)).toBe('')
    expect(sparklinePoints([1.0], 56, 14)).toBe('')
  })

  it('spans the full width and inverts the y axis (smaller gap = lower)', () => {
    const points = sparklinePoints([0, 10], 56, 14).split(' ')
    expect(points).toHaveLength(2)
    const [x1, y1] = points[0].split(',').map(Number)
    const [x2, y2] = points[1].split(',').map(Number)
    expect(x1).toBe(0)
    expect(x2).toBe(56)
    expect(y1).toBeGreaterThan(y2) // larger gap plots higher (smaller y)
  })

  it('draws a mid line for flat data', () => {
    const points = sparklinePoints([1, 1, 1], 56, 14).split(' ')
    for (const point of points) {
      expect(Number(point.split(',')[1])).toBe(7)
    }
  })
})
