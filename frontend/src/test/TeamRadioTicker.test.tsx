import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TeamRadioTicker } from '../components/live/TeamRadioTicker'
import { radioClipUrl } from '../lib/radio'
import type { LiveDriverInfo, LiveRadioCapture, LiveSessionMeta } from '../types'

const session: LiveSessionMeta = {
  MeetingName: 'British Grand Prix',
  CircuitName: 'Silverstone',
  SessionType: 'Race',
  SessionName: 'Race',
  Path: '/2026/2026-07-05_British_Grand_Prix/2026-07-05_Race/',
}

const driverInfo: Record<string, LiveDriverInfo> = {
  '4': {
    RacingNumber: '4',
    BroadcastName: 'L NORRIS',
    Tla: 'NOR',
    TeamName: 'McLaren',
    TeamColour: 'ff8000',
    FirstName: 'Lando',
    LastName: 'Norris',
  },
  '16': {
    RacingNumber: '16',
    BroadcastName: 'C LECLERC',
    Tla: 'LEC',
    TeamName: 'Ferrari',
    TeamColour: 'e8002d',
    FirstName: 'Charles',
    LastName: 'Leclerc',
  },
}

const captures: LiveRadioCapture[] = [
  { Utc: '2026-07-05T14:05:00Z', RacingNumber: '16', Path: '/TeamRadio/LEC-1.mp3' },
  { Utc: '2026-07-05T14:07:00Z', RacingNumber: '4', Path: 'TeamRadio/NOR-1.mp3' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('radioClipUrl', () => {
  it('builds static CDN URLs from the session path and capture path', () => {
    expect(radioClipUrl(session, captures[0])).toBe(
      'https://livetiming.formula1.com/static/2026/2026-07-05_British_Grand_Prix/2026-07-05_Race/TeamRadio/LEC-1.mp3',
    )
  })

  it('returns an empty URL without path data', () => {
    expect(radioClipUrl({ ...session, Path: '' }, captures[0])).toBe('')
    expect(radioClipUrl(session, { ...captures[0], Path: '' })).toBe('')
  })
})

describe('TeamRadioTicker', () => {
  it('renders captures newest first with driver labels', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-05T14:10:00Z'))

    render(<TeamRadioTicker captures={captures} driverInfo={driverInfo} session={session} />)

    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('NOR')).toBeInTheDocument()
    expect(screen.getByText('LEC')).toBeInTheDocument()
    expect(screen.getAllByText(/m ago/).map((node) => node.textContent)).toEqual(['3m ago', '5m ago'])
  })

  it('uses one audio element and toggles play/pause per clip', () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    render(<TeamRadioTicker captures={captures} driverInfo={driverInfo} session={session} />)

    fireEvent.click(screen.getByLabelText('Play NOR radio'))
    expect(play).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('audio')).toHaveLength(1)
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(
      'https://livetiming.formula1.com/static/2026/2026-07-05_British_Grand_Prix/2026-07-05_Race/TeamRadio/NOR-1.mp3',
    )

    fireEvent.click(screen.getByLabelText('Pause NOR radio'))
    expect(pause).toHaveBeenCalled()
  })
})
