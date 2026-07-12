import { describe, expect, it } from 'vitest'
import { isReplayMapAvailable } from '../lib/replayMap'
import type { ReplayFramesResponse, TrackOutline } from '../types'

const outline: TrackOutline = {
  circuit_key: 1,
  bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
  points: [{ x: 0, y: 0 }],
}

const replay: ReplayFramesResponse = {
  session_key: 1,
  interval_ms: 5000,
  start_time: '2025-05-25T13:00:00Z',
  frames: [
    { t: 0, cars: {} },
    { t: 5000, cars: {} },
  ],
}

describe('isReplayMapAvailable', () => {
  it('returns true when frames and outline are present', () => {
    expect(isReplayMapAvailable(replay, outline, false)).toBe(true)
  })

  it('returns false when frames are sparse', () => {
    expect(isReplayMapAvailable({ ...replay, frames: [{ t: 0, cars: {} }] }, outline, false)).toBe(false)
  })

  it('returns false on query error', () => {
    expect(isReplayMapAvailable(replay, outline, true)).toBe(false)
  })
})
