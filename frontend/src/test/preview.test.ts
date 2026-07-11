import { describe, it, expect } from 'vitest'
import type { ChampHubDriver, ChampionshipHub, EnrichedGrid, EnrichedResult, Meeting, Session } from '../types'
import {
  buildTitleFightContext,
  countdownTargetSession,
  extractPodium,
  extractPole,
  findPriorYearMeetingByCircuit,
  findRaceSession,
  formatPointsGap,
  isSprintWeekend,
  pickPreviewMeeting,
  RACE_WIN_POINTS,
  SPRINT_WEEKEND_MAX_POINTS,
} from '../lib/preview'

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  meeting_key: 1,
  meeting_name: 'Monaco',
  meeting_official_name: 'Monaco GP',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_key: 10,
  circuit_short_name: 'Monaco',
  date_start: '2026-05-22T00:00:00+00:00',
  date_end: '2026-05-24T23:59:59+00:00',
  year: 2026,
  ...overrides,
})

const session = (overrides: Partial<Session> = {}): Session => ({
  session_key: 100,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: 1,
  date_start: '2026-05-24T13:00:00+00:00',
  date_end: '2026-05-24T15:00:00+00:00',
  gmt_offset: '02:00:00',
  ...overrides,
})

const hubDriver = (over: Partial<ChampHubDriver>): ChampHubDriver => ({
  driver_number: 1,
  name_acronym: 'VER',
  full_name: 'Max Verstappen',
  team_name: 'Red Bull',
  team_colour: '3671c6',
  points: 200,
  position: 1,
  wins: 5,
  podiums: 8,
  poles: 4,
  form: [25],
  cumulative: [200],
  teammate_wins: 9,
  teammate_losses: 1,
  ...over,
})

