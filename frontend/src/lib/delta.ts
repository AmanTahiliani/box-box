// Cumulative lap-time delta math for driver comparison charts.
// Pure functions only — no React — so everything is unit-testable.

export interface DeltaSeries {
  label: string
  color: string
  /** Lap duration in seconds; null = no time (pit/out lap). */
  lapTimes: (number | null)[]
}

export interface DriverDeltaResult {
  label: string
  color: string
  /** Cumulative delta vs reference (seconds); null when that lap has no time. */
  deltas: (number | null)[]
}

/** Format a delta value for axis labels and tooltips (e.g. "+2.5s", "-1.2s"). */
export function formatDeltaSeconds(delta: number): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}s`
}

function buildCumulative(lapTimes: ReadonlyArray<number | null>): number[] {
  const cumulative: number[] = []
  let running = 0
  for (const lap of lapTimes) {
    if (lap !== null) {
      running += lap
    }
    cumulative.push(running)
  }
  return cumulative
}

function resolveReference(
  series: ReadonlyArray<DeltaSeries>,
  referenceLabel?: string,
): DeltaSeries | null {
  if (series.length === 0) return null
  if (referenceLabel) {
    return series.find((s) => s.label === referenceLabel) ?? series[0]
  }
  return series[0]
}

/**
 * Compute per-lap cumulative time delta for each non-reference driver.
 * Positive = behind reference; negative = ahead.
 * Null laps carry cumulative forward but emit null in deltas (skip when plotting).
 */
export function computeCumulativeDeltas(
  series: ReadonlyArray<DeltaSeries>,
  referenceLabel?: string,
): DriverDeltaResult[] {
  const reference = resolveReference(series, referenceLabel)
  if (!reference) return []

  const refCumulative = buildCumulative(reference.lapTimes)

  return series
    .filter((s) => s.label !== reference.label)
    .map((driver) => {
      const driverCumulative = buildCumulative(driver.lapTimes)
      const lapCount = Math.max(driver.lapTimes.length, refCumulative.length)
      const deltas: (number | null)[] = []

      for (let i = 0; i < lapCount; i++) {
        if (driver.lapTimes[i] === null) {
          deltas.push(null)
          continue
        }
        const refValue = refCumulative[i] ?? refCumulative[refCumulative.length - 1] ?? 0
        const driverValue =
          driverCumulative[i] ?? driverCumulative[driverCumulative.length - 1] ?? 0
        deltas.push(driverValue - refValue)
      }

      return {
        label: driver.label,
        color: driver.color,
        deltas,
      }
    })
}

/** Split delta samples into contiguous SVG polyline point strings (gaps at null laps). */
export function deltaPolylineSegments(
  deltas: ReadonlyArray<number | null>,
  toPoint: (lapIndex: number, delta: number) => string,
): string[] {
  const segments: string[] = []
  let current: string[] = []

  for (let i = 0; i < deltas.length; i++) {
    const value = deltas[i]
    if (value === null) {
      if (current.length > 0) {
        segments.push(current.join(' '))
        current = []
      }
      continue
    }
    current.push(toPoint(i, value))
  }

  if (current.length > 0) {
    segments.push(current.join(' '))
  }

  return segments
}
