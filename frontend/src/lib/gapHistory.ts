// Client-side gap/interval history tracking for the live timing tower.
// Pure functions only — no React, no side effects — so everything is unit-testable.

export const MAX_GAP_SAMPLES = 40

/** Per-driver ring buffer of interval samples (seconds), keyed by racing number. */
export type GapHistoryMap = Record<string, number[]>

export type GapTrend = 'closing' | 'opening' | 'steady'

/**
 * Parse an F1 live-timing interval/gap string into seconds.
 * Handles "+1.234", "1.234", "+1:05.678" (minute form) and rejects
 * lapped/leader markers: "", "LAP 12", "1L", "+1 LAP", "2 LAPS", etc.
 */
export function parseIntervalSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text) return null
  // Lapped / leader markers are never numeric gaps.
  if (/lap/i.test(text) || /^\+?\d+\s*L$/i.test(text)) return null

  const match = text.match(/^([+-])?(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const sign = match[1] === '-' ? -1 : 1
  const minutes = match[2] ? Number(match[2]) : 0
  const seconds = Number(match[3])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null

  return sign * (minutes * 60 + seconds)
}

export interface GapSampleInput {
  racingNumber: string
  interval: string
}

/**
 * Record one snapshot's worth of interval samples.
 * Returns a new map (input is not mutated). Drivers missing from `rows`
 * are pruned; unparsable intervals keep the existing buffer untouched.
 */
export function recordGapSamples(
  history: GapHistoryMap,
  rows: ReadonlyArray<GapSampleInput>,
  maxSamples = MAX_GAP_SAMPLES,
): GapHistoryMap {
  const next: GapHistoryMap = {}
  for (const row of rows) {
    if (!row.racingNumber) continue
    const existing = history[row.racingNumber] ?? []
    const value = parseIntervalSeconds(row.interval)
    if (value === null) {
      if (existing.length > 0) next[row.racingNumber] = existing
      continue
    }
    const samples = [...existing, value]
    next[row.racingNumber] = samples.length > maxSamples ? samples.slice(samples.length - maxSamples) : samples
  }
  return next
}

/**
 * Classify the recent trend of a gap buffer: is the driver closing on the
 * car ahead, dropping back, or holding steady? Compares the mean of the
 * older half vs the newer half of the most recent samples.
 */
export function gapTrend(samples: ReadonlyArray<number>, window = 10, threshold = 0.1): GapTrend | null {
  if (!samples || samples.length < 3) return null
  const recent = samples.slice(-window)
  const mid = Math.floor(recent.length / 2)
  const older = recent.slice(0, mid)
  const newer = recent.slice(mid)
  if (older.length === 0 || newer.length === 0) return null

  const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / xs.length
  const delta = mean(newer) - mean(older)
  if (delta <= -threshold) return 'closing'
  if (delta >= threshold) return 'opening'
  return 'steady'
}

/**
 * Compute SVG polyline points for a sparkline of the samples, fitted to
 * width x height with a small vertical inset. Flat data draws a mid line.
 */
export function sparklinePoints(
  samples: ReadonlyArray<number>,
  width: number,
  height: number,
  inset = 1.5,
): string {
  if (!samples || samples.length < 2) return ''
  const min = Math.min(...samples)
  const max = Math.max(...samples)
  const span = max - min
  const usable = height - inset * 2
  const step = width / (samples.length - 1)

  return samples
    .map((value, index) => {
      const x = index * step
      const y = span === 0 ? height / 2 : inset + (1 - (value - min) / span) * usable
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
