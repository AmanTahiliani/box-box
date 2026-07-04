import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveTimingPage } from '../pages/LiveTimingPage'
import type { LiveStateResponse, LiveStreamData } from '../types'

vi.mock('../api', () => ({
  fetchLiveState: vi.fn(),
  fetchLiveTrackOutline: vi.fn(),
}))

import { fetchLiveState, fetchLiveTrackOutline } from '../api'

const mockFetchLiveState = vi.mocked(fetchLiveState)
const mockFetchLiveTrackOutline = vi.mocked(fetchLiveTrackOutline)

class MockEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    setTimeout(() => this.onopen?.(), 0)
  }

  addEventListener() {}
  close() {}
}

const archivedSnapshot: LiveStreamData = {
  Drivers: {
    '1': {
      RacingNumber: '1',
      Position: 1,
      PrevPosition: 1,
      GapToLeader: '',
      Interval: '',
      LastLapTime: '1:21.345',
      LastLapPB: false,
      LastLapOB: false,
      BestLapTime: '1:20.987',
      BestLapPB: false,
      BestLapOB: false,
      BestLapNum: 22,
      InPit: false,
      PitOut: false,
      Retired: false,
      KnockedOut: false,
      Cutoff: false,
      OnFlyingLap: false,
      NumberOfLaps: 30,
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
      TeamColour: '3671C6',
      FirstName: 'Max',
      LastName: 'Verstappen',
    },
  },
  Tyres: {
    '1': { Compound: 'HARD', New: false, Age: 12 },
  },
  Telemetry: {},
  RCMessages: [],
  Weather: {
    AirTemp: 22,
    TrackTemp: 41,
    Humidity: 58,
    WindSpeed: 3,
    WindDir: 180,
    Rainfall: false,
  },
  Session: {
    MeetingName: 'Testonia Grand Prix',
    CircuitName: 'Testring',
    SessionType: 'Race',
    SessionName: 'Race',
    Path: '',
  },
  TeamRadio: [],
  SessionStatus: 'Finished',
  TrackStatus: '1',
  CurrentLap: 57,
  TotalLaps: 57,
  Clock: '',
  ClockRefTime: '',
  ClockExtrapolating: false,
  Stints: {},
}

function renderPage(response: LiveStateResponse) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mockFetchLiveState.mockResolvedValue(response)
  mockFetchLiveTrackOutline.mockResolvedValue({
    circuit_key: 1,
    points: [],
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LiveTimingPage />
    </QueryClientProvider>,
  )
}

describe('LiveTimingPage archive mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
      configurable: true,
    })
  })

  it('keeps archived snapshots behind the View Last Session action', async () => {
    renderPage({
      is_live: false,
      data: null,
      last_snapshot: archivedSnapshot,
      last_positions: {
        '1': { x: 10, y: 20, z: 0, status: 'OnTrack' },
      },
      last_snapshot_at: '2026-07-04T14:00:00Z',
    })

    expect(await screen.findByTestId('live-empty')).toHaveTextContent('No live session active')
    expect(screen.queryByText('Timing Tower')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /view last session/i }))

    await waitFor(() => {
      expect(screen.getByTestId('live-archive-strip')).toHaveTextContent('Archived snapshot')
    })
    expect(screen.getByText('Timing Tower')).toBeInTheDocument()
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0)
    expect(screen.getByText('archive')).toBeInTheDocument()
  })

  it('does not show the archive action when no snapshot is retained', async () => {
    renderPage({ is_live: false, data: null })

    expect(await screen.findByTestId('live-empty')).toHaveTextContent('No live session active')
    expect(screen.queryByRole('button', { name: /view last session/i })).not.toBeInTheDocument()
  })
})
