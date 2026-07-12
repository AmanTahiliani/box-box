import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveTimingPage, WEEKEND_CONTEXT_POLL_MS } from '../pages/LiveTimingPage'
import type { LiveStateResponse, LiveStreamData, WeekendContext } from '../types'

vi.mock('../api', () => ({
  fetchLiveState: vi.fn(),
  fetchLiveTrackOutline: vi.fn(),
  fetchWeekendContext: vi.fn(),
}))

import { fetchLiveState, fetchLiveTrackOutline, fetchWeekendContext } from '../api'

const mockFetchLiveState = vi.mocked(fetchLiveState)
const mockFetchLiveTrackOutline = vi.mocked(fetchLiveTrackOutline)
const mockFetchWeekendContext = vi.mocked(fetchWeekendContext)

// A MockEventSource that opens on construct but never emits a snapshot, so the
// initial /api/v1/live/state query drives the rendered phase.
class MockEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    setTimeout(() => this.onopen?.(), 0)
  }
  addEventListener() {}
  close() {}
}

const raceSnapshot: LiveStreamData = {
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
  Tyres: { '1': { Compound: 'HARD', New: false, Age: 12 } },
  Telemetry: {},
  RCMessages: [],
  Weather: { AirTemp: 22, TrackTemp: 41, Humidity: 58, WindSpeed: 3, WindDir: 180, Rainfall: false },
  Session: {
    MeetingName: 'Testonia Grand Prix',
    CircuitName: 'Testring',
    SessionType: 'Race',
    SessionName: 'Race',
    Path: '',
  },
  TeamRadio: [],
  SessionStatus: 'Started',
  TrackStatus: '1',
  CurrentLap: 30,
  TotalLaps: 57,
  Clock: '',
  ClockRefTime: '',
  ClockExtrapolating: false,
  Stints: {},
}

function weekendContext(localAnalysis: string): WeekendContext {
  return {
    temporal_state: 'session_settling',
    focus_meeting: {
      meeting_key: 1,
      meeting_name: 'Testonia Grand Prix',
      meeting_official_name: 'Testonia Grand Prix',
      location: 'Testring',
      country_name: 'Testonia',
      country_code: 'TS',
      country_flag: '',
      circuit_short_name: 'Testring',
      date_start: '2026-07-03T09:00:00Z',
      date_end: '2026-07-05T16:00:00Z',
      year: 2026,
    },
    default_analysis_session: {
      session: {
        session_key: 99,
        session_name: 'Race',
        session_type: 'Race',
        meeting_key: 1,
        date_start: '2026-07-05T14:00:00Z',
        date_end: '2026-07-05T16:00:00Z',
        gmt_offset: '',
      },
      availability: {
        schedule: 'available',
        live_transport: 'unknown',
        live_session: 'inactive',
        archive: 'available',
        local_analysis: localAnalysis,
        freshness: 'fresh',
        limitations: [],
      },
    },
    championship_round: 1,
    total_championship_rounds: 1,
  }
}

function renderPage(
  response: LiveStateResponse,
  context?: WeekendContext,
  options: { setWeekendContext?: boolean } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockFetchLiveState.mockResolvedValue(response)
  mockFetchLiveTrackOutline.mockResolvedValue({
    circuit_key: 1,
    points: [],
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  })
  // Allow callers to pre-configure the weekend-context mock (e.g. pending→complete
  // polling) without this helper overwriting the chain.
  if (options.setWeekendContext !== false) {
    mockFetchWeekendContext.mockResolvedValue(
      context ?? { temporal_state: 'no_season', championship_round: 0, total_championship_rounds: 0 },
    )
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <LiveTimingPage />
    </QueryClientProvider>,
  )
}

