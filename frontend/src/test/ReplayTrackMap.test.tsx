import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReplayTrackMap } from '../components/ReplayTrackMap'
import type { EnrichedResult, ReplayFramesResponse, TrackOutline } from '../types'

const outline: TrackOutline = {
  circuit_key: 1,
  bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
}

const replay: ReplayFramesResponse = {
  session_key: 99,
  interval_ms: 5000,
  start_time: '2025-05-25T13:00:00Z',
  frames: [
    { t: 0, cars: { '1': { x: 0, y: 0 } } },
    { t: 5000, cars: { '1': { x: 50, y: 50 } } },
  ],
}

const results: EnrichedResult[] = [
  {
    driver_number: 1,
    position: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671C6',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: null,
    number_of_laps: 78,
    points: 25,
    session_key: 99,
    meeting_key: 1,
  },
]

describe('ReplayTrackMap', () => {
  it('renders an empty state when replay frames are missing', () => {
    render(<ReplayTrackMap outline={outline} replay={{ ...replay, frames: [] }} tMs={0} drivers={[]} results={results} />)
    expect(screen.getByTestId('replay-track-map')).toHaveTextContent(/historical GPS unavailable/i)
  })

  it('renders car labels from result metadata', () => {
    render(<ReplayTrackMap outline={outline} replay={replay} tMs={2500} drivers={[]} results={results} />)
    expect(screen.getByLabelText(/VER replay position/i)).toBeInTheDocument()
  })
})
