import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionBanner } from '../components/live/SessionBanner'
import type { LiveStreamData } from '../types'

function makeSnapshot(sessionType: string, sessionName: string): LiveStreamData {
  return {
    Drivers: {},
    DriverInfo: {},
    Tyres: {},
    RCMessages: [],
    Weather: { AirTemp: 0, TrackTemp: 0, Humidity: 0, WindSpeed: 0, WindDir: 0, Rainfall: false },
    Session: {
      MeetingName: 'Belgian Grand Prix',
      CircuitName: 'Spa-Francorchamps',
      SessionType: sessionType,
      SessionName: sessionName,
      Path: '',
    },
    TeamRadio: [],
    TrackStatus: '1',
    CurrentLap: 0,
    TotalLaps: 0,
    Clock: '00:45:00',
    ClockRefTime: '',
    ClockExtrapolating: false,
    Stints: {},
  }
}

describe('SessionBanner', () => {
  it('never renders a race lap counter for a practice session', () => {
    render(
      <SessionBanner
        isLive
        snapshot={makeSnapshot('Practice', 'Practice 2')}
        rows={[]}
        connection="connected"
        now={0}
      />,
    )
    expect(screen.queryByTestId('live-lap-counter')).not.toBeInTheDocument()
    // Session identity and clock stay intact.
    expect(screen.getByText('Belgian Grand Prix')).toBeInTheDocument()
    expect(screen.getByTestId('live-clock')).toHaveTextContent('00:45:00')
  })

  it('shows the lap counter for a race session', () => {
    const snapshot = { ...makeSnapshot('Race', 'Race'), CurrentLap: 12, TotalLaps: 44 }
    render(
      <SessionBanner
        isLive
        snapshot={snapshot}
        rows={[]}
        connection="connected"
        now={0}
      />,
    )
    expect(screen.getByTestId('live-lap-counter')).toHaveTextContent('L12/44')
  })
})
