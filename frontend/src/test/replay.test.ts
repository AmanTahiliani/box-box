import { describe, expect, it } from 'vitest'
import type { ReplayFrame, TrackBounds } from '../types'
import { interpolateReplayCars, lookupReplayFramePair, replayCarToSvg } from '../lib/replay'

const frames: ReplayFrame[] = [
  { t: 0, cars: { '1': { x: 0, y: 0 } } },
  { t: 5000, cars: { '1': { x: 10, y: 20 }, '4': { x: 40, y: 80 } } },
  { t: 10000, cars: { '1': { x: 20, y: 40 } } },
]

describe('replay helpers', () => {
  it('looks up boundary frame pairs', () => {
    expect(lookupReplayFramePair(frames, -1)).toEqual({ previous: frames[0], next: frames[0] })
    expect(lookupReplayFramePair(frames, 10000)).toEqual({ previous: frames[2], next: frames[2] })
    expect(lookupReplayFramePair([], 1000)).toEqual({ previous: null, next: null })
  })

  it('interpolates cars between frames and keeps one-sided samples visible', () => {
    const cars = interpolateReplayCars(frames, 2500)
    expect(cars['1']).toEqual({ x: 5, y: 10 })
    expect(cars['4']).toEqual({ x: 40, y: 80 })
  })

  it('clamps interpolation outside the replay range', () => {
    expect(interpolateReplayCars(frames, -500)['1']).toEqual({ x: 0, y: 0 })
    expect(interpolateReplayCars(frames, 12000)['1']).toEqual({ x: 20, y: 40 })
  })

  it('maps replay GPS through the shared track-map coordinate transform', () => {
    const bounds: TrackBounds = { minX: 0, maxX: 100, minY: 0, maxY: 200 }
    expect(replayCarToSvg({ x: 50, y: 50 }, bounds)).toEqual({ x: 50, y: 75 })
  })
})
