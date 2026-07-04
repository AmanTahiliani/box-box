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

/**
 * Cumulative lap time aligned to reference-valid laps only.
 * Laps where the reference is null are skipped for every series so later deltas
 * do not compare against a frozen baseline while challengers keep accumulating.
 */
function buildAlignedCumulative(
  lapTimes: ReadonlyArray<number | null>,
  referenceLapTimes: ReadonlyArray<number | null>,
): number[] {
  const cumulative: number[] = []
  let running = 0
  const length = Math.max(lapTimes.length, referenceLapTimes.length)

  for (let i = 0; i < length; i++) {
    if (referenceLapTimes[i] === null) {
      cumulative.push(running)
      continue
    }
    const lap = lapTimes[i]
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
 * Deltas are only emitted where the reference lap is valid; reference-null laps
 * gap every series. Challenger-null laps gap only that driver's line.
 */
export function computeCumulativeDeltas(
  series: ReadonlyArray<DeltaSeries>,
  referenceLabel?: string,
): DriverDeltaResult[] {
  const reference = resolveReference(series, referenceLabel)
  if (!reference) return []

  const refLapTimes = reference.lapTimes
  const refCumulative = buildAlignedCumulative(refLapTimes, refLapTimes)

  return series
    .filter((s) => s.label !== reference.label)
    .map((driver) => {
      const driverCumulative = buildAlignedCumulative(driver.lapTimes, refLapTimes)
      const lapCount = Math.max(driver.lapTimes.length, refCumulative.length)
      const deltas: (number | null)[] = []

      for (let i = 0; i < lapCount; i++) {
        if (refLapTimes[i] === null || driver.lapTimes[i] === null) {
          deltas.push(null)
          continue
        }
        deltas.push(driverCumulative[i] - refCumulative[i])
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
