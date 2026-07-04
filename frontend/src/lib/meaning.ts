// Pure interpretation helpers for pairing numbers with their "so-what".
// Thresholds are exported consts so they are cheap to tune in one place.

import { PIT_LOSS_SECONDS } from './tyredeg'

/** Gaps under this (seconds) are DRS attack range. */
export const INTERVAL_DRS_MAX_SECONDS = 1.0

/** Lower bound of the undercut window (seconds); contiguous with DRS range. */
export const INTERVAL_UNDERCUT_MIN_SECONDS = INTERVAL_DRS_MAX_SECONDS

/**
 * Upper bound of the undercut window (seconds). Kept well below typical pit
 * loss ({@link PIT_LOSS_SECONDS}s) — only a few seconds matter for strategy.
 */
export const INTERVAL_UNDERCUT_MAX_SECONDS = Math.min(3.0, PIT_LOSS_SECONDS / 7)

/**
 * Rough per-compound cliff lap estimates (dry compounds). Wet/intermediate
 * values are conservative — deg varies wildly with conditions.
 */
export const TYRE_CLIFF_LAPS: Readonly<Record<string, number>> = {
  SOFT: 18,
  MEDIUM: 28,
  HARD: 38,
  INTERMEDIATE: 20,
  WET: 15,
}

/** Default cliff when compound is unknown. */
export const TYRE_CLIFF_DEFAULT_LAPS = 25

/** Championship max points per race (winner). */
export const MAX_POINTS_PER_ROUND = 25

export interface MeaningAnnotation {
  caption: string
  title: string
  tone?: 'good' | 'bad' | 'neutral' | 'warn'
}

function cliffLaps(compound: string | null | undefined): number {
  if (!compound) return TYRE_CLIFF_DEFAULT_LAPS
  return TYRE_CLIFF_LAPS[compound.toUpperCase()] ?? TYRE_CLIFF_DEFAULT_LAPS
}

/**
 * Interval / gap-to-ahead meaning for the live timing tower.
 * Returns null for leader gaps, out-of-range values, or unparsable input.
 */
export function intervalMeaning(seconds: number | null | undefined): MeaningAnnotation | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null

  if (seconds < INTERVAL_DRS_MAX_SECONDS) {
    return {
      caption: 'DRS range',
      title: `Within ${INTERVAL_DRS_MAX_SECONDS}s — DRS enabled next straight`,
      tone: 'good',
    }
  }

  if (seconds >= INTERVAL_UNDERCUT_MIN_SECONDS && seconds <= INTERVAL_UNDERCUT_MAX_SECONDS) {
    return {
      caption: 'undercut window',
      title: `${INTERVAL_UNDERCUT_MIN_SECONDS}–${INTERVAL_UNDERCUT_MAX_SECONDS}s — pit now could gain a position (vs ~${PIT_LOSS_SECONDS}s stop)`,
      tone: 'warn',
    }
  }

  return null
}

/**
 * Tyre-age meaning for deg / stint panels.
 */
export function tyreAgeMeaning(
  compound: string | null | undefined,
  age: number | null | undefined,
): MeaningAnnotation | null {
  if (age == null || !Number.isFinite(age) || age < 0) return null

  const cliff = cliffLaps(compound)
  const freshEnd = Math.ceil(cliff * 0.25)
  const midEnd = Math.ceil(cliff * 0.65)

  if (age <= freshEnd) {
    return {
      caption: 'fresh',
      title: `${age} lap${age === 1 ? '' : 's'} on ${compound ?? 'tyre'} — early stint grip`,
      tone: 'good',
    }
  }

  if (age <= midEnd) {
    return {
      caption: 'mid-life',
      title: `${age} laps — tyre in its working window before cliff (~${cliff} laps)`,
      tone: 'neutral',
    }
  }

  const lapsToCliff = cliff - age
  if (lapsToCliff <= 0) {
    return {
      caption: 'past cliff',
      title: `${age} laps — beyond typical ${compound ?? 'tyre'} cliff (~${cliff} laps)`,
      tone: 'bad',
    }
  }

  return {
    caption: `~${lapsToCliff} laps to cliff`,
    title: `${age} of ~${cliff} laps before deg cliff on ${compound ?? 'tyre'}`,
    tone: 'warn',
  }
}

/**
 * Points gap to the driver directly ahead — catchable-or-not v1.
 */
export function pointsGapMeaning(
  gapToAhead: number | null | undefined,
  roundsLeft: number,
  driverAhead?: string | null,
): MeaningAnnotation | null {
  if (gapToAhead == null || !Number.isFinite(gapToAhead) || gapToAhead <= 0) return null
  if (!Number.isFinite(roundsLeft) || roundsLeft <= 0) return null

  const maxCatchable = roundsLeft * MAX_POINTS_PER_ROUND
  const ahead = driverAhead?.trim() || 'ahead'

  if (gapToAhead > maxCatchable) {
    return {
      caption: 'out of reach',
      title: `+${gapToAhead} pts with ${roundsLeft} round${roundsLeft === 1 ? '' : 's'} left (max ${maxCatchable} available)`,
      tone: 'bad',
    }
  }

  const perRound = Math.ceil(gapToAhead / roundsLeft)
  return {
    caption: `~${perRound} pts/round`,
    title: `Needs ~${perRound} pts per round on ${ahead} to catch (${gapToAhead} pts in ${roundsLeft} round${roundsLeft === 1 ? '' : 's'})`,
    tone: perRound <= 10 ? 'good' : 'warn',
  }
}
