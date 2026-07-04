import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompareView } from '../components/CompareView'
import type { Driver, EnrichedResult, LapsComparisonResponse } from '../types'
import {
  buildBestLapTraceSeries,
  carDataToTraceSeries,
  comparisonToDeltaSeries,
  defaultCompareDriverNumbers,
  filterCarDataToLap,
  findBestLap,
  formatPitLapsCaption,
  lapsToLapTimes,
} from '../lib/compare'
import { computeCumulativeDeltas } from '../lib/delta'

vi.mock('../api', () => ({
  fetchTelemetry: vi.fn(),
  fetchLapsComparison: vi.fn(),
}))

import { fetchTelemetry, fetchLapsComparison } from '../api'

const mockFetchTelemetry = vi.mocked(fetchTelemetry)
const mockFetchLapsComparison = vi.mocked(fetchLapsComparison)

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
    session_key: 9472,
    meeting_key: 1229,
  },
  {
    driver_number: 44,
    position: 2,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: 5.1,
    number_of_laps: 78,
    points: 18,
    session_key: 9472,
    meeting_key: 1229,
  },
]

const drivers: Driver[] = [
  {
    driver_number: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    first_name: 'Max',
    last_name: 'Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671C6',
    headshot_url: '',
    broadcast_name: 'M VERSTAPPEN',
    session_key: 9472,
    meeting_key: 1229,
  },
  {
    driver_number: 44,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    first_name: 'Lewis',
    last_name: 'Hamilton',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    headshot_url: '',
    broadcast_name: 'L HAMILTON',
    session_key: 9472,
    meeting_key: 1229,
  },
]

const comparison: LapsComparisonResponse = {
  session_key: 9472,
  sc_periods: [],
  pit_laps: { '44': [19, 40] },
  drivers: [
    {
      driver_number: 1,
      name_acronym: 'VER',
      team_colour: '3671C6',
      laps: [
        {
          session_key: 9472,
          driver_number: 1,
          meeting_key: 1229,
          lap_number: 1,
          date_start: '2025-05-25T13:00:00.000Z',
          lap_duration: 92.1,
          is_pit_out_lap: false,
        },
        {
          session_key: 9472,
          driver_number: 1,
          meeting_key: 1229,
          lap_number: 2,
          date_start: '2025-05-25T13:01:32.100Z',
          lap_duration: 90.5,
          is_pit_out_lap: false,
        },
      ],
    },
    {
      driver_number: 44,
      name_acronym: 'HAM',
      team_colour: 'E8002D',
      laps: [
        {
          session_key: 9472,
          driver_number: 44,
          meeting_key: 1229,
          lap_number: 1,
          date_start: '2025-05-25T13:00:01.000Z',
          lap_duration: 93.0,
          is_pit_out_lap: false,
        },
        {
          session_key: 9472,
          driver_number: 44,
          meeting_key: 1229,
          lap_number: 2,
          date_start: '2025-05-25T13:01:34.000Z',
          lap_duration: null,
          is_pit_out_lap: true,
        },
        {
          session_key: 9472,
          driver_number: 44,
          meeting_key: 1229,
          lap_number: 3,
          date_start: '2025-05-25T13:03:10.000Z',
          lap_duration: 91.2,
          is_pit_out_lap: false,
        },
      ],
    },
  ],
}

const nextSessionResults: EnrichedResult[] = [
  {
    driver_number: 16,
    position: 1,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: null,
    number_of_laps: 57,
    points: 25,
    session_key: 9550,
    meeting_key: 1234,
  },
  {
    driver_number: 55,
    position: 2,
    name_acronym: 'SAI',
    full_name: 'Carlos Sainz',
    team_name: 'Williams',
    team_colour: '64C4FF',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: 3.2,
    number_of_laps: 57,
    points: 18,
    session_key: 9550,
    meeting_key: 1234,
  },
]

const nextSessionDrivers: Driver[] = [
  {
    driver_number: 16,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    first_name: 'Charles',
    last_name: 'Leclerc',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    headshot_url: '',
    broadcast_name: 'C LECLERC',
    session_key: 9550,
    meeting_key: 1234,
  },
  {
    driver_number: 55,
    name_acronym: 'SAI',
    full_name: 'Carlos Sainz',
    first_name: 'Carlos',
    last_name: 'Sainz',
    team_name: 'Williams',
    team_colour: '64C4FF',
    headshot_url: '',
    broadcast_name: 'C SAINZ',
    session_key: 9550,
    meeting_key: 1234,
  },
]

function renderCompareView(
  props: {
    sessionKey?: number
    results?: EnrichedResult[]
    drivers?: Driver[]
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CompareView
        sessionKey={props.sessionKey ?? 9472}
        results={props.results ?? results}
        drivers={props.drivers ?? drivers}
      />
    </QueryClientProvider>,
  )
}

