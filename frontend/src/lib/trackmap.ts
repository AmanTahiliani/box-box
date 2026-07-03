import type { LivePosition, TrackBounds, TrackPoint } from '../types'

export interface CanvasPoint {
  x: number
  y: number
}

const VIEWBOX_SIZE = 100

export function normalizeRawPoint(
  point: Pick<LivePosition, 'x' | 'y'>,
  bounds: TrackBounds,
): CanvasPoint {
  return {
    x: normalizeAxis(point.x, bounds.minX, bounds.maxX),
    y: 1 - normalizeAxis(point.y, bounds.minY, bounds.maxY),
  }
}

export function outlinePointToCanvas(point: TrackPoint): CanvasPoint {
  return {
    x: clamp01(point.x),
    y: 1 - clamp01(point.y),
  }
}

export function buildOutlinePath(points: ReadonlyArray<TrackPoint>): string {
  if (points.length < 2) return ''

  return points
    .map((point, index) => {
      const canvas = outlinePointToCanvas(point)
      const command = index === 0 ? 'M' : 'L'
      return `${command} ${formatSvgCoord(canvas.x)} ${formatSvgCoord(canvas.y)}`
    })
    .join(' ')
}

export function canvasToSvg(point: CanvasPoint): CanvasPoint {
  return {
    x: clamp01(point.x) * VIEWBOX_SIZE,
    y: clamp01(point.y) * VIEWBOX_SIZE,
  }
}

export function isOnTrack(status: string | null | undefined): boolean {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized === 'ontrack' || normalized === 'on-track' || normalized === 'on_track'
}

function normalizeAxis(value: number, min: number, max: number): number {
  const range = max - min
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0.5
  if (range === 0) return 0.5
  return clamp01((value - min) / range)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

function formatSvgCoord(value: number): string {
  return (value * VIEWBOX_SIZE).toFixed(2)
}