describe('LiveTimingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the live timing tower for an active session', async () => {
    renderPage({ is_live: true, data: raceSnapshot })
    expect(await screen.findByText('Timing Tower')).toBeInTheDocument()
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-phase', 'live')
    expect(screen.getByTestId('live-session-flag')).toHaveTextContent('LIVE SESSION')
    expect(screen.getByTestId('live-feed-health')).toBeInTheDocument()
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0)
  })

  it('enters the settling handoff (not archive) when the session ends cleanly', async () => {
    renderPage(
      {
        is_live: false,
        data: null,
        last_snapshot: { ...raceSnapshot, SessionStatus: 'Finished' },
        last_snapshot_at: '2026-07-05T16:02:00Z',
      },
      weekendContext('pending'),
    )

    const settling = await screen.findByTestId('live-settling')
    expect(settling).toBeInTheDocument()
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-phase', 'settling')
    // Canonical default-analysis session drives the primary action target.
    await waitFor(() =>
      expect(screen.getByTestId('live-handoff-analysis')).toHaveAttribute(
        'href',
        '/race-hub?session_key=99',
      ),
    )
    // The timing tower is not shown while settling — it is a handoff surface.
    expect(screen.queryByText('Timing Tower')).not.toBeInTheDocument()
  })

  it('flips settling → analysis-ready when polling sees ingestion complete', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // First fetch: pending. Subsequent polls: complete.
    mockFetchWeekendContext
      .mockResolvedValueOnce(weekendContext('pending'))
      .mockResolvedValue(weekendContext('complete'))

    renderPage(
      {
        is_live: false,
        data: null,
        last_snapshot: { ...raceSnapshot, SessionStatus: 'Finished' },
        last_snapshot_at: '2026-07-05T16:02:00Z',
      },
      undefined,
      { setWeekendContext: false },
    )

    const action = await screen.findByTestId('live-handoff-analysis')
    expect(action).toHaveAttribute('data-ready', 'false')
    expect(action).toHaveTextContent(/analysis will fill in as data ingests/i)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WEEKEND_CONTEXT_POLL_MS + 500)
    })

    await waitFor(() =>
      expect(screen.getByTestId('live-handoff-analysis')).toHaveAttribute('data-ready', 'true'),
    )
    expect(screen.getByTestId('live-handoff-analysis')).toHaveTextContent(
      /full timing, strategy & story ready/i,
    )
  })

  it('retains the last snapshot with a disconnected warning (not settling) on a feed drop', async () => {
    // is_live=false but the retained snapshot has a NON-terminal SessionStatus:
    // the FIA feed dropped while the session was still active.
    renderPage(
      {
        is_live: false,
        data: null,
        last_snapshot: { ...raceSnapshot, SessionStatus: 'Started' },
        last_snapshot_at: '2026-07-05T15:30:00Z',
      },
      weekendContext('pending'),
    )

    expect(await screen.findByTestId('live-disconnected-strip')).toHaveTextContent(
      /showing the last live data/i,
    )
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-phase', 'disconnected')
    // The retained live tower stays visible; we never fell into settling/archive.
    expect(screen.getByText('Timing Tower')).toBeInTheDocument()
    expect(screen.queryByTestId('live-settling')).not.toBeInTheDocument()
    expect(screen.queryByTestId('live-archive-strip')).not.toBeInTheDocument()
  })

  it('keeps the settled snapshot behind an explicit read-only archive action', async () => {
    renderPage(
      {
        is_live: false,
        data: null,
        last_snapshot: { ...raceSnapshot, SessionStatus: 'Finished' },
        last_positions: { '1': { x: 10, y: 20, z: 0, status: 'OnTrack' } },
        last_snapshot_at: '2026-07-05T16:02:00Z',
      },
      weekendContext('complete'),
    )

    // Settling first — the tower is hidden until the user opens the archive.
    await screen.findByTestId('live-settling')
    expect(screen.queryByText('Timing Tower')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('live-handoff-archive'))

    await waitFor(() =>
      expect(screen.getByTestId('live-archive-strip')).toHaveTextContent(/read-only/i),
    )
    expect(screen.getByText('Timing Tower')).toBeInTheDocument()
    // Archive presents its read-only, timestamped chrome — never LIVE.
    expect(screen.getByText('archive')).toBeInTheDocument()
    expect(screen.queryByText('LIVE SESSION')).not.toBeInTheDocument()
  })

  it('shows the inactive weekend context when nothing is live or retained', async () => {
    renderPage(
      { is_live: false, data: null },
      {
        temporal_state: 'between_weekends',
        next_session: {
          session: {
            session_key: 21,
            session_name: 'Practice 1',
            session_type: 'Practice 1',
            meeting_key: 2,
            date_start: '2026-07-17T09:00:00Z',
            date_end: '2026-07-17T10:00:00Z',
            gmt_offset: '',
          },
          availability: {
            schedule: 'available',
            live_transport: 'unknown',
            live_session: 'inactive',
            archive: 'unavailable',
            local_analysis: 'not_applicable',
            freshness: 'fresh',
            limitations: [],
          },
        },
        championship_round: 2,
        total_championship_rounds: 24,
      },
    )

    expect(await screen.findByTestId('live-inactive')).toBeInTheDocument()
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-phase', 'inactive')
    await waitFor(() =>
      expect(screen.getByTestId('live-handoff-next')).toHaveTextContent('Practice 1'),
    )
  })
})
