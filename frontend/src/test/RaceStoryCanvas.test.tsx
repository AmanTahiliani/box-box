import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RaceStoryCanvas } from '../components/RaceStoryCanvas'
import type { RaceHub, ReplayFramesResponse, TrackOutline } from '../types'

vi.mock('../api', () => ({
  fetchReplayFrames: vi.fn(),
  fetchTrackOutline: vi.fn(),
}))

import { fetchReplayFrames, fetchTrackOutline } from '../api'

const mockFetchReplayFrames = vi.mocked(fetchReplayFrames)
const mockFetchTrackOutline = vi.mocked(fetchTrackOutline)

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
  frames: [{ t: 0, cars: { '1': { x: 10, y: 20 } } }],
}

const raceHub: RaceHub = {
  source: 'local',
  session_key: 99,
  datasets: {
    positions: { status: 'available', source: 'local', count: 2 },
  },
  meeting: {
    meeting_key: 1,
    meeting_name: 'Monaco Grand Prix',
    meeting_official_name: 'FORMULA 1 GRAND PRIX DE MONACO 2025',
    location: 'Monaco',
    country_name: 'Monaco',
    country_code: 'MON',
    country_flag: '',
    circuit_key: 1,
    circuit_short_name: 'Monaco',
    date_start: '2025-05-23T00:00:00Z',
    date_end: '2025-05-25T00:00:00Z',
    year: 2025,
  },
  session: {
    session_key: 99,
    session_name: 'Race',
    session_type: 'Race',
    circuit_key: 1,
    meeting_key: 1,
    date_start: '2025-05-25T13:00:00Z',
    date_end: '2025-05-25T15:00:00Z',
    gmt_offset: '02:00:00',
  },
  drivers: [],
  results: [
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
  ],
  starting_grid: [
    {
      driver_number: 1,
      position: 1,
      name_acronym: 'VER',
      full_name: 'Max Verstappen',
      team_name: 'Red Bull Racing',
      team_colour: '3671C6',
      session_key: 99,
      meeting_key: 1,
      lap_duration: null,
    },
  ],
  stints: [],
  pit_stops: [],
  positions: [
    { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T13:00:00Z', position: 1 },
    { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T13:05:00Z', position: 1 },
  ],
  race_control: [],
  weather: [],
  laps: [],
  chapters: [],
}

function renderCanvas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RaceStoryCanvas data={raceHub} />
    </QueryClientProvider>,
  )
}

describe('RaceStoryCanvas replay map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchReplayFrames.mockResolvedValue(replay)
    mockFetchTrackOutline.mockResolvedValue(outline)
  })

  it('fetches replay frames lazily when the map panel opens', async () => {
    renderCanvas()

    expect(mockFetchReplayFrames).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))

    await waitFor(() => expect(mockFetchReplayFrames).toHaveBeenCalledWith(99, 5000))
    expect(mockFetchTrackOutline).toHaveBeenCalledWith(1, 2025)
    expect(await screen.findByTestId('replay-track-map')).toBeInTheDocument()
  })
})
