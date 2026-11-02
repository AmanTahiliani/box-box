import { describe, expect, it } from 'vitest'
import { decidedChampion, maxPointsLeft } from '../lib/titleMath'
import type { ChampHubDriver } from '../types'

const d = (driver_number: number, points: number) => ({ driver_number, points }) as ChampHubDriver

describe('maxPointsLeft', () => {
  it('prefers the server ceiling', () => {
    expect(maxPointsLeft({ rounds_left: 4, sprints_left: 1, max_points_left: 100 })).toBe(100)
  })
  it('falls back to races plus sprints for older responses', () => {
    expect(maxPointsLeft({ rounds_left: 4 })).toBe(100)
    expect(maxPointsLeft({ rounds_left: 4, sprints_left: 2 })).toBe(116)
  })
})

describe('decidedChampion', () => {
  it('clinches when P2 cannot catch the leader', () => {
    // 2026 after Mexico City: ANT 380, VER 261, 4 rounds / no sprints left.
    expect(decidedChampion([d(12, 380), d(1, 261)], 100)?.driver_number).toBe(12)
  })
  it('stays open when the gap is reachable or exactly equal', () => {
    expect(decidedChampion([d(12, 380), d(1, 261)], 150)).toBeNull()
    expect(decidedChampion([d(12, 361), d(1, 261)], 100)).toBeNull()
  })
  it('crowns the leader once nothing is left', () => {
    expect(decidedChampion([d(12, 400), d(1, 400)], 0)?.driver_number).toBe(12)
  })
})
