import { describe, it, expect } from 'vitest'
import {
  formatDelta,
  formatPosition,
  gridFinishDeltas,
  shortGpLabel,
} from '../lib/driverProfile'
import type { DriverSummaryRound } from '../types'

function round(over: Partial<DriverSummaryRound>): DriverSummaryRound {
  return {
    meeting_key: 1201,
    meeting_name: 'Bahrain Grand Prix',
    country_code: 'BHR',
    country_name: 'Bahrain',
    race_position: 1,
    grid_position: 1,
    quali_position: 1,
    points: 25,
    dnf: false,
    dns: false,
    dsq: false,
    ...over,
  }
}

describe('gridFinishDeltas', () => {
  it('computes positive delta for places gained', () => {
    const [d] = gridFinishDeltas([round({ grid_position: 5, race_position: 2, points: 18 })])
    expect(d.grid).toBe(5)
    expect(d.finish).toBe(2)
    expect(d.delta).toBe(3)
    expect(d.points).toBe(18)
    expect(d.status).toBe('classified')
    expect(d.round).toBe(1)
  })

  it('computes negative delta for places lost', () => {
    const [d] = gridFinishDeltas([round({ grid_position: 1, race_position: 4 })])
    expect(d.delta).toBe(-3)
  })

  it('returns null delta when the grid slot is unknown (position 0)', () => {
    const [d] = gridFinishDeltas([round({ grid_position: 0, race_position: 6 })])
    expect(d.grid).toBeNull()
    expect(d.finish).toBe(6)
    expect(d.delta).toBeNull()
  })

  it('flags DNS rounds and never computes a delta for them', () => {
    const [d] = gridFinishDeltas([round({ dns: true, grid_position: 8, race_position: 0 })])
    expect(d.status).toBe('dns')
    expect(d.delta).toBeNull()
  })

  it('marks rounds the driver did not enter as absent', () => {
    const [d] = gridFinishDeltas([round({ grid_position: 0, race_position: 0, points: 0 })])
    expect(d.status).toBe('absent')
    expect(d.grid).toBeNull()
    expect(d.finish).toBeNull()
    expect(d.delta).toBeNull()
  })

  it('still computes the delta for a classified DNF with known positions', () => {
    const [d] = gridFinishDeltas([round({ dnf: true, grid_position: 3, race_position: 15 })])
    expect(d.status).toBe('dnf')
    expect(d.delta).toBe(-12)
  })

  it('numbers rounds sequentially and shortens labels', () => {
    const ds = gridFinishDeltas([
      round({}),
      round({ meeting_name: 'Saudi Arabian Grand Prix', meeting_key: 1202 }),
    ])
    expect(ds.map((d) => d.round)).toEqual([1, 2])
    expect(ds[1].label).toBe('Saudi Arabian')
  })
})

describe('shortGpLabel', () => {
  it('strips "Grand Prix" wherever it appears', () => {
    expect(shortGpLabel('Bahrain Grand Prix')).toBe('Bahrain')
    expect(shortGpLabel('Grand Prix of Monaco')).toBe('of Monaco')
  })

  it('falls back to the original name when stripping empties it', () => {
    expect(shortGpLabel('Grand Prix')).toBe('Grand Prix')
  })
})

describe('formatPosition / formatDelta', () => {
  it('formats positions', () => {
    expect(formatPosition(4)).toBe('P4')
    expect(formatPosition(null)).toBe('—')
    expect(formatPosition(0)).toBe('—')
  })

  it('formats deltas', () => {
    expect(formatDelta(3)).toBe('+3')
    expect(formatDelta(-2)).toBe('−2')
    expect(formatDelta(0)).toBe('=')
    expect(formatDelta(null)).toBe('—')
  })
})
