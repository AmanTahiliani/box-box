import { describe, expect, it } from 'vitest'
import {
  DEG_SLOPE_THRESHOLD,
  MIN_CLEAN_LAPS,
  PIT_LOSS_SECONDS,
  cleanStintSamples,
  degradationModel,
  estimatePitRejoin,
  formatSlope,
  parseLapTimeSeconds,
  recordStintSamples,
  stintInputFromRow,
} from '../lib/tyredeg'
import type { StintHistoryMap, StintLapInput, StintSample } from '../lib/tyredeg'
import type { LiveTimingRow } from '../lib/live'
import type { LiveDriverData } from '../types'

function makeInput(overrides: Partial<StintLapInput> = {}): StintLapInput {
  return {
    racingNumber: '1',
    lapNumber: 1,
    lastLapTime: '1:30.000',
    compound: 'MEDIUM',
    tyreAge: 1,
    inPit: false,
    pitOut: false,
    ...overrides,
  }
}

/** Feed a sequence of snapshots for one driver through the accumulator. */
function accumulate(snapshots: Array<Partial<StintLapInput>>): StintHistoryMap {
  let history: StintHistoryMap = {}
  for (const snapshot of snapshots) {
    history = recordStintSamples(history, [makeInput(snapshot)])
  }
  return history
}

function makeRow(
  number: string,
  position: number,
  tla: string,
  driver: Partial<LiveDriverData> = {},
): LiveTimingRow {
  return {
    RacingNumber: number,
    Position: position,
    Driver: {
      RacingNumber: number,
      Position: position,
      Interval: '',
      GapToLeader: '',
      LastLapTime: '1:30.000',
      NumberOfLaps: 10,
      InPit: false,
      PitOut: false,
      Retired: false,
      ...driver,
    } as LiveDriverData,
    Info: {
      RacingNumber: number,
      BroadcastName: '',
      Tla: tla,
      TeamName: '',
      TeamColour: '3671c6',
      FirstName: '',
      LastName: '',
    },
  }
}

describe('parseLapTimeSeconds', () => {
  it('parses minute-form and plain-second lap times', () => {
    expect(parseLapTimeSeconds('1:23.456')).toBeCloseTo(83.456)
    expect(parseLapTimeSeconds('83.456')).toBeCloseTo(83.456)
  })

  it('rejects empty, garbage, and non-positive values', () => {
    expect(parseLapTimeSeconds('')).toBeNull()
    expect(parseLapTimeSeconds(undefined)).toBeNull()
    expect(parseLapTimeSeconds(null)).toBeNull()
    expect(parseLapTimeSeconds('LAP 12')).toBeNull()
    expect(parseLapTimeSeconds('-1:30.000')).toBeNull()
  })
})

