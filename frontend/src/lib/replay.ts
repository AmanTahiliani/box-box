import type { ReplayCarPosition, ReplayFrame, TrackBounds } from '../types'
import { canvasToSvg, normalizeRawPoint } from './trackmap'

export interface ReplayFramePair {
  previous: ReplayFrame | null
  next: ReplayFrame | null
}

export function lookupReplayFramePair(
  frames: ReadonlyArray<ReplayFrame>,
  tMs: number,
): ReplayFramePair {
  if (frames.length === 0) return { previous: null, next: null }
  if (tMs <= frames[0].t) return { previous: frames[0], next: frames[0] }
  const last = frames[frames.length - 1]
  if (tMs >= last.t) return { previous: last, next: last }

  let lo = 0
  let hi = frames.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const frame = frames[mid]
    if (frame.t === tMs) return { previous: frame, next: frame }
    if (frame.t < tMs) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return { previous: frames[Math.max(0, hi)], next: frames[Math.min(frames.length - 1, lo)] }
}

export function interpolateReplayCars(
  frames: ReadonlyArray<ReplayFrame>,
  tMs: number,
): Record<string, ReplayCarPosition> {
  const { previous, next } = lookupReplayFramePair(frames, tMs)
  if (!previous && !next) return {}
  if (!previous) return next?.cars ?? {}
  if (!next || previous.t === next.t) return previous.cars

  const span = next.t - previous.t
  const fraction = span <= 0 ? 0 : clamp01((tMs - previous.t) / span)
  const cars: Record<string, ReplayCarPosition> = {}
  const numbers = new Set([...Object.keys(previous.cars), ...Object.keys(next.cars)])

  for (const number of numbers) {
    const before = previous.cars[number]
    const after = next.cars[number]
    if (before && after) {
      cars[number] = {
        x: before.x + (after.x - before.x) * fraction,
        y: before.y + (after.y - before.y) * fraction,
      }
    } else if (before) {
      cars[number] = before
    } else if (after) {
      cars[number] = after
    }
  }
  return cars
}

export function replayCarToSvg(
  car: ReplayCarPosition,
  bounds: TrackBounds,
): ReplayCarPosition {
  return canvasToSvg(normalizeRawPoint({ x: car.x, y: car.y }, bounds))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
