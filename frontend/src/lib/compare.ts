// Driver comparison mapping — pure functions for telemetry traces and lap deltas.

import type { TelemetryTraceSeries } from '../components/charts/TelemetryTraceChart'
import type { DeltaSeries } from '../lib/delta'
import type {
  CarDataSample,
  ComparisonLap,
  Driver,
  EnrichedResult,
  LapsComparisonResponse,
} from '../types'
import { compareFinishPosition, teamColor } from '../utils'

function sortDriversByResults(drivers: Driver[], results: EnrichedResult[]): Driver[] {
  const order = new Map(
    [...results]
      .filter((r) => r.position > 0)
      .sort((a, b) => compareFinishPosition(a.position, b.position))
      .map((r, i) => [r.driver_number, i]),
  )
  return [...drivers].sort((a, b) => {
    const ao = order.get(a.driver_number) ?? 999
    const bo = order.get(b.driver_number) ?? 999
    if (ao !== bo) return ao - bo
    return a.driver_number - b.driver_number
  })
}

/** Default compare pair: top two classified finishers, else first two session drivers. */
export function defaultCompareDriverNumbers(
  results: EnrichedResult[],
  drivers: Driver[],
): [number, number] | null {
  const classified = [...results]
    .filter((r) => r.position > 0)
    .sort((a, b) => compareFinishPosition(a.position, b.position))

  if (classified.length >= 2) {
    return [classified[0].driver_number, classified[1].driver_number]
  }

  if (drivers.length >= 2) {
    const sorted = sortDriversByResults(drivers, results)
    return [sorted[0].driver_number, sorted[1].driver_number]
  }

  if (classified.length === 1 && drivers.length >= 1) {
    const other = drivers.find((d) => d.driver_number !== classified[0].driver_number)
    if (other) return [classified[0].driver_number, other.driver_number]
  }

  return null
}

/** Lap records → per-lap duration array (index 0 = lap 1); null for pit/out laps. */
export function lapsToLapTimes(laps: ComparisonLap[]): (number | null)[] {
  if (laps.length === 0) return []

  const maxLap = laps.reduce((max, lap) => Math.max(max, lap.lap_number), 0)
  const times: (number | null)[] = Array.from({ length: maxLap }, () => null)

  for (const lap of laps) {
    const idx = lap.lap_number - 1
    if (idx < 0) continue
    if (lap.is_pit_out_lap || lap.lap_duration == null || lap.lap_duration <= 0) {
      times[idx] = null
    } else {
      times[idx] = lap.lap_duration
    }
  }

  return times
}

export function findBestLap(laps: ComparisonLap[]): ComparisonLap | null {
  let best: ComparisonLap | null = null
  for (const lap of laps) {
    if (lap.lap_duration == null || lap.lap_duration <= 0) continue
    if (!best || (best.lap_duration ?? Infinity) > lap.lap_duration) {
      best = lap
    }
  }
  return best
}

/** Keep car-data samples whose timestamps fall within a lap window. */
export function filterCarDataToLap(
  samples: CarDataSample[],
  lap: ComparisonLap,
): CarDataSample[] {
  if (!lap.date_start || samples.length === 0) return samples

  const start = new Date(lap.date_start).getTime()
  if (!Number.isFinite(start)) return samples

  const end = start + (lap.lap_duration ?? 0) * 1000 + 500

  return samples.filter((s) => {
    const t = new Date(s.date).getTime()
    return Number.isFinite(t) && t >= start && t <= end
  })
}

export function carDataToTraceSeries(
  samples: CarDataSample[],
  label: string,
  color: string,
): TelemetryTraceSeries {
  return {
    label,
    color,
    samples: samples.map((s) => ({
      speed: s.speed,
      throttle: s.throttle,
      brake: s.brake,
    })),
  }
}

export function buildBestLapTraceSeries(
  carData: CarDataSample[],
  laps: ComparisonLap[],
  label: string,
  color: string,
): TelemetryTraceSeries | null {
  const best = findBestLap(laps)
  if (!best) return null

  const filtered = filterCarDataToLap(carData, best)
  if (filtered.length === 0) return null

  return carDataToTraceSeries(filtered, label, color)
}

function driverMeta(
  driverNumber: number,
  comparison: LapsComparisonResponse | undefined,
  drivers: Driver[],
): { label: string; color: string; laps: ComparisonLap[] } {
  const comp = comparison?.drivers.find((d) => d.driver_number === driverNumber)
  const session = drivers.find((d) => d.driver_number === driverNumber)
  return {
    label: comp?.name_acronym || session?.name_acronym || `#${driverNumber}`,
    color: teamColor(comp?.team_colour || session?.team_colour),
    laps: comp?.laps ?? [],
  }
}

export function comparisonToDeltaSeries(
  comparison: LapsComparisonResponse,
  driverNumbers: [number, number],
  drivers: Driver[],
): DeltaSeries[] {
  return driverNumbers.map((dn) => {
    const meta = driverMeta(dn, comparison, drivers)
    return {
      label: meta.label,
      color: meta.color,
      lapTimes: lapsToLapTimes(meta.laps),
    }
  })
}

export function formatPitLapsCaption(
  pitLaps: Record<string, number[]>,
  driverNumbers: [number, number],
  comparison: LapsComparisonResponse | undefined,
  drivers: Driver[],
): string | null {
  const parts: string[] = []

  for (const dn of driverNumbers) {
    const laps = pitLaps[String(dn)]
    if (!laps?.length) continue
    const meta = driverMeta(dn, comparison, drivers)
    parts.push(`${meta.label}: L${laps.join(', L')}`)
  }

  return parts.length > 0 ? `Pit stops — ${parts.join(' · ')}` : null
}

export function compareDriverOptions(
  drivers: Driver[],
  results: EnrichedResult[],
): Driver[] {
  if (drivers.length > 0) {
    return sortDriversByResults(drivers, results)
  }
  return results.map((r) => ({
    driver_number: r.driver_number,
    name_acronym: r.name_acronym,
    full_name: r.full_name,
    first_name: '',
    last_name: '',
    team_name: r.team_name,
    team_colour: r.team_colour,
    headshot_url: '',
    broadcast_name: r.full_name,
    session_key: r.session_key,
    meeting_key: r.meeting_key,
  }))
}
