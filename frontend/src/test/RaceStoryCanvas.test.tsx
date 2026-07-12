import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RaceStoryCanvas } from '../components/RaceStoryCanvas'
import type { Chapter, RaceHub, ReplayFramesResponse, TrackOutline } from '../types'

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
  frames: [
    { t: 0, cars: { '1': { x: 10, y: 20 } } },
    { t: 5000, cars: { '1': { x: 50, y: 50 } } },
  ],
}

const chapters: Chapter[] = [
  {
    kind: 'start',
    title: 'Start',
    headline: 'Lights out',
    start_lap: 1,
    end_lap: 1,
    start_time: '2025-05-25T13:00:00Z',
    end_time: '2025-05-25T13:01:00Z',
    driver_numbers: [],
  },
  {
    kind: 'safety_car',
    title: 'Safety Car',
    headline: 'Incident brings out the Safety Car',
    start_lap: 2,
    end_lap: 2,
    start_time: '2025-05-25T13:05:00Z',
    end_time: '2025-05-25T13:05:00Z',
    driver_numbers: [],
  },
]

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
  chapters,
}

function renderCanvas(overrides: Partial<RaceHub> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RaceStoryCanvas data={{ ...raceHub, ...overrides }} />
    </QueryClientProvider>,
  )
}

describe('RaceStoryCanvas replay map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchReplayFrames.mockResolvedValue(replay)
    mockFetchTrackOutline.mockResolvedValue(outline)
  })

  it('probes replay frames on mount and opens the map when data is available', async () => {
    renderCanvas()

    await waitFor(() => expect(mockFetchReplayFrames).toHaveBeenCalledWith(99, 5000))
    expect(mockFetchTrackOutline).toHaveBeenCalledWith(1, 2025)

    const mapToggle = await screen.findByTestId('replay-map-toggle')
    fireEvent.click(mapToggle)

    expect(await screen.findByTestId('replay-track-map')).toBeInTheDocument()
    expect(screen.getByTestId('replay-map-slot')).toBeInTheDocument()
  })

  it('hides the map toggle when replay frames are unavailable', async () => {
    mockFetchReplayFrames.mockResolvedValue({ ...replay, frames: [] })
    renderCanvas()

    await waitFor(() => expect(mockFetchReplayFrames).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('replay-map-toggle')).not.toBeInTheDocument())
  })

  it('uses full-width chart layout when the map is closed', async () => {
    renderCanvas()

    await waitFor(() => expect(mockFetchReplayFrames).toHaveBeenCalled())
    const chart = screen.getByTestId('position-chart')
    expect(chart).toHaveClass('rs-chart-container--full')
    expect(screen.queryByTestId('replay-map-slot')).not.toBeInTheDocument()
    expect(document.querySelector('.rs-replay-shell--split')).not.toBeInTheDocument()
  })

  it('uses lap timing rather than pre-race position samples for the chart scale', () => {
    const laps = Array.from({ length: 20 }, (_, index) => ({
      session_key: 99,
      driver_number: 1,
      meeting_key: 1,
      lap_number: index + 1,
      date_start: `2025-05-25T13:${String(index).padStart(2, '0')}:00Z`,
      lap_duration: 60,
      is_pit_out_lap: false,
    }))

    renderCanvas({
      results: [{ ...raceHub.results[0], number_of_laps: 20 }],
      laps,
      positions: [
        { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T12:00:00Z', position: 1 },
        { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T13:20:00Z', position: 1 },
      ],
    })

    // L10 is the end of the tenth 60s lap, exactly halfway through the race.
    const lapTenLabel = screen.getByText('L10')
    expect(lapTenLabel.previousElementSibling).toHaveAttribute('x1', '316')
    // The pre-race position is retained as the starting grid at the left edge.
    expect(document.querySelector('.rs-driver-line')).toHaveAttribute('points', '40,8 592,8 592,8')
  })

  it('maps cursor positions from rendered pixels to the SVG viewBox', () => {
    renderCanvas()

    const svg = document.querySelector('.rs-position-chart-svg')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 360,
      top: 0,
      right: 1280,
      bottom: 360,
      left: 0,
      toJSON: () => ({}),
    })

    const pointerMove = new Event('pointermove', { bubbles: true })
    Object.defineProperty(pointerMove, 'clientX', { value: 640 })
    fireEvent(screen.getByTestId('position-chart-interaction'), pointerMove)

    // 640px is the middle of a 1280px rendered chart, which is x=320 in its 640-unit viewBox.
    expect(document.querySelector('.rs-playhead')).toHaveAttribute('x1', '320')
  })

  it('syncs active chapter highlight when a chapter card is clicked', async () => {
    renderCanvas()

    fireEvent.click(screen.getByTestId('chapter-card-1'))
    await waitFor(() => expect(screen.getByTestId('chapter-card-1')).toHaveClass('active'))
    expect(screen.getByTestId('chapter-card-0')).not.toHaveClass('active')
  })

  it('highlights out-of-window chapters after click (clamped scrub + selection)', async () => {
    // Position samples start at 13:05; start chapter ends at 13:01 — outside the window.
    renderCanvas({
      positions: [
        { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T13:05:00Z', position: 1 },
        { session_key: 99, driver_number: 1, meeting_key: 1, date: '2025-05-25T13:10:00Z', position: 1 },
      ],
      chapters: [
        {
          kind: 'start',
          title: 'Start',
          headline: 'Lights out before samples',
          start_lap: 1,
          end_lap: 1,
          start_time: '2025-05-25T13:00:00Z',
          end_time: '2025-05-25T13:01:00Z',
          driver_numbers: [],
        },
        {
          kind: 'finish',
          title: 'Finish',
          headline: 'Flag after samples',
          start_lap: 78,
          end_lap: 78,
          start_time: '2025-05-25T13:20:00Z',
          end_time: '2025-05-25T13:21:00Z',
          driver_numbers: [],
        },
      ],
    })

    fireEvent.click(screen.getByTestId('chapter-card-0'))
    await waitFor(() => expect(screen.getByTestId('chapter-card-0')).toHaveClass('active'))
    expect(screen.getByTestId('chapter-card-1')).not.toHaveClass('active')

    fireEvent.click(screen.getByTestId('chapter-card-1'))
    await waitFor(() => expect(screen.getByTestId('chapter-card-1')).toHaveClass('active'))
    expect(screen.getByTestId('chapter-card-0')).not.toHaveClass('active')
  })

  it('renders the empty-state card when positions are unavailable', () => {
    renderCanvas({
      datasets: { positions: { status: 'missing', source: 'local', count: 0 } },
      positions: [],
      chapters: [],
    })

    expect(screen.getByTestId('race-story-no-positions')).toBeInTheDocument()
    expect(screen.getByText('Lap-by-lap positions not available')).toBeInTheDocument()
  })
})
