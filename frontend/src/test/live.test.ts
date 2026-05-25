import { describe, expect, it } from 'vitest'
import {
  extrapolateClock,
  latestRaceControl,
  parseLiveStateEvent,
  sortLiveTimingRows,
  trackStatusLabel,
  tyreClass,
  tyreLabel,
} from '../lib/live'
import type { LiveStreamData } from '../types'

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
  Session: { MeetingName: 'Monaco Grand Prix', CircuitName: 'Monaco', SessionType: 'Race', SessionName: 'Race' },
  TrackStatus: '1',
  CurrentLap: 21,
  TotalLaps: 78,
  Clock: '01:20:00',
  ClockRefTime: '2026-05-25T12:00:00Z',
  ClockExtrapolating: true,
  Stints: {},
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

  it('extrapolates the session clock from the reference time', () => {
    expect(extrapolateClock('01:20:00', '2026-05-25T12:00:00Z', true, Date.parse('2026-05-25T12:00:30Z'))).toBe('01:19:30')
  })
})