describe('recordStintSamples', () => {
  it('accumulates one sample per completed lap across snapshots', () => {
    const history = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000' },
      { lapNumber: 2, lastLapTime: '1:30.100' },
      { lapNumber: 2, lastLapTime: '1:30.100' }, // repeated snapshot, same lap
      { lapNumber: 3, lastLapTime: '1:30.200' },
    ])
    expect(history['1'].samples).toEqual([
      { lap: 2, seconds: 90.1 },
      { lap: 3, seconds: 90.2 },
    ])
  })

  it('does not record a lap from the very first snapshot seen', () => {
    const history = accumulate([{ lapNumber: 5, lastLapTime: '1:29.000' }])
    expect(history['1'].samples).toEqual([])
  })

  it('replaces (not duplicates) a sample when the lap time is corrected', () => {
    const history = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000' },
      { lapNumber: 2, lastLapTime: '1:30.500' },
      { lapNumber: 2, lastLapTime: '1:30.400' }, // late correction for lap 2
    ])
    expect(history['1'].samples).toEqual([{ lap: 2, seconds: 90.4 }])
  })

  it('resets the stint on compound change and skips the next lap', () => {
    const history = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000', compound: 'SOFT', tyreAge: 1 },
      { lapNumber: 2, lastLapTime: '1:30.100', compound: 'SOFT', tyreAge: 2 },
      { lapNumber: 3, lastLapTime: '1:30.200', compound: 'SOFT', tyreAge: 3 },
      // Boxed for hards: old samples dropped, out-lap (lap 4) excluded.
      { lapNumber: 4, lastLapTime: '1:52.000', compound: 'HARD', tyreAge: 0 },
      { lapNumber: 5, lastLapTime: '1:31.000', compound: 'HARD', tyreAge: 1 },
      { lapNumber: 6, lastLapTime: '1:31.100', compound: 'HARD', tyreAge: 2 },
    ])
    expect(history['1'].samples).toEqual([
      { lap: 5, seconds: 91.0 },
      { lap: 6, seconds: 91.1 },
    ])
  })

  it('resets on a fresh set of the same compound (tyre age drops)', () => {
    const history = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000', tyreAge: 10 },
      { lapNumber: 2, lastLapTime: '1:30.100', tyreAge: 11 },
      { lapNumber: 3, lastLapTime: '1:50.000', tyreAge: 0 }, // new mediums
      { lapNumber: 4, lastLapTime: '1:30.500', tyreAge: 1 },
    ])
    expect(history['1'].samples).toEqual([{ lap: 4, seconds: 90.5 }])
  })

  it('excludes laps completed in the pit lane or on pit exit', () => {
    const history = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000' },
      { lapNumber: 2, lastLapTime: '1:30.100' },
      { lapNumber: 3, lastLapTime: '1:48.000', inPit: true }, // in-lap
      { lapNumber: 4, lastLapTime: '1:45.000', pitOut: true, tyreAge: 0 }, // out-lap
      { lapNumber: 5, lastLapTime: '1:30.300', tyreAge: 1 },
    ])
    expect(history['1'].samples).toEqual([{ lap: 5, seconds: 90.3 }])
  })

  it('prunes drivers missing from the snapshot and does not mutate input', () => {
    const initial = accumulate([
      { lapNumber: 1, lastLapTime: '1:30.000' },
      { lapNumber: 2, lastLapTime: '1:30.100' },
    ])
    const next = recordStintSamples(initial, [makeInput({ racingNumber: '44' })])
    expect(next['1']).toBeUndefined()
    expect(next['44']).toBeDefined()
    expect(initial['1'].samples).toHaveLength(1)
  })
})

describe('degradationModel', () => {
  const series = (times: number[], startLap = 1): StintSample[] =>
    times.map((seconds, index) => ({ lap: startLap + index, seconds }))

  it('fits the slope of a known linear series', () => {
    const model = degradationModel(series([90.0, 90.1, 90.2, 90.3, 90.4]))
    expect(model).not.toBeNull()
    expect(model!.slope).toBeCloseTo(0.1, 5)
    expect(model!.trend).toBe('degrading')
  })

  it('classifies improving and stable stints', () => {
    expect(degradationModel(series([91.0, 90.8, 90.6, 90.4]))!.trend).toBe('improving')
    expect(degradationModel(series([90.0, 90.01, 90.0, 90.02, 90.01]))!.trend).toBe('stable')
    // A slope clearly under the threshold stays stable.
    expect(DEG_SLOPE_THRESHOLD).toBeGreaterThan(0.03)
    expect(degradationModel(series([90.0, 90.03, 90.06, 90.09, 90.12]))!.trend).toBe('stable')
  })

  it('excludes outliers more than ~5s off the stint median', () => {
    // Clean laps follow +0.1s/lap; the 97.5 (traffic/spin) must not skew the fit.
    const samples = series([90.0, 90.1, 97.5, 90.3, 90.4, 90.5])
    expect(cleanStintSamples(samples)).toHaveLength(5)
    const model = degradationModel(samples)
    expect(model!.samples).toHaveLength(5)
    expect(model!.slope).toBeCloseTo(0.1, 5)
  })

  it('returns null with fewer than MIN_CLEAN_LAPS clean laps', () => {
    expect(degradationModel(series([90.0, 90.1, 90.2]))).toBeNull()
    // 4 raw laps but one outlier -> only 3 clean -> still warming up
    expect(degradationModel(series([90.0, 90.1, 90.2, 99.0]))).toBeNull()
    expect(MIN_CLEAN_LAPS).toBe(4)
  })
})

