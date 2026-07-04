import { describe, expect, it } from 'vitest'
import {
  INTERVAL_DRS_MAX_SECONDS,
  INTERVAL_UNDERCUT_MAX_SECONDS,
  INTERVAL_UNDERCUT_MIN_SECONDS,
  MAX_POINTS_PER_ROUND,
  TYRE_CLIFF_LAPS,
  intervalMeaning,
  pointsGapMeaning,
  tyreAgeMeaning,
} from '../lib/meaning'

describe('intervalMeaning', () => {
  it('returns DRS range below the threshold', () => {
    expect(intervalMeaning(0.4)?.caption).toBe('DRS range')
    expect(intervalMeaning(INTERVAL_DRS_MAX_SECONDS - 0.01)?.caption).toBe('DRS range')
  })

  it('returns undercut window in the middle band', () => {
    expect(intervalMeaning(INTERVAL_UNDERCUT_MIN_SECONDS)?.caption).toBe('undercut window')
    expect(intervalMeaning(2.0)?.caption).toBe('undercut window')
    expect(intervalMeaning(INTERVAL_UNDERCUT_MAX_SECONDS)?.caption).toBe('undercut window')
  })

  it('returns null outside known bands', () => {
    expect(intervalMeaning(INTERVAL_UNDERCUT_MAX_SECONDS + 0.5)).toBeNull()
    expect(intervalMeaning(10)).toBeNull()
    expect(intervalMeaning(null)).toBeNull()
    expect(intervalMeaning(undefined)).toBeNull()
    expect(intervalMeaning(-1)).toBeNull()
  })
})

describe('tyreAgeMeaning', () => {
  it('labels fresh, mid-life, and laps-to-cliff for SOFT', () => {
    const cliff = TYRE_CLIFF_LAPS.SOFT
    expect(tyreAgeMeaning('SOFT', 2)?.caption).toBe('fresh')
    expect(tyreAgeMeaning('SOFT', Math.ceil(cliff * 0.5))?.caption).toBe('mid-life')
    expect(tyreAgeMeaning('SOFT', cliff - 2)?.caption).toBe('~2 laps to cliff')
    expect(tyreAgeMeaning('SOFT', cliff + 5)?.caption).toBe('past cliff')
  })

  it('handles unknown compounds with defaults', () => {
    expect(tyreAgeMeaning('UNKNOWN', 3)?.caption).toBe('fresh')
    expect(tyreAgeMeaning(undefined, 3)?.caption).toBe('fresh')
  })

  it('returns null for invalid age', () => {
    expect(tyreAgeMeaning('MEDIUM', null)).toBeNull()
    expect(tyreAgeMeaning('MEDIUM', -1)).toBeNull()
  })
})

describe('pointsGapMeaning', () => {
  it('computes catchable pts/round', () => {
    const result = pointsGapMeaning(40, 4, 'VER')
    expect(result?.caption).toBe('~10 pts/round')
    expect(result?.title).toContain('VER')
  })

  it('marks uncatchable gaps', () => {
    const max = 3 * MAX_POINTS_PER_ROUND
    expect(pointsGapMeaning(max + 1, 3, 'VER')?.caption).toBe('out of reach')
  })

  it('returns null for leader or invalid input', () => {
    expect(pointsGapMeaning(0, 4)).toBeNull()
    expect(pointsGapMeaning(10, 0)).toBeNull()
    expect(pointsGapMeaning(null, 4)).toBeNull()
  })
})
