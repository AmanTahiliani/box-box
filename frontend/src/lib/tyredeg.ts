// Tyre degradation + pit-window estimation for the live timing page.
// Pure functions only — no React, no side effects — so everything is unit-testable.
//
// Lap-time samples are accumulated client-side from successive SSE snapshots
// (mirroring the gapHistory/battles precedent); nothing here talks to the server.

import type { LiveTimingRow } from './live'
import { driverCode } from './live'
import { parseIntervalSeconds } from './gapHistory'

/**
 * Rough typical pit-lane time loss (entry + stop + exit vs a flying lap), in
 * seconds. Per-track values are deliberately out of scope for v1.
 */
export const PIT_LOSS_SECONDS = 22

/** Minimum clean laps in the current stint before a slope is trustworthy. */
export const MIN_CLEAN_LAPS = 4

/**
 * Laps more than this many seconds off the stint median are treated as
 * outliers (traffic, spins, safety car) and excluded from the fit.
 */
export const OUTLIER_DELTA_SECONDS = 5

/**
 * Slope classification thresholds (seconds per lap):
 *   slope <= -DEG_SLOPE_THRESHOLD  -> 'improving' (track evolution, fuel burn dominating)
 *   slope >= +DEG_SLOPE_THRESHOLD  -> 'degrading' (tyre wear dominating)
 *   otherwise                      -> 'stable'
 */
export const DEG_SLOPE_THRESHOLD = 0.05

/** Safety cap so a very long stint cannot grow the buffer unbounded. */
export const MAX_STINT_SAMPLES = 80

export type DegTrend = 'improving' | 'stable' | 'degrading'

export interface StintSample {
  lap: number
  seconds: number
}

export interface DriverStintHistory {
  compound: string
  tyreAge: number
  lastLapNumber: number
  lastLapTime: string
  /** The next completed lap is an out-lap (fresh stint) and must be discarded. */
  skipNextLap: boolean
  samples: StintSample[]
}

/** Per-driver current-stint lap history, keyed by racing number. */
export type StintHistoryMap = Record<string, DriverStintHistory>

export interface StintLapInput {
  racingNumber: string
  lapNumber: number
  lastLapTime: string
  compound: string
  tyreAge: number
  inPit: boolean
  pitOut: boolean
}

/**
 * Parse an F1 live-timing lap time string ("1:23.456", "83.456") into seconds.
 * Same conventions as parseIntervalSeconds, but a lap time is never signed and
 * never a lapped/leader marker; zero or negative values are rejected.
 */
export function parseLapTimeSeconds(raw: string | null | undefined): number | null {
  const value = parseIntervalSeconds(raw)
  if (value === null || value <= 0) return null
  return value
}

export function stintInputFromRow(row: LiveTimingRow): StintLapInput {
  return {
    racingNumber: row.RacingNumber,
    lapNumber: row.Driver.NumberOfLaps || 0,
    lastLapTime: row.Driver.LastLapTime || '',
    compound: row.Tyre?.Compound || '',
    tyreAge: row.Tyre?.Age ?? 0,
    inPit: Boolean(row.Driver.InPit),
    pitOut: Boolean(row.Driver.PitOut),
  }
}

/**
 * Record one snapshot's worth of lap samples for each driver's current stint.
 * Returns a new map (input is not mutated); drivers missing from `inputs` are
 * pruned.
 *
 * A lap counts as completed when LastLapTime changes to a new non-empty value
 * (NumberOfLaps can tick before the lap time arrives, so the time string is
 * the trigger; a sample for the same lap number is replaced, not duplicated).
 * The stint buffer resets when the compound changes or the tyre age drops
 * (new set fitted), and laps completed in the pit lane (in-lap), on pit exit
 * (out-lap), or immediately after a reset are excluded.
 */
export function recordStintSamples(
  history: StintHistoryMap,
  inputs: ReadonlyArray<StintLapInput>,
): StintHistoryMap {
  const next: StintHistoryMap = {}

  for (const input of inputs) {
    if (!input.racingNumber) continue

    const prior = history[input.racingNumber]
    if (!prior) {
      next[input.racingNumber] = {
        compound: input.compound,
        tyreAge: input.tyreAge,
        lastLapNumber: input.lapNumber,
        lastLapTime: input.lastLapTime,
        skipNextLap: false,
        samples: [],
      }
      continue
    }

    let samples = prior.samples
    let skipNextLap = prior.skipNextLap

    const compoundChanged = Boolean(input.compound) && Boolean(prior.compound) && input.compound !== prior.compound
    const freshSet = input.tyreAge < prior.tyreAge
    if (compoundChanged || freshSet || input.inPit) {
      // Stint over (or a new one starting): drop the old laps and flag the
      // upcoming out-lap for exclusion.
      samples = []
      skipNextLap = true
    }

    const lapCompleted = Boolean(input.lastLapTime) && input.lastLapTime !== prior.lastLapTime
    if (lapCompleted) {
      const seconds = parseLapTimeSeconds(input.lastLapTime)
      const dirty = input.inPit || input.pitOut || skipNextLap
      if (seconds !== null && !dirty) {
        const last = samples[samples.length - 1]
        if (last && last.lap === input.lapNumber) {
          samples = [...samples.slice(0, -1), { lap: input.lapNumber, seconds }]
        } else {
          samples = [...samples, { lap: input.lapNumber, seconds }]
          if (samples.length > MAX_STINT_SAMPLES) {
            samples = samples.slice(samples.length - MAX_STINT_SAMPLES)
          }
        }
      }
      if (!input.inPit) skipNextLap = false
    }

    next[input.racingNumber] = {
      compound: input.compound || prior.compound,
      tyreAge: input.tyreAge,
      lastLapNumber: input.lapNumber,
      lastLapTime: input.lastLapTime || prior.lastLapTime,
      skipNextLap,
      samples,
    }
  }

  return next
}

