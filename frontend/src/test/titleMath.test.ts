import { describe, expect, it } from 'vitest'
import { decidedChampion, maxPointsLeft } from '../lib/titleMath'
import type { ChampHubDriver } from '../types'

const d = (driver_number: number, points: number, round_positions: number[] = []) =>
  ({ driver_number, points, round_positions }) as ChampHubDriver

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
  it('stays open when the gap is reachable', () => {
    expect(decidedChampion([d(12, 380), d(1, 261)], 150)).toBeNull()
    // P2 is out of reach but P3 is not.
    expect(decidedChampion([d(12, 380), d(1, 261), d(44, 300)], 100)).toBeNull()
  })
  it('clinches on an exact gap when the leader wins the worst-case countback', () => {
    // 25-pt lead, one race left. Even if the rival wins it (3 wins) the leader has 5.
    expect(decidedChampion([d(12, 125, [1, 1, 1, 1, 1]), d(1, 100, [1, 1, 2, 2, 2])], 25, 1)?.driver_number).toBe(12)
  })
  it('stays open on an exact gap when the rival could win the countback', () => {
    // Rival would reach 3 wins vs the leader's 2.
    expect(decidedChampion([d(12, 125, [1, 1, 2, 2, 2]), d(1, 100, [1, 1, 3, 3, 3])], 25, 1)).toBeNull()
    // Level on wins and every other place: still open.
    expect(decidedChampion([d(12, 125, [1, 1, 2]), d(1, 100, [1, 2])], 25, 1)).toBeNull()
  })
  it('crowns the leader once nothing is left', () => {
    expect(decidedChampion([d(12, 400), d(1, 400)], 0)?.driver_number).toBe(12)
  })
})
