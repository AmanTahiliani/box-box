// Battle detection for the live timing tower.
// Pure functions only — no React, no side effects — so everything is unit-testable.

import type { LiveTimingRow } from './live'
import { driverCode } from './live'
import { parseIntervalSeconds } from './gapHistory'

export const BATTLE_THRESHOLD_SECONDS = 1.0

export interface BattleDriver {
  racingNumber: string
  code: string
  position: number
  /** Interval to the car ahead within the group; null for the group leader. */
  gapToAhead: number | null
}

export interface Battle {
  drivers: BattleDriver[]
  /** Tightest car-to-car interval within the group. */
  minGap: number
}

/** Battles are only meaningful in race-type sessions (GP race, sprint). */
export function isRaceSession(sessionType: string | null | undefined): boolean {
  if (!sessionType) return false
  const type = sessionType.toLowerCase()
  const isQualifying = type.includes('qualifying') || type.includes('shootout') || /\bsq\s*[123]\b/.test(type)
  return !isQualifying && (type.includes('race') || /\bsprint\b/.test(type))
}

function isEligible(row: LiveTimingRow): boolean {
  const driver = row.Driver
  return Boolean(driver) && !driver.InPit && !driver.Retired && row.Position > 0
}

/**
 * Scan position-sorted tower rows and group consecutive cars racing within
 * `threshold` seconds of the car ahead. Cars in the pits or retired break
 * the chain, as do lapped/unparsable intervals.
 */
export function detectBattles(
  rows: ReadonlyArray<LiveTimingRow>,
  sessionType: string | null | undefined,
  threshold = BATTLE_THRESHOLD_SECONDS,
): Battle[] {
  if (!isRaceSession(sessionType) || rows.length < 2) return []

  const battles: Battle[] = []
  let current: BattleDriver[] | null = null
  let minGap = Number.POSITIVE_INFINITY

  const flush = () => {
    if (current && current.length >= 2) {
      battles.push({ drivers: current, minGap })
    }
    current = null
    minGap = Number.POSITIVE_INFINITY
  }

  for (let i = 1; i < rows.length; i++) {
    const ahead = rows[i - 1]
    const row = rows[i]
    const gap = parseIntervalSeconds(row.Driver?.Interval)

    const inBattle =
      gap !== null && gap >= 0 && gap <= threshold && isEligible(ahead) && isEligible(row)

    if (!inBattle) {
      flush()
      continue
    }

    if (!current) {
      current = [toBattleDriver(ahead, null)]
    }
    current.push(toBattleDriver(row, gap))
    if (gap < minGap) minGap = gap
  }
  flush()

  return battles
}

function toBattleDriver(row: LiveTimingRow, gapToAhead: number | null): BattleDriver {
  return {
    racingNumber: row.RacingNumber,
    code: driverCode(row),
    position: row.Position,
    gapToAhead,
  }
}

/** Chip label, e.g. "VER ⚔ NOR +0.4" or "VER ⚔ NOR ⚔ PIA +0.3". */
export function battleLabel(battle: Battle): string {
  const codes = battle.drivers.map((driver) => driver.code).join(' ⚔ ')
  const gap = Number.isFinite(battle.minGap) ? ` +${battle.minGap.toFixed(1)}` : ''
  return `${codes}${gap}`
}

/** Racing numbers involved in any battle, for tower row highlighting. */
export function battleNumbers(battles: ReadonlyArray<Battle>): Set<string> {
  const numbers = new Set<string>()
  for (const battle of battles) {
    for (const driver of battle.drivers) numbers.add(driver.racingNumber)
  }
  return numbers
}