describe('formatSlope', () => {
  it('renders signed seconds-per-lap', () => {
    expect(formatSlope(0.083)).toBe('+0.08s/lap')
    expect(formatSlope(-0.125)).toBe('−0.13s/lap')
  })
})

describe('estimatePitRejoin', () => {
  const ladder = [
    makeRow('1', 1, 'VER'),
    makeRow('4', 2, 'NOR', { Interval: '+5.0' }),
    makeRow('44', 3, 'HAM', { Interval: '+10.0' }),
    makeRow('14', 4, 'ALO', { Interval: '+15.0' }),
    makeRow('16', 5, 'LEC', { Interval: '+20.0' }),
  ]

  it('projects the rejoin slot between the right cars', () => {
    // VER pits from P1: NOR (5s) and HAM (15s cumulative) get past;
    // ALO would be 30s back -> stays behind. Rejoin ~P3.
    const estimate = estimatePitRejoin(ladder, '1')
    expect(estimate).toEqual({
      rejoinPosition: 3,
      positionsLost: 2,
      aheadCode: 'HAM',
      behindCode: 'ALO',
    })
  })

  it('keeps position when the cars behind are further than the pit loss', () => {
    const estimate = estimatePitRejoin(ladder, '14')
    // LEC is 20s behind ALO — inside the 22s window, so he gets past.
    expect(estimate!.rejoinPosition).toBe(5)
    expect(estimate!.aheadCode).toBe('LEC')
    expect(estimate!.behindCode).toBeNull()

    const wide = estimatePitRejoin(
      [makeRow('1', 1, 'VER'), makeRow('4', 2, 'NOR', { Interval: `+${PIT_LOSS_SECONDS + 3}.0` })],
      '1',
    )
    expect(wide!.rejoinPosition).toBe(1)
    expect(wide!.positionsLost).toBe(0)
    expect(wide!.behindCode).toBe('NOR')
  })

  it('stops the ladder walk at lapped cars and skips pitted/retired ones', () => {
    const estimate = estimatePitRejoin(
      [
        makeRow('1', 1, 'VER'),
        makeRow('4', 2, 'NOR', { Interval: '+5.0', InPit: true }), // mid-stop, excluded
        makeRow('44', 3, 'HAM', { Interval: '+10.0' }),
        makeRow('16', 4, 'LEC', { Interval: '1L' }), // lapped — walk ends here
        makeRow('14', 5, 'ALO', { Interval: '+2.0' }),
      ],
      '1',
    )
    expect(estimate!.positionsLost).toBe(1) // only HAM gets past
    expect(estimate!.rejoinPosition).toBe(2)
    expect(estimate!.aheadCode).toBe('HAM')
    expect(estimate!.behindCode).toBe('LEC')
  })

  it('returns null for unknown drivers', () => {
    expect(estimatePitRejoin(ladder, '99')).toBeNull()
  })
})

describe('stintInputFromRow', () => {
  it('maps tower rows into accumulator inputs', () => {
    const row = makeRow('4', 2, 'NOR', { NumberOfLaps: 12, LastLapTime: '1:29.900' })
    row.Tyre = { Compound: 'HARD', New: false, Age: 7 }
    expect(stintInputFromRow(row)).toEqual({
      racingNumber: '4',
      lapNumber: 12,
      lastLapTime: '1:29.900',
      compound: 'HARD',
      tyreAge: 7,
      inPit: false,
      pitOut: false,
    })
  })
})
