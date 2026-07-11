import type { ChampHubDriver } from '../types'

export interface TeammatePair {
  teamName: string
  teamColour: string
  driverA: ChampHubDriver
  driverB: ChampHubDriver
  /** Drivers on the team beyond the top two (shown as +N). */
  extraCount: number
  /** Absolute win gap — smaller means a closer battle. */
  closeness: number
}

/** Pair teammates per team for H2H display; skip single-driver teams. */
export function teammatePairs(drivers: ReadonlyArray<ChampHubDriver>): TeammatePair[] {
  const byTeam = new Map<string, ChampHubDriver[]>()
  for (const d of drivers) {
    const list = byTeam.get(d.team_name) ?? []
    list.push(d)
    byTeam.set(d.team_name, list)
  }

  const pairs: TeammatePair[] = []
  for (const [teamName, members] of byTeam) {
    if (members.length < 2) continue

    const sorted = [...members].sort((a, b) => b.points - a.points)
    const driverA = sorted[0]
    const driverB = sorted[1]
    const winsA = driverA.teammate_wins
    const winsB = driverB.teammate_wins

    pairs.push({
      teamName,
      teamColour: driverA.team_colour,
      driverA,
      driverB,
      extraCount: members.length - 2,
      closeness: Math.abs(winsA - winsB),
    })
  }

  return pairs.sort((a, b) => {
    if (a.closeness !== b.closeness) return a.closeness - b.closeness
    return a.teamName.localeCompare(b.teamName)
  })
}