describe('preview lib', () => {
  it('picks the next upcoming meeting', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const meetings = [
      meeting({ meeting_key: 1, date_start: '2026-05-22T00:00:00+00:00' }),
      meeting({ meeting_key: 2, meeting_name: 'Spain', date_start: '2026-06-12T00:00:00+00:00' }),
    ]
    expect(pickPreviewMeeting(meetings, now)?.meeting_key).toBe(1)
  })

  it('returns null when no upcoming meeting exists', () => {
    const now = new Date('2027-01-01T00:00:00Z')
    const meetings = [meeting({ date_start: '2026-05-22T00:00:00+00:00' })]
    expect(pickPreviewMeeting(meetings, now)).toBeNull()
  })

  it('skips cancelled meetings', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const meetings = [meeting({ is_cancelled: true })]
    expect(pickPreviewMeeting(meetings, now)).toBeNull()
  })

  it('matches prior-year meeting by circuit_key', () => {
    const prior = [
      meeting({ meeting_key: 50, year: 2025, circuit_key: 10 }),
      meeting({ meeting_key: 51, year: 2025, circuit_key: 20, meeting_name: 'Spain' }),
    ]
    expect(findPriorYearMeetingByCircuit(prior, 10)?.meeting_key).toBe(50)
    expect(findPriorYearMeetingByCircuit(prior, 99)).toBeNull()
    expect(findPriorYearMeetingByCircuit(prior, undefined)).toBeNull()
  })

  it('finds the grand prix race session', () => {
    const sessions = [
      session({ session_key: 1, session_name: 'FP1', session_type: 'Practice', date_start: '2026-05-22T10:00:00+00:00' }),
      session({ session_key: 2, session_name: 'Sprint', session_type: 'Sprint', date_start: '2026-05-23T10:00:00+00:00' }),
      session({ session_key: 3, session_name: 'Race', session_type: 'Race', date_start: '2026-05-24T13:00:00+00:00' }),
    ]
    expect(findRaceSession(sessions)?.session_key).toBe(3)
  })

  it('detects sprint weekends', () => {
    const sprint = [
      session({ session_type: 'Practice' }),
      session({ session_name: 'Sprint', session_type: 'Sprint' }),
      session({ session_type: 'Race' }),
    ]
    const normal = [session({ session_type: 'Practice' }), session({ session_type: 'Race' })]
    expect(isSprintWeekend(sprint)).toBe(true)
    expect(isSprintWeekend(normal)).toBe(false)
  })

  it('extracts podium and pole', () => {
    const results: EnrichedResult[] = [
      {
        driver_number: 1,
        position: 1,
        name_acronym: 'VER',
        full_name: 'Max Verstappen',
        team_name: 'Red Bull',
        team_colour: '3671c6',
        dnf: false,
        dns: false,
        dsq: false,
        duration: 100,
        gap_to_leader: 0,
        number_of_laps: 78,
        points: 25,
        session_key: 1,
        meeting_key: 1,
      },
      {
        driver_number: 4,
        position: 2,
        name_acronym: 'NOR',
        full_name: 'Lando Norris',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        dnf: false,
        dns: false,
        dsq: false,
        duration: 101,
        gap_to_leader: 1,
        number_of_laps: 78,
        points: 18,
        session_key: 1,
        meeting_key: 1,
      },
      {
        driver_number: 16,
        position: 3,
        name_acronym: 'LEC',
        full_name: 'Charles Leclerc',
        team_name: 'Ferrari',
        team_colour: 'e8002d',
        dnf: false,
        dns: false,
        dsq: false,
        duration: 102,
        gap_to_leader: 2,
        number_of_laps: 78,
        points: 15,
        session_key: 1,
        meeting_key: 1,
      },
    ]

    const grid: EnrichedGrid[] = [
      {
        driver_number: 4,
        position: 1,
        name_acronym: 'NOR',
        full_name: 'Lando Norris',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        session_key: 1,
        meeting_key: 1,
        lap_duration: 70,
      },
    ]

    const podium = extractPodium(results)
    expect(podium.map((p) => p.name_acronym)).toEqual(['VER', 'NOR', 'LEC'])
    expect(extractPole(grid)?.name_acronym).toBe('NOR')
  })

  it('builds title fight gaps for top 3', () => {
    const hub: ChampionshipHub = {
      season: 2026,
      round: 5,
      total_rounds: 24,
      rounds_left: 19,
      last_race: 'Monaco GP',
      round_labels: ['R1'],
      drivers: [
        hubDriver({ points: 200, position: 1 }),
        hubDriver({ driver_number: 4, name_acronym: 'NOR', points: 160, position: 2 }),
        hubDriver({ driver_number: 16, name_acronym: 'LEC', points: 120, position: 3 }),
      ],
      teams: [],
    }

    const rows = buildTitleFightContext(hub)
    expect(rows).toHaveLength(3)
    expect(rows[0].gapToLeader).toBe(0)
    expect(rows[1].gapToLeader).toBe(40)
    expect(rows[1].gapAfterRaceWin).toBe(15)
    expect(rows[2].gapAfterSprintWeekendMax).toBe(200 - (120 + SPRINT_WEEKEND_MAX_POINTS))
    expect(RACE_WIN_POINTS).toBe(25)
  })

  it('formats points gaps', () => {
    expect(formatPointsGap(0)).toBe('LEADER')
    expect(formatPointsGap(40)).toBe('+40')
  })

  it('picks countdown target as next future session', () => {
    const sessions = [
      session({ session_key: 1, session_name: 'FP1', session_type: 'Practice', date_start: '2026-05-22T10:00:00+00:00', date_end: '2026-05-22T11:00:00+00:00' }),
      session({ session_key: 2, session_name: 'Race', session_type: 'Race', date_start: '2026-05-24T13:00:00+00:00', date_end: '2026-05-24T15:00:00+00:00' }),
    ]
    const now = new Date('2026-05-23T12:00:00Z')
    expect(countdownTargetSession(sessions, now)?.session_key).toBe(2)
  })
})