export interface DegModel {
  /** Least-squares slope of lap time vs lap number, in seconds per lap. */
  slope: number
  trend: DegTrend
  /** Clean (outlier-filtered) samples the fit ran over, in lap order. */
  samples: StintSample[]
}

/** Drop laps more than OUTLIER_DELTA_SECONDS off the stint median. */
export function cleanStintSamples(
  samples: ReadonlyArray<StintSample>,
  maxDelta = OUTLIER_DELTA_SECONDS,
): StintSample[] {
  if (samples.length === 0) return []
  const sorted = samples.map((sample) => sample.seconds).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return samples.filter((sample) => Math.abs(sample.seconds - median) <= maxDelta)
}

/**
 * Fit a linear degradation model over the stint's clean laps.
 * Returns null with fewer than MIN_CLEAN_LAPS clean samples — the caller
 * should show a "warming up" placeholder rather than a junk slope.
 */
export function degradationModel(samples: ReadonlyArray<StintSample>): DegModel | null {
  const clean = cleanStintSamples(samples)
  if (clean.length < MIN_CLEAN_LAPS) return null

  const n = clean.length
  const meanLap = clean.reduce((sum, s) => sum + s.lap, 0) / n
  const meanSec = clean.reduce((sum, s) => sum + s.seconds, 0) / n

  let numerator = 0
  let denominator = 0
  for (const sample of clean) {
    numerator += (sample.lap - meanLap) * (sample.seconds - meanSec)
    denominator += (sample.lap - meanLap) ** 2
  }
  if (denominator === 0) return null

  const slope = numerator / denominator
  const trend: DegTrend =
    slope <= -DEG_SLOPE_THRESHOLD ? 'improving' : slope >= DEG_SLOPE_THRESHOLD ? 'degrading' : 'stable'

  return { slope, trend, samples: clean }
}

/** "+0.08s/lap" / "-0.12s/lap" display form. */
export function formatSlope(slope: number): string {
  const sign = slope >= 0 ? '+' : '−'
  return `${sign}${Math.abs(slope).toFixed(2)}s/lap`
}

export interface PitRejoinEstimate {
  rejoinPosition: number
  /** Cars behind that would get past during the stop. */
  positionsLost: number
  /** Driver code directly ahead after rejoining, if any. */
  aheadCode: string | null
  /** Driver code directly behind after rejoining, if any. */
  behindCode: string | null
}

/**
 * Estimate where a driver rejoins after a pit stop costing `pitLoss` seconds.
 *
 * Walks the cars behind the driver, accumulating their Interval (gap to car
 * ahead) values: every car whose cumulative gap to the driver is under the
 * pit loss gets past. An unparsable interval (lapped marker like "1L") ends
 * the walk — those cars are at least a lap down and stay behind. Cars in the
 * pits or retired are excluded from the ladder.
 */
export function estimatePitRejoin(
  rows: ReadonlyArray<LiveTimingRow>,
  racingNumber: string,
  pitLoss = PIT_LOSS_SECONDS,
): PitRejoinEstimate | null {
  const ladder = rows
    .filter((row) => row.Position > 0 && !row.Driver.Retired && !row.Driver.InPit)
    .sort((a, b) => a.Position - b.Position)

  const index = ladder.findIndex((row) => row.RacingNumber === racingNumber)
  if (index === -1) return null

  let cumulative = 0
  let positionsLost = 0
  for (let i = index + 1; i < ladder.length; i++) {
    const gap = parseIntervalSeconds(ladder[i].Driver.Interval)
    if (gap === null) break
    cumulative += Math.max(0, gap)
    if (cumulative >= pitLoss) break
    positionsLost += 1
  }

  const ahead = positionsLost > 0 ? ladder[index + positionsLost] : ladder[index - 1]
  const behind = ladder[index + positionsLost + 1]

  return {
    rejoinPosition: ladder[index].Position + positionsLost,
    positionsLost,
    aheadCode: ahead ? driverCode(ahead) : null,
    behindCode: behind ? driverCode(behind) : null,
  }
}
