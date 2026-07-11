import { describe, it, expect } from 'vitest'
import { gapSeries, h2hTally, lastRounds } from '../lib/rivalry'

describe('gapSeries', () => {
  it('computes per-round a − b', () => {
    expect(gapSeries([25, 43, 68], [18, 36, 54])).toEqual([7, 7, 14])
  })

  it('handles negative gaps (b ahead)', () => {
    expect(gapSeries([10, 20], [18, 36])).toEqual([-8, -16])
  })

  it('truncates to the shorter series', () => {
    expect(gapSeries([25, 43, 68], [18])).toEqual([7])
    expect(gapSeries([], [18, 36])).toEqual([])
  })
})

describe('h2hTally', () => {
  it('tallies lower-position wins per round', () => {
    const t = h2hTally([1, 2, 1], [2, 1, 3], ['R1', 'R2', 'R3'])
    expect(t.a).toBe(2)
    expect(t.b).toBe(1)
    expect(t.skipped).toBe(0)
    expect(t.rounds.map((r) => r.winner)).toEqual(['a', 'b', 'a'])
    expect(t.rounds[0]).toEqual({ round: 1, label: 'R1', posA: 1, posB: 2, winner: 'a' })
  })

  it('skips rounds where either driver has no position', () => {
    // R2: a missing (0). R3: b missing (0). Only R1 and R4 count.
    const t = h2hTally([1, 0, 5, 3], [4, 2, 0, 1], ['R1', 'R2', 'R3', 'R4'])
    expect(t.a).toBe(1)
    expect(t.b).toBe(1)
    expect(t.skipped).toBe(2)
    expect(t.rounds.map((r) => r.round)).toEqual([1, 4])
  })

  it('handles arrays of different lengths (missing tail = skipped)', () => {
    const t = h2hTally([1, 2, 3], [2], ['R1', 'R2', 'R3'])
    expect(t.a).toBe(1)
    expect(t.b).toBe(0)
    expect(t.skipped).toBe(2)
  })

  it('skips equal positions defensively and falls back on labels', () => {
    const t = h2hTally([2, 1], [2, 3], ['R1'])
    expect(t.a).toBe(1)
    expect(t.b).toBe(0)
    expect(t.skipped).toBe(1)
    expect(t.rounds[0].label).toBe('R2')
  })

  it('returns an empty tally for empty inputs', () => {
    const t = h2hTally([], [], [])
    expect(t).toEqual({ a: 0, b: 0, rounds: [], skipped: 0 })
  })
})

describe('lastRounds', () => {
  it('returns the last n counted rounds in order', () => {
    const t = h2hTally([1, 1, 1, 2, 1, 1, 2], [2, 2, 2, 1, 2, 2, 1], [])
    const last = lastRounds(t, 5)
    expect(last).toHaveLength(5)
    expect(last.map((r) => r.round)).toEqual([3, 4, 5, 6, 7])
  })

  it('returns fewer when the tally has fewer counted rounds', () => {
    const t = h2hTally([1, 0], [2, 0], [])
    expect(lastRounds(t, 5)).toHaveLength(1)
  })
})
