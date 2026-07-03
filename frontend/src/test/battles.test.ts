import { describe, expect, it } from 'vitest'
import { battleLabel, battleNumbers, detectBattles, isRaceSession } from '../lib/battles'
import type { LiveTimingRow } from '../lib/live'
import type { LiveDriverData } from '../types'

function row(
  number: string,
  position: number,
  interval: string,
  tla: string,
  overrides: Partial<LiveDriverData> = {},
): LiveTimingRow {
  return {
    RacingNumber: number,
    Position: position,
    Driver: {
      RacingNumber: number,
      Position: position,
      Interval: interval,
      GapToLeader: interval,
      InPit: false,
      PitOut: false,
      Retired: false,
      ...overrides,
    } as LiveDriverData,
    Info: {
      RacingNumber: number,
      BroadcastName: '',
      Tla: tla,
      TeamName: '',
      TeamColour: '',
      FirstName: '',
      LastName: '',
    },
  }
}

describe('isRaceSession', () => {
  it('only treats race and sprint sessions as races', () => {
    expect(isRaceSession('Race')).toBe(true)
    expect(isRaceSession('Sprint')).toBe(true)
    expect(isRaceSession('Qualifying')).toBe(false)
    expect(isRaceSession('Practice')).toBe(false)
    expect(isRaceSession('')).toBe(false)
    expect(isRaceSession(undefined)).toBe(false)
  })
})

describe('detectBattles', () => {
  const rows = [
    row('1', 1, '', 'VER'),
    row('4', 2, '+0.4', 'NOR'),
    row('81', 3, '+0.8', 'PIA'),
    row('16', 4, '+5.0', 'LEC'),
    row('44', 5, '+0.9', 'HAM'),
    row('63', 6, '+12.2', 'RUS'),
  ]

  it('groups consecutive cars within 1.0s in race sessions', () => {
    const battles = detectBattles(rows, 'Race')
    expect(battles).toHaveLength(2)
    expect(battles[0].drivers.map((d) => d.code)).toEqual(['VER', 'NOR', 'PIA'])
    expect(battles[0].minGap).toBeCloseTo(0.4)
    expect(battles[1].drivers.map((d) => d.code)).toEqual(['LEC', 'HAM'])
    expect(battles[1].minGap).toBeCloseTo(0.9)
  })

  it('returns nothing outside race sessions', () => {
    expect(detectBattles(rows, 'Qualifying')).toEqual([])
    expect(detectBattles(rows, undefined)).toEqual([])
  })

  it('excludes cars in the pits or retired', () => {
    const pitted = [
      row('1', 1, '', 'VER'),
      row('4', 2, '+0.4', 'NOR', { InPit: true }),
      row('81', 3, '+0.6', 'PIA'),
      row('16', 4, '+8.0', 'LEC'),
      row('44', 5, '+0.5', 'HAM', { Retired: true }),
    ]
    const battles = detectBattles(pitted, 'Race')
    expect(battles).toEqual([])
  })

  it('ignores lapped and missing intervals', () => {
    const lapped = [
      row('1', 1, '', 'VER'),
      row('4', 2, '1L', 'NOR'),
      row('81', 3, '', 'PIA'),
    ]
    expect(detectBattles(lapped, 'Race')).toEqual([])
  })

  it('handles empty and single-row input', () => {
    expect(detectBattles([], 'Race')).toEqual([])
    expect(detectBattles([row('1', 1, '', 'VER')], 'Race')).toEqual([])
  })
})

describe('battleLabel / battleNumbers', () => {
  it('formats a two-car chip label', () => {
    const battles = detectBattles([row('1', 1, '', 'VER'), row('4', 2, '+0.4', 'NOR')], 'Race')
    expect(battleLabel(battles[0])).toBe('VER ⚔ NOR +0.4')
  })

  it('collects racing numbers across all battles', () => {
    const battles = detectBattles(
      [
        row('1', 1, '', 'VER'),
        row('4', 2, '+0.4', 'NOR'),
        row('16', 3, '+9.0', 'LEC'),
        row('44', 4, '+0.7', 'HAM'),
      ],
      'Race',
    )
    expect(battleNumbers(battles)).toEqual(new Set(['1', '4', '16', '44']))
  })
})