describe('compare mapping helpers', () => {
  it('defaults to top two finishers', () => {
    expect(defaultCompareDriverNumbers(results, drivers)).toEqual([1, 44])
  })

  it('maps comparison laps to delta series with null pit laps', () => {
    const series = comparisonToDeltaSeries(comparison, [1, 44], drivers)
    expect(series).toHaveLength(2)
    expect(series[0].label).toBe('VER')
    expect(series[1].lapTimes[1]).toBeNull()

    const deltas = computeCumulativeDeltas(series, 'VER')
    expect(deltas[0].deltas[0]).toBeCloseTo(0.9)
  })

  it('maps car data to trace series', () => {
    const trace = carDataToTraceSeries(
      [
        {
          speed: 300,
          throttle: 100,
          brake: 0,
          date: '',
          driver_number: 1,
          drs: 0,
          meeting_key: 1,
          n_gear: 8,
          rpm: 12000,
          session_key: 1,
        },
      ],
      'VER',
      '#3671C6',
    )
    expect(trace.samples[0]).toEqual({ speed: 300, throttle: 100, brake: 0 })
  })

  it('filters car data to best lap window', () => {
    const best = findBestLap(comparison.drivers[0].laps)
    expect(best?.lap_number).toBe(2)

    const samples = [
      {
        date: '2025-05-25T13:01:32.100Z',
        speed: 280,
        throttle: 90,
        brake: 0,
        driver_number: 1,
        drs: 0,
        meeting_key: 1229,
        n_gear: 7,
        rpm: 11000,
        session_key: 9472,
      },
      {
        date: '2025-05-25T13:00:00.000Z',
        speed: 200,
        throttle: 50,
        brake: 10,
        driver_number: 1,
        drs: 0,
        meeting_key: 1229,
        n_gear: 4,
        rpm: 9000,
        session_key: 9472,
      },
    ]

    const filtered = filterCarDataToLap(samples, best!)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].speed).toBe(280)
  })

  it('builds best-lap trace series from car data and laps', () => {
    const series = buildBestLapTraceSeries(
      [
        {
          date: '2025-05-25T13:01:33.000Z',
          speed: 310,
          throttle: 100,
          brake: 0,
          driver_number: 1,
          drs: 10,
          meeting_key: 1229,
          n_gear: 8,
          rpm: 12000,
          session_key: 9472,
        },
      ],
      comparison.drivers[0].laps,
      'VER',
      '#3671C6',
    )
    expect(series?.samples).toHaveLength(1)
    expect(series?.samples[0].speed).toBe(310)
  })

  it('maps laps to lap time arrays with nulls', () => {
    expect(lapsToLapTimes(comparison.drivers[1].laps)).toEqual([93.0, null, 91.2])
  })

  it('formats pit lap captions', () => {
    expect(formatPitLapsCaption(comparison.pit_laps, [1, 44], comparison, drivers)).toBe(
      'Pit stops — HAM: L19, L40',
    )
  })
})

describe('CompareView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchLapsComparison.mockResolvedValue(comparison)
    mockFetchTelemetry.mockResolvedValue([
      {
        date: '2025-05-25T13:01:33.000Z',
        speed: 310,
        throttle: 100,
        brake: 0,
        driver_number: 1,
        drs: 10,
        meeting_key: 1229,
        n_gear: 8,
        rpm: 12000,
        session_key: 9472,
      },
    ])
  })

  it('renders pickers defaulting to top two finishers', async () => {
    renderCompareView()
    expect(screen.getByTestId('compare-picker-a')).toHaveValue('1')
    expect(screen.getByTestId('compare-picker-b')).toHaveValue('44')
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('HAM').length).toBeGreaterThan(0)
  })

  it('resets the selected pair when the mounted session changes', async () => {
    const { rerender } = renderCompareView()

    fireEvent.change(screen.getByTestId('compare-picker-a'), { target: { value: '44' } })
    expect(screen.getByTestId('compare-picker-a')).toHaveValue('44')

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CompareView
          sessionKey={9550}
          results={nextSessionResults}
          drivers={nextSessionDrivers}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('compare-picker-a')).toHaveValue('16')
      expect(screen.getByTestId('compare-picker-b')).toHaveValue('55')
    })
  })

  it('renders telemetry and pace sections with mocked queries', async () => {
    renderCompareView()

    await waitFor(() => {
      expect(mockFetchLapsComparison).toHaveBeenCalledWith(9472, [1, 44])
    })

    await waitFor(() => {
      expect(screen.getByTestId('telemetry-trace')).toBeInTheDocument()
    })

    expect(screen.getByTestId('delta-time-graph')).toBeInTheDocument()
    expect(screen.getByTestId('compare-pit-caption')).toHaveTextContent('HAM: L19, L40')
  })

  it('shows error state when comparison fetch fails', async () => {
    mockFetchLapsComparison.mockRejectedValue(new Error('comparison unavailable'))
    renderCompareView()

    await waitFor(() => {
      expect(screen.getByText('comparison unavailable')).toBeInTheDocument()
    })
  })

  it('shows empty state when fewer than two drivers', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <CompareView sessionKey={9472} results={[]} drivers={[drivers[0]]} />
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('compare-view-empty')).toBeInTheDocument()
  })
})
