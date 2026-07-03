import { describe, it, expect } from 'vitest'
import {
  countRaceHubDatasets,
  formatCoverageHint,
  countWeekendStats,
  sessionTypeAbbrev,
  isSessionComplete,
} from '../lib/coverage'
import type { DatasetInfo, Weekend } from '../types'

const fullDatasets: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'available', source: 'local', count: 20 },
  results: { status: 'available', source: 'local', count: 20 },
  starting_grid: { status: 'available', source: 'local', count: 20 },
  stints: { status: 'available', source: 'local', count: 2 },
  pit_stops: { status: 'available', source: 'local', count: 1 },
  positions: { status: 'available', source: 'local', count: 3 },
  race_control: { status: 'available', source: 'local', count: 1 },
  weather: { status: 'available', source: 'local', count: 1 },
  laps: { status: 'available', source: 'local', count: 1 },
}

describe('coverage helpers', () => {
  it('counts available Race Hub datasets', () => {
    expect(countRaceHubDatasets(fullDatasets)).toEqual({ available: 11, total: 11 })
    expect(countRaceHubDatasets({ meeting: { status: 'available', source: 'local' } })).toEqual({
      available: 1,
      total: 11,
    })
  })

  it('formats coverage hint', () => {
    expect(formatCoverageHint(fullDatasets)).toBe('11/11')
  })

  it('detects complete sessions', () => {
    expect(isSessionComplete(fullDatasets)).toBe(true)
    expect(isSessionComplete({ meeting: { status: 'available', source: 'local' } })).toBe(false)
  })

  it('abbreviates session types', () => {
    expect(sessionTypeAbbrev('Race', 'Race')).toBe('R')
    expect(sessionTypeAbbrev('Qualifying', 'Qualifying')).toBe('Q')
    expect(sessionTypeAbbrev('Practice', 'Practice 1')).toBe('FP1')
  })

  it('counts weekend stats', () => {
    const local: Weekend = {
      source: 'local',
      meeting_key: 1,
      meeting: {} as Weekend['meeting'],
      sessions: [{ session: {} as Weekend['sessions'][0]['session'], source: 'local', datasets: fullDatasets }],
    }
    const partial: Weekend = {
      source: 'partial',
      meeting_key: 2,
      meeting: {} as Weekend['meeting'],
      sessions: [{ session: {} as Weekend['sessions'][0]['session'], source: 'partial', datasets: {} }],
    }
    const cancelled: Weekend = {
      source: 'cancelled',
      meeting_key: 3,
      meeting: {} as Weekend['meeting'],
      sessions: [{ session: {} as Weekend['sessions'][0]['session'], source: 'cancelled', datasets: {} }],
    }
    expect(countWeekendStats([local, partial, cancelled, undefined])).toEqual({
      full: 1,
      partial: 1,
      cancelled: 1,
      missing: 1,
      total: 4,
    })
  })
})
