import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import type { EnrichedResult, LiveStreamData, Meeting, WeekendSession } from '../types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string
    children: ReactNode
    className?: string
    'data-testid'?: string
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

import { CommandCenterHero } from '../components/CommandCenterHero'

const focusMeeting: Meeting = {
  meeting_key: 1229,
  meeting_name: 'Monaco',
  meeting_official_name: 'FORMULA 1 GRAND PRIX DE MONACO 2025',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_short_name: 'Monaco',
  date_start: '2025-05-23T00:00:00+00:00',
  date_end: '2025-05-25T00:00:00+00:00',
  year: 2025,
}

const weekendSessions: WeekendSession[] = [
  {
    session: {
      session_key: 9472,
      session_name: 'Race',
      session_type: 'Race',
      meeting_key: 1229,
      date_start: '2025-05-25T13:00:00+00:00',
      date_end: '2025-05-25T15:00:00+00:00',
      gmt_offset: '02:00:00',
    },
    source: 'local',
    datasets: {} as WeekendSession['datasets'],
  },
]

const liveData: LiveStreamData = {
  Drivers: {
    '1': {
      RacingNumber: '1',
      Position: 1,
      PrevPosition: 1,
      GapToLeader: '',
      Interval: '',
      LastLapTime: '1:14.000',
      LastLapPB: false,
      LastLapOB: false,
      BestLapTime: '1:13.500',
      BestLapPB: false,
      BestLapOB: false,
      BestLapNum: 10,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 10,
      SpeedTrap: '',
      Sectors: [],
    },
    '44': {
      RacingNumber: '44',
      Position: 2,
      PrevPosition: 2,
      GapToLeader: '+1.2',
      Interval: '+1.2',
      LastLapTime: '1:14.200',
      LastLapPB: false,
      LastLapOB: false,
      BestLapTime: '1:13.700',
      BestLapPB: false,
      BestLapOB: false,
      BestLapNum: 10,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 10,
      SpeedTrap: '',
      Sectors: [],
    },
  },
  DriverInfo: {
    '1': {
      RacingNumber: '1',
      BroadcastName: 'M VERSTAPPEN',
      Tla: 'VER',
      TeamName: 'Red Bull Racing',
      TeamColour: '3671c6',
      FirstName: 'Max',
      LastName: 'Verstappen',
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
  Tyres: {},
  RCMessages: [],
  Weather: {
    AirTemp: 20,
    TrackTemp: 30,
    Humidity: 50,
    WindSpeed: 1,
    WindDir: 0,
    Rainfall: false,
  },
  Session: {
    MeetingName: 'Monaco',
    CircuitName: 'Monaco',
    SessionType: 'Race',
    SessionName: 'Race',
  },
  TrackStatus: '1',
  CurrentLap: 10,
  TotalLaps: 78,
  Clock: '',
  ClockRefTime: '',
  ClockExtrapolating: false,
  Stints: {},
}

const podium: EnrichedResult[] = [
  {
    driver_number: 1,
    position: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671c6',
    dnf: false,
    dns: false,
    dsq: false,
    duration: 7200,
    gap_to_leader: null,
    number_of_laps: 78,
    points: 25,
    session_key: 9472,
    meeting_key: 1229,
  },
  {
    driver_number: 44,
    position: 2,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    dnf: false,
    dns: false,
    dsq: false,
    duration: 7205,
    gap_to_leader: 3.2,
    number_of_laps: 78,
    points: 18,
    session_key: 9472,
    meeting_key: 1229,
  },
]

function renderHero(overrides: Partial<ComponentProps<typeof CommandCenterHero>> = {}) {
  const props: ComponentProps<typeof CommandCenterHero> = {
    state: 'upcoming',
    now: new Date('2025-05-24T12:00:00Z'),
    accent: '#d61a3e',
    liveActive: false,
    liveData: null,
    focusMeeting,
    focusKind: 'current',
    sessions: weekendSessions,
    currentSession: null,
    nextSession: weekendSessions[0].session,
    lastRaceName: '',
    lastRacePodium: [],
    nextMeeting: null,
    ...overrides,
  }

  return render(<CommandCenterHero {...props} />)
}

describe('CommandCenterHero', () => {
  it('renders live timing link and top three in live state', () => {
    renderHero({
      state: 'live',
      liveActive: true,
      liveData,
      currentSession: weekendSessions[0].session,
    })

    expect(screen.getByTestId('hero-live-link')).toHaveAttribute('href', '/live')
    expect(screen.getByTestId('hero-live-timing')).toHaveTextContent('VER')
    expect(screen.getByTestId('hero-live-timing')).toHaveTextContent('HAM')
    expect(screen.getByText('TRACK CLEAR')).toBeInTheDocument()
  })

  it('renders countdown and schedule strip in upcoming state', () => {
    renderHero({
      state: 'upcoming',
      nextSession: weekendSessions[0].session,
    })

    expect(screen.getByTestId('hero-countdown')).toHaveTextContent('1d 01h 00m 00s')
    expect(screen.getByTestId('hero-schedule-strip')).toHaveTextContent('Race')
    expect(screen.getByTestId('hero-schedule-strip')).toHaveTextContent('Next')
  })

  it('renders last race podium and next GP countdown in between state', () => {
    const nextMeeting: Meeting = {
      ...focusMeeting,
      meeting_key: 1301,
      meeting_name: 'Canada',
      country_code: 'CAN',
      date_start: '2025-06-06T00:00:00+00:00',
      date_end: '2025-06-08T00:00:00+00:00',
    }

    renderHero({
      state: 'between',
      lastRaceName: 'Monaco',
      lastRacePodium: podium,
      nextMeeting,
      now: new Date('2025-06-01T12:00:00Z'),
    })

    expect(screen.getByTestId('hero-last-race')).toHaveTextContent('After Monaco')
    expect(screen.getByTestId('hero-podium')).toHaveTextContent('VER')
    expect(screen.getByTestId('hero-podium')).toHaveTextContent('HAM')
    expect(screen.getByTestId('hero-next-gp-countdown')).toHaveTextContent('Canada')
    expect(screen.getByTestId('hero-next-gp-countdown')).toHaveTextContent('4d')
  })
})
