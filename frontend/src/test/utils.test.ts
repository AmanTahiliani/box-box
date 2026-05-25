import { describe, it, expect } from 'vitest'
import {
  teamColor,
  formatDuration,
  formatGap,
  formatLapTime,
  gridDelta,
  gridDeltaClass,
  positionClass,
} from '../utils'

describe('teamColor', () => {
  it('prepends # to bare hex', () => {
    expect(teamColor('e8002d')).toBe('#e8002d')
  })
  it('passes through already-prefixed hex', () => {
    expect(teamColor('#3671c6')).toBe('#3671c6')
  })
  it('returns fallback for empty string', () => {
    expect(teamColor('')).toBe('#444444')
  })
  it('returns fallback for undefined', () => {
    expect(teamColor(undefined)).toBe('#444444')
  })
})

describe('formatDuration', () => {
  it('formats a race duration with hours', () => {
    expect(formatDuration(5534.456)).toBe('1:32:14.456')
  })
  it('formats a sub-hour duration', () => {
    expect(formatLapTime(74.892)).toBe('1:14.892')
  })
  it('returns — for null', () => {
    expect(formatDuration(null)).toBe('—')
  })
  it('returns — for undefined', () => {
    expect(formatDuration(undefined)).toBe('—')
  })
  it('handles array (qualifying)', () => {
    expect(formatDuration([74.892])).toBe('1:14.892')
  })
  it('returns — for zero', () => {
    expect(formatDuration(0)).toBe('—')
  })
})

describe('formatGap', () => {
  it('formats a numeric gap', () => {
    expect(formatGap(3.456)).toBe('+3.456')
  })
  it('passes through a string gap (lapped)', () => {
    expect(formatGap('+1 LAP')).toBe('+1 LAP')
  })
  it('returns — for null', () => {
    expect(formatGap(null)).toBe('—')
  })
  it('handles array gap', () => {
    expect(formatGap([8.123])).toBe('+8.123')
  })
})

describe('formatLapTime', () => {
  it('formats qualifying lap time', () => {
    expect(formatLapTime(74.892)).toBe('1:14.892')
  })
  it('returns — for null', () => {
    expect(formatLapTime(null)).toBe('—')
  })
  it('pads seconds correctly', () => {
    expect(formatLapTime(64.5)).toBe('1:04.500')
  })
})

describe('gridDelta', () => {
  it('shows gain when finish position improved', () => {
    expect(gridDelta(1, 3)).toBe('↑2')
  })
  it('shows loss when finish position dropped', () => {
    expect(gridDelta(5, 2)).toBe('↓3')
  })
  it('shows — for same position', () => {
    expect(gridDelta(4, 4)).toBe('—')
  })
  it('shows — when grid position is 0', () => {
    expect(gridDelta(1, 0)).toBe('—')
  })
})

describe('gridDeltaClass', () => {
  it('returns pos-gain for improvement', () => {
    expect(gridDeltaClass(1, 5)).toBe('pos-gain')
  })
  it('returns pos-loss for drop', () => {
    expect(gridDeltaClass(6, 2)).toBe('pos-loss')
  })
  it('returns pos-same for no change', () => {
    expect(gridDeltaClass(3, 3)).toBe('pos-same')
  })
})

describe('positionClass', () => {
  it('returns pos-p1 for first', () => {
    expect(positionClass(1)).toBe('pos-p1')
  })
  it('returns pos-p2 for second', () => {
    expect(positionClass(2)).toBe('pos-p2')
  })
  it('returns pos-p3 for third', () => {
    expect(positionClass(3)).toBe('pos-p3')
  })
  it('returns pos-n for other positions', () => {
    expect(positionClass(10)).toBe('pos-n')
  })
})
