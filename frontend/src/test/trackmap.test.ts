import { describe, expect, it } from 'vitest'
import {
  buildOutlinePath,
  canvasToSvg,
  isOnTrack,
  normalizeRawPoint,
  outlinePointToCanvas,
} from '../lib/trackmap'

describe('track map transforms', () => {
  it('normalizes raw F1 coordinates into canvas space', () => {
    const point = normalizeRawPoint(
      { x: 50, y: 75 },
      { minX: 0, maxX: 100, minY: 50, maxY: 100 },
    )
    expect(point).toEqual({ x: 0.5, y: 0.5 })
    expect(canvasToSvg(point)).toEqual({ x: 50, y: 50 })
  })

  it('centers zero-range bounds and clamps out-of-range points', () => {
    expect(normalizeRawPoint({ x: 10, y: 20 }, { minX: 10, maxX: 10, minY: 20, maxY: 20 }))
      .toEqual({ x: 0.5, y: 0.5 })
    expect(normalizeRawPoint({ x: 20, y: 5 }, { minX: 10, maxX: 15, minY: 10, maxY: 15 }))
      .toEqual({ x: 1, y: 1 })
  })

  it('builds an SVG path from normalized outline points', () => {
    expect(outlinePointToCanvas({ x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.25 })
    expect(buildOutlinePath([{ x: 0, y: 0 }, { x: 1, y: 1 }]))
      .toBe('M 0.00 100.00 L 100.00 0.00')
    expect(buildOutlinePath([{ x: 0, y: 0 }])).toBe('')
  })

  it('classifies on-track status defensively', () => {
    expect(isOnTrack('OnTrack')).toBe(true)
    expect(isOnTrack('OffTrack')).toBe(false)
    expect(isOnTrack('')).toBe(true)
  })
})
