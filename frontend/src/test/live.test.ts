import { describe, expect, it } from 'vitest'
import {
  compoundClass,
  compoundLetter,
  extrapolateClock,
  latestRaceControl,
  liveSessionDisplay,
  loadPinnedDrivers,
  mergeVisibleSectors,
  positionDeltaClass,
  parseLiveStateEvent,
  rcFlagClass,
  rowsWithVisibleSectors,
  savePinnedDrivers,
  sortLiveTimingRows,
  togglePin,
  trackStatusInfo,
  trackStatusLabel,
  tyreClass,
  tyreLabel,
  windDirectionLabel,
} from '../lib/live'
import type { LiveDriverData, LiveSectorData, LiveStreamData } from '../types'
import type { LiveTimingRow } from '../lib/live'

const snapshot: LiveStreamData = {
  Drivers: {
    '16': {
      RacingNumber: '16',
      Position: 1,
      PrevPosition: 2,
      GapToLeader: '',
      Interval: '',
      LastLapTime: '1:14.100',
      LastLapPB: true,
      LastLapOB: false,
      BestLapTime: '1:13.900',
      BestLapPB: false,
      BestLapOB: false,
      BestLapNum: 20,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 21,
      SpeedTrap: '',
      Sectors: [],
    },
    '1': {
      RacingNumber: '1',
      Position: 2,
      PrevPosition: 1,
      GapToLeader: '+1.200',
      Interval: '+1.200',
      LastLapTime: '1:14.300',
      LastLapPB: false,
      LastLapOB: false,
      BestLapTime: '1:13.800',
      BestLapPB: false,
      BestLapOB: true,
      BestLapNum: 19,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 21,
      SpeedTrap: '',
      Sectors: [],
    },
  },
  DriverInfo: {
    '16': {
      RacingNumber: '16',
      BroadcastName: 'C LECLERC',
      Tla: 'LEC',
      TeamName: 'Ferrari',
      TeamColour: 'e8002d',
      FirstName: 'Charles',
      LastName: 'Leclerc',
    },
    '44': {
      RacingNumber: '44',
      BroadcastName: 'L HAMILTON',
      Tla: 'HAM',
      TeamName: 'Ferrari',
      TeamColour: 'e8002d',
      FirstName: 'Lewis',
      LastName: 'Hamilton',
    },
  },
  Tyres: {
    '16': { Compound: 'MEDIUM', New: false, Age: 8 },
  },
  RCMessages: [
    { Time: '14:01', Category: 'Flag', Flag: 'GREEN', Message: 'GREEN LIGHT', Lap: 0 },
    { Time: '14:08', Category: 'Drs', Flag: '', Message: 'DRS ENABLED', Lap: 3 },
  ],
  Weather: { AirTemp: 20, TrackTemp: 31, Humidity: 55, WindSpeed: 2, WindDir: 180, Rainfall: false },
  Session: { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Race', SessionName: 'Race', Path: '2026/Monaco/Race' },
  TeamRadio: [],
  TrackStatus: '1',
  CurrentLap: 21,
  TotalLaps: 78,
  Clock: '01:20:00',
  ClockRefTime: '2026-05-25T12:00:00Z',
  ClockExtrapolating: true,
  Stints: {},
}

function sector(value: string, over: Partial<LiveSectorData> = {}): LiveSectorData {
  return { Value: value, PersonalFastest: false, OverallFastest: false, ...over }
}

function timingRow(
  number: string,
  position: number,
  driver: Partial<LiveDriverData> = {},
): LiveTimingRow {
  return {
    RacingNumber: number,
    Position: position,
    Driver: {
      RacingNumber: number,
      Position: position,
      PrevPosition: position,
      GapToLeader: '',
      Interval: '',
      LastLapTime: '',
      LastLapPB: false,
      LastLapOB: false,
      BestLapTime: '',
      BestLapPB: false,
      BestLapOB: false,
      BestLapNum: 0,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 0,
      SpeedTrap: '',
      Sectors: [],
      ...driver,
    },
  }
}

function rows(count: number, knockedOut = 0): LiveTimingRow[] {
  return Array.from({ length: count }, (_, index) =>
    timingRow(String(index + 1), index + 1, { KnockedOut: index >= count - knockedOut }),
  )
}

describe('live transforms', () => {
  it('parses live EventSource snapshots without changing PascalCase data', () => {
    const parsed = parseLiveStateEvent(JSON.stringify({ is_live: true, data: snapshot }))
    expect(parsed?.is_live).toBe(true)
    expect(parsed?.data?.Drivers['16'].RacingNumber).toBe('16')
  })

  it('sorts timing rows by live position and includes drivers with metadata only', () => {
    const rows = sortLiveTimingRows(snapshot)
    expect(rows.map((row) => row.RacingNumber)).toEqual(['16', '1', '44'])
    expect(rows[2].Position).toBe(3)
  })

  it('formats tyre labels and classes', () => {
    expect(tyreLabel({ Compound: 'MEDIUM', New: false, Age: 8 })).toBe('M +8')
    expect(tyreClass({ Compound: 'INTERMEDIATE', New: true, Age: 1 })).toBe('tyre-inter')
    expect(tyreLabel(undefined)).toBe('?')
  })

  it('maps track status and race control ordering', () => {
    expect(trackStatusLabel('4')).toBe('SC')
    expect(latestRaceControl(snapshot.RCMessages, 1)[0].Message).toBe('DRS ENABLED')
  })

  it('maps position delta and race-control flag classes', () => {
    expect(positionDeltaClass(snapshot.Drivers['16'])).toBe('pos-gain')
    expect(positionDeltaClass(snapshot.Drivers['1'])).toBe('pos-loss')
    expect(positionDeltaClass({ ...snapshot.Drivers['1'], PrevPosition: 2, Position: 2 })).toBe('')
    expect(rcFlagClass('GREEN')).toBe('rc-flag-green')
    expect(rcFlagClass('safety car')).toBe('rc-flag-sc')
    expect(rcFlagClass('virtual safety car')).toBe('rc-flag-vsc')
    expect(rcFlagClass('unknown')).toBe('')
  })

  it('extrapolates the session clock from the reference time', () => {
    expect(extrapolateClock('01:20:00', '2026-05-25T12:00:00Z', true, Date.parse('2026-05-25T12:00:30Z'))).toBe('01:19:30')
  })
})

describe('track status mapping', () => {
  it('maps all known raw statuses to banner info', () => {
    expect(trackStatusInfo('1')).toMatchObject({ key: 'green', label: 'TRACK CLEAR' })
    expect(trackStatusInfo('2')).toMatchObject({ key: 'yellow', label: 'YELLOW FLAG' })
    expect(trackStatusInfo('4')).toMatchObject({ key: 'sc', label: 'SAFETY CAR' })
    expect(trackStatusInfo('5')).toMatchObject({ key: 'red', label: 'RED FLAG' })
    expect(trackStatusInfo('6')).toMatchObject({ key: 'vsc', label: 'VIRTUAL SAFETY CAR' })
    expect(trackStatusInfo('7')).toMatchObject({ key: 'vsc', label: 'VSC ENDING' })
  })

  it('falls back to a neutral display for unknown values', () => {
    expect(trackStatusInfo('9')).toMatchObject({ key: 'unknown', label: 'TRACK STATUS 9' })
    expect(trackStatusInfo('')).toMatchObject({ key: 'unknown', label: 'TRACK STATUS UNKNOWN' })
    expect(trackStatusInfo(undefined)).toMatchObject({ key: 'unknown' })
  })

  it('keeps the compact label helper defensive', () => {
    expect(trackStatusLabel('7')).toBe('VSC ENDING')
    expect(trackStatusLabel('99')).toBe('99')
    expect(trackStatusLabel('')).toBe('UNKNOWN')
  })
})

describe('live qualifying display', () => {
  it('puts the SQ1 cutoff after P17 for a 22-car sprint qualifying session', () => {
    const display = liveSessionDisplay(
      { MeetingName: 'British Grand Prix', CircuitName: 'Silverstone', SessionType: 'Sprint Qualifying', SessionName: 'Sprint Qualifying', Path: '' },
      rows(22),
    )
    expect(display.phaseLabel).toBe('SQ1')
    expect(display.cutoffPosition).toBe(17)
    expect(display.advanceCount).toBe(17)
    expect(display.atRiskStart).toBe(18)
    expect(display.atRiskEnd).toBe(22)
  })

  it('keeps the normal Q1 cutoff after P15 for a 20-car qualifying session', () => {
    const display = liveSessionDisplay(
      { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Qualifying', SessionName: 'Qualifying', Path: '' },
      rows(20),
    )
    expect(display.phaseLabel).toBe('Q1')
    expect(display.cutoffPosition).toBe(15)
  })

  it('moves phase 2 cutoff after P10 once five cars are knocked out', () => {
    const display = liveSessionDisplay(
      { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Qualifying', SessionName: 'Qualifying', Path: '' },
      rows(20, 5),
    )
    expect(display.phaseLabel).toBe('Q2')
    expect(display.cutoffPosition).toBe(10)
  })

  it('shows no cutoff for race sessions or Q3', () => {
    expect(
      liveSessionDisplay(
        { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Race', SessionName: 'Race', Path: '' },
        rows(20),
      ).cutoffPosition,
    ).toBeNull()
    expect(
      liveSessionDisplay(
        { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Qualifying', SessionName: 'Q3', Path: '' },
        rows(10),
      ).cutoffPosition,
    ).toBeNull()
  })
})

describe('visible sector display', () => {
  it('holds S1 and S2 through temporary blanks while a flying lap is active', () => {
    const first = [timingRow('4', 1, {
      NumberOfLaps: 3,
      OnFlyingLap: true,
      Sectors: [sector('29.111'), sector('41.222'), sector('')],
    })]
    const held = mergeVisibleSectors({}, first)
    const blank = [timingRow('4', 1, {
      NumberOfLaps: 3,
      OnFlyingLap: false,
      Sectors: [sector(''), sector(''), sector('')],
    })]
    const next = mergeVisibleSectors(held, blank)
    const visibleRows = rowsWithVisibleSectors(blank, next)

    expect(visibleRows[0].Driver.Sectors[0].Value).toBe('29.111')
    expect(visibleRows[0].Driver.Sectors[1].Value).toBe('41.222')
  })

  it('clears held sectors after the lap completes and the feed goes blank', () => {
    const first = mergeVisibleSectors({}, [timingRow('4', 1, {
      NumberOfLaps: 3,
      LastLapTime: '1:30.000',
      OnFlyingLap: true,
      Sectors: [sector('29.111'), sector('41.222'), sector('20.333')],
    })])
    const next = mergeVisibleSectors(first, [timingRow('4', 1, {
      NumberOfLaps: 4,
      LastLapTime: '1:30.000',
      OnFlyingLap: false,
      Sectors: [sector(''), sector(''), sector('')],
    })])

    expect(next['4']).toBeUndefined()
  })
})

describe('weather and stint helpers', () => {
  it('maps wind direction degrees to compass points', () => {
    expect(windDirectionLabel(0)).toBe('N')
    expect(windDirectionLabel(90)).toBe('E')
    expect(windDirectionLabel(180)).toBe('S')
    expect(windDirectionLabel(315)).toBe('NW')
    expect(windDirectionLabel(359)).toBe('N')
    expect(windDirectionLabel(null)).toBe('')
  })

  it('maps stint compounds to classes and letters', () => {
    expect(compoundClass('SOFT')).toBe('tyre-soft')
    expect(compoundClass('INTERMEDIATE')).toBe('tyre-inter')
    expect(compoundClass('')).toBe('tyre-unknown')
    expect(compoundLetter('MEDIUM')).toBe('M')
    expect(compoundLetter(undefined)).toBe('?')
  })
})

describe('pinned drivers', () => {
  it('toggles pins with a max of three, dropping the oldest', () => {
    expect(togglePin([], '1')).toEqual(['1'])
    expect(togglePin(['1'], '1')).toEqual([])
    expect(togglePin(['1', '4'], '16')).toEqual(['1', '4', '16'])
    expect(togglePin(['1', '4', '16'], '44')).toEqual(['4', '16', '44'])
    expect(togglePin(['1', '4', '16'], '4')).toEqual(['1', '16'])
  })

  it('round-trips pins through storage and survives corrupt data', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }
    savePinnedDrivers(['1', '44'], storage)
    expect(loadPinnedDrivers(storage)).toEqual(['1', '44'])

    store.set('box-box.live.pins', 'not json {{')
    expect(loadPinnedDrivers(storage)).toEqual([])
    store.set('box-box.live.pins', '{"nope":true}')
    expect(loadPinnedDrivers(storage)).toEqual([])
  })
})
