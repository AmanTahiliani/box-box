import { describe, expect, it } from 'vitest'
import {
  MAX_EVENTS,
  appendEvents,
  diffSnapshots,
  humanizeRaceControl,
  sessionSignature,
} from '../lib/events'
import type { LiveEvent } from '../lib/events'
import type {
  LiveDriverData,
  LiveDriverInfo,
  LiveRCMessage,
  LiveStreamData,
} from '../types'

function driver(number: string, position: number, overrides: Partial<LiveDriverData> = {}): LiveDriverData {
  return {
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
    NumberOfLaps: 10,
    SpeedTrap: '',
    Sectors: [],
    ...overrides,
  }
}

function info(number: string, tla: string): LiveDriverInfo {
  return {
    RacingNumber: number,
    BroadcastName: tla,
    Tla: tla,
    TeamName: '',
    TeamColour: '3671C6',
    FirstName: '',
    LastName: '',
  }
}

function snapshot(
  drivers: Record<string, LiveDriverData>,
  overrides: Partial<LiveStreamData> = {},
): LiveStreamData {
  return {
    Drivers: drivers,
    DriverInfo: {
      '1': info('1', 'VER'),
      '4': info('4', 'NOR'),
      '44': info('44', 'HAM'),
    },
    Tyres: {},
    RCMessages: [],
    TeamRadio: [],
    Weather: {} as LiveStreamData['Weather'],
    Session: {
      MeetingName: 'Test Grand Prix',
      CircuitName: 'Test Circuit',
      SessionType: 'Race',
      SessionName: 'Race',
      Path: '',
    },
    TrackStatus: '1',
    CurrentLap: 12,
    TotalLaps: 57,
    Clock: '01:23:45',
    ClockRefTime: '',
    ClockExtrapolating: false,
    Stints: {},
    ...overrides,
  }
}

function rc(message: string, category: string, overrides: Partial<LiveRCMessage> = {}): LiveRCMessage {
  return { Time: '2026-07-03T14:00:00Z', Category: category, Flag: '', Message: message, Lap: 12, ...overrides }
}

describe('diffSnapshots', () => {
  it('returns no events for identical snapshots', () => {
    const prev = snapshot({ '1': driver('1', 1), '44': driver('44', 2) })
    const next = snapshot({ '1': driver('1', 1), '44': driver('44', 2) })
    expect(diffSnapshots(prev, next)).toEqual([])
  })

  it('reports an overtake when two drivers swap positions', () => {
    const prev = snapshot({ '1': driver('1', 3), '44': driver('44', 2) })
    const next = snapshot({ '1': driver('1', 2), '44': driver('44', 3) })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('overtake')
    expect(events[0].headline).toBe('VER overtakes HAM for P2')
    expect(events[0].racingNumbers).toEqual(['1', '44'])
    expect(events[0].lap).toBe(12)
  })

  it('reports a generic gain when the displaced driver pitted instead', () => {
    const prev = snapshot({ '1': driver('1', 3), '44': driver('44', 2) })
    const next = snapshot({ '1': driver('1', 2), '44': driver('44', 5, { InPit: true }) })
    const events = diffSnapshots(prev, next)
    const gain = events.find((event) => event.kind === 'position-gain')
    expect(gain?.headline).toBe('VER moves up to P2 (from P3)')
    // HAM's drop is covered by the pit-in event, not a position-loss one.
    expect(events.some((event) => event.kind === 'position-loss')).toBe(false)
    expect(events.some((event) => event.kind === 'pit-in')).toBe(true)
  })

  it('reports a position loss not explained by an overtake or pit stop', () => {
    const prev = snapshot({ '44': driver('44', 3) })
    const next = snapshot({ '44': driver('44', 6) })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('position-loss')
    expect(events[0].headline).toBe('HAM drops to P6 (from P3)')
  })

  it('reports pit entry with the position pitted from', () => {
    const prev = snapshot({ '4': driver('4', 3) })
    const next = snapshot({ '4': driver('4', 3, { InPit: true }) })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('pit-in')
    expect(events[0].headline).toBe('NOR pits from P3')
    expect(events[0].racingNumbers).toEqual(['4'])
  })

  it('reports pit exit with rejoin position, compound, and stop count', () => {
    const prev = snapshot({ '4': driver('4', 3, { InPit: true }) })
    const next = snapshot(
      { '4': driver('4', 6, { PitOut: true }) },
      {
        Tyres: { '4': { Compound: 'MEDIUM', New: true, Age: 0 } },
        Stints: {
          '4': [
            { Compound: 'SOFT', New: true, Laps: 12 },
            { Compound: 'HARD', New: true, Laps: 20 },
            { Compound: 'MEDIUM', New: true, Laps: 0 },
          ],
        },
      },
    )
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('pit-out')
    expect(events[0].headline).toBe('NOR rejoins P6 (MEDIUM, 2nd stop)')
  })

  it('reports personal and overall best laps once per lap time', () => {
    const prev = snapshot({
      '1': driver('1', 1, { LastLapTime: '1:24.500' }),
      '4': driver('4', 2, { LastLapTime: '1:25.100' }),
    })
    const next = snapshot({
      '1': driver('1', 1, { LastLapTime: '1:23.456', LastLapPB: true, LastLapOB: true }),
      '4': driver('4', 2, { LastLapTime: '1:24.900', LastLapPB: true }),
    })
    const events = diffSnapshots(prev, next)
    const fastest = events.find((event) => event.kind === 'fastest-lap')
    const personal = events.find((event) => event.kind === 'personal-best')
    expect(fastest?.headline).toBe('VER sets the fastest lap — 1:23.456')
    expect(personal?.headline).toBe('NOR sets a personal best — 1:24.900')
    // A repeat diff of the same state produces nothing new.
    expect(diffSnapshots(next, snapshot(next.Drivers))).toEqual([])
  })

  it('reports a retirement with the last running position', () => {
    const prev = snapshot({ '44': driver('44', 5) })
    const next = snapshot({ '44': driver('44', 5, { Retired: true }) })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('retirement')
    expect(events[0].headline).toBe('HAM retires')
    expect(events[0].detail).toBe('Was running P5')
  })

  it('reports track status transitions as human sentences', () => {
    const prev = snapshot({ '1': driver('1', 1) })
    const next = snapshot({ '1': driver('1', 1) }, { TrackStatus: '4' })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('track-status')
    expect(events[0].headline).toBe('Safety Car deployed')
  })

  it('reports new Flag/SafetyCar/Drs race-control messages and skips other categories', () => {
    const existing = rc('YELLOW IN TRACK SECTOR 7', 'Flag', { Time: '2026-07-03T13:00:00Z' })
    const prev = snapshot({ '1': driver('1', 1) }, { RCMessages: [existing] })
    const next = snapshot({ '1': driver('1', 1) }, {
      RCMessages: [
        existing,
        rc('DRS ENABLED', 'Drs'),
        rc('FIA STEWARDS: CAR 4 (NOR) UNDER INVESTIGATION', 'Other'),
      ],
    })
    const events = diffSnapshots(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('race-control')
    expect(events[0].headline).toBe('DRS enabled')
  })

  it('produces stable ids across repeated diffs of the same snapshots', () => {
    const prev = snapshot({ '1': driver('1', 3), '44': driver('44', 2) })
    const next = snapshot({ '1': driver('1', 2), '44': driver('44', 3) })
    const first = diffSnapshots(prev, next)
    const second = diffSnapshots(prev, next)
    expect(first.map((event) => event.id)).toEqual(second.map((event) => event.id))
  })
})

describe('humanizeRaceControl', () => {
  it('sentence-cases while preserving acronyms', () => {
    expect(humanizeRaceControl('SAFETY CAR DEPLOYED')).toBe('Safety car deployed')
    expect(humanizeRaceControl('DRS ENABLED')).toBe('DRS enabled')
    expect(humanizeRaceControl('VSC DEPLOYED')).toBe('VSC deployed')
  })
})

describe('appendEvents', () => {
  const event = (id: string): LiveEvent => ({
    id,
    kind: 'race-control',
    lap: 1,
    timestamp: '',
    headline: id,
    racingNumbers: [],
  })

  it('prepends new events newest-first and dedups by id', () => {
    const buffer = appendEvents([event('a')], [event('a'), event('b'), event('c')])
    expect(buffer.map((entry) => entry.id)).toEqual(['c', 'b', 'a'])
    // Re-appending the same diff output changes nothing.
    const again = appendEvents(buffer, [event('b'), event('c')])
    expect(again.map((entry) => entry.id)).toEqual(['c', 'b', 'a'])
  })

  it('evicts the oldest events beyond the cap', () => {
    let buffer: LiveEvent[] = []
    for (let index = 0; index < MAX_EVENTS + 5; index += 1) {
      buffer = appendEvents(buffer, [event(`event-${index}`)])
    }
    expect(buffer).toHaveLength(MAX_EVENTS)
    expect(buffer[0].id).toBe(`event-${MAX_EVENTS + 4}`)
    expect(buffer[buffer.length - 1].id).toBe('event-5')
  })
})

describe('sessionSignature', () => {
  it('changes when the session changes, enabling buffer resets', () => {
    const race = snapshot({}).Session
    expect(sessionSignature(race)).toBe('Test Grand Prix|Race|Race')
    expect(sessionSignature({ ...race, SessionName: 'Qualifying' })).not.toBe(sessionSignature(race))
    expect(sessionSignature(null)).toBe('')
  })
})
