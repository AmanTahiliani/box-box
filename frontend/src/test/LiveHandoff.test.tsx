import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LiveHandoff, analysisIsReady } from '../components/live/LiveHandoff'
import type { LiveTimingRow } from '../lib/live'
import type { ContextSession, WeekendContext } from '../types'

function session(key: number, name: string, type = name): ContextSession['session'] {
  return {
    session_key: key,
    session_name: name,
    session_type: type,
    meeting_key: 1,
    date_start: '2026-07-05T14:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    gmt_offset: '',
  }
}

function contextSession(
  key: number,
  name: string,
  localAnalysis: string,
): ContextSession {
  return {
    session: session(key, name),
    availability: {
      schedule: 'available',
      live_transport: 'unknown',
      live_session: 'inactive',
      archive: 'unavailable',
      local_analysis: localAnalysis,
      freshness: 'fresh',
      limitations: [],
    },
  }
}

const baseContext: WeekendContext = {
  temporal_state: 'session_settling',
  focus_meeting: {
    meeting_key: 1,
    meeting_name: 'British Grand Prix',
    meeting_official_name: 'British Grand Prix',
    location: 'Silverstone',
    country_name: 'UK',
    country_code: 'GB',
    country_flag: '',
    circuit_short_name: 'Silverstone',
    date_start: '2026-07-03T09:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    year: 2026,
  },
  championship_round: 1,
  total_championship_rounds: 1,
}

const rows: LiveTimingRow[] = [
  { RacingNumber: '1', Position: 1, Driver: { RacingNumber: '1', Position: 1 } as never, Info: { Tla: 'VER' } as never },
  { RacingNumber: '4', Position: 2, Driver: { RacingNumber: '4', Position: 2 } as never, Info: { Tla: 'NOR' } as never },
]

describe('analysisIsReady', () => {
  it('is true only when local analysis is complete', () => {
    expect(analysisIsReady(contextSession(11, 'Race', 'complete'))).toBe(true)
    expect(analysisIsReady(contextSession(11, 'Race', 'pending'))).toBe(false)
    expect(analysisIsReady(contextSession(11, 'Race', 'partial'))).toBe(false)
    expect(analysisIsReady(undefined)).toBe(false)
  })
})

describe('LiveHandoff settling', () => {
  it('shows SESSION SETTLING with a pending analysis action while ingesting', () => {
    render(
      <LiveHandoff
        phase="settling"
        transport="connected"
        context={{ ...baseContext, default_analysis_session: contextSession(11, 'Race', 'pending') }}
        rows={rows}
        capturedAt="2026-07-05T16:02:00Z"
        hasArchive
        onViewArchive={vi.fn()}
      />,
    )

    expect(screen.getByTestId('live-settling')).toBeInTheDocument()
    expect(screen.getByText('SESSION SETTLING')).toBeInTheDocument()
    expect(screen.getByTestId('live-handoff-captured')).toHaveTextContent('Final feed snapshot captured')
    const action = screen.getByTestId('live-handoff-analysis')
    expect(action).toHaveAttribute('href', '/race-hub?session_key=11')
    expect(action).toHaveAttribute('data-ready', 'false')
    expect(action).toHaveTextContent('Open Race analysis')
    expect(action).toHaveTextContent(/analysis will fill in as data ingests/i)
    // Provisional final order from the retained snapshot.
    expect(screen.getByTestId('live-handoff-snapshot')).toHaveTextContent('VER')
  })

  it('flips to analysis-ready once local ingestion completes', () => {
    render(
      <LiveHandoff
        phase="settling"
        transport="connected"
        context={{ ...baseContext, default_analysis_session: contextSession(11, 'Race', 'complete') }}
        rows={rows}
        capturedAt="2026-07-05T16:02:00Z"
        hasArchive={false}
        onViewArchive={vi.fn()}
      />,
    )
    const action = screen.getByTestId('live-handoff-analysis')
    expect(action).toHaveAttribute('data-ready', 'true')
    expect(action).toHaveTextContent(/full timing, strategy & story ready/i)
  })

  it('never renders live/connected chrome or a countdown in settling', () => {
    const { container } = render(
      <LiveHandoff
        phase="settling"
        transport="connected"
        context={{ ...baseContext, default_analysis_session: contextSession(11, 'Race', 'complete') }}
        rows={rows}
        capturedAt="2026-07-05T16:02:00Z"
        hasArchive
        onViewArchive={vi.fn()}
      />,
    )
    expect(screen.queryByText('LIVE SESSION')).not.toBeInTheDocument()
    expect(screen.queryByTestId('live-clock')).not.toBeInTheDocument()
    expect(container.querySelector('.live-session-flag-live')).toBeNull()
  })

  it('uses non-settling readiness copy when inactive and analysis is still ingesting', () => {
    render(
      <LiveHandoff
        phase="inactive"
        transport="connected"
        context={{ ...baseContext, default_analysis_session: contextSession(11, 'Race', 'pending') }}
        rows={[]}
        hasArchive={false}
        onViewArchive={vi.fn()}
      />,
    )
    const action = screen.getByTestId('live-handoff-analysis')
    expect(action).toHaveAttribute('data-ready', 'false')
    expect(action).toHaveTextContent(/analysis will fill in as data ingests/i)
    expect(action).not.toHaveTextContent(/^Settling/i)
  })
})

describe('LiveHandoff inactive', () => {
  it('uses shared next + recap context instead of a telemetry-offline dead end', () => {
    render(
      <LiveHandoff
        phase="inactive"
        transport="connected"
        context={{
          ...baseContext,
          temporal_state: 'between_sessions',
          default_analysis_session: contextSession(11, 'Practice 1', 'complete'),
          next_session: contextSession(12, 'Qualifying', 'not_applicable'),
          previous_completed_session: contextSession(10, 'Practice 2', 'complete'),
        }}
        rows={[]}
        hasArchive={false}
        onViewArchive={vi.fn()}
      />,
    )
    expect(screen.getByTestId('live-inactive')).toBeInTheDocument()
    expect(screen.getByText('NO LIVE SESSION')).toBeInTheDocument()
    expect(screen.getByTestId('live-handoff-next')).toHaveTextContent('Qualifying')
    expect(screen.getByTestId('live-handoff-recap')).toHaveTextContent('Practice 2')
    // No provisional-order snapshot when inactive.
    expect(screen.queryByTestId('live-handoff-snapshot')).not.toBeInTheDocument()
  })

  it('does not duplicate the recap card when previous equals the analysis target', () => {
    render(
      <LiveHandoff
        phase="inactive"
        transport="connected"
        context={{
          ...baseContext,
          default_analysis_session: contextSession(11, 'Race', 'complete'),
          previous_completed_session: contextSession(11, 'Race', 'complete'),
        }}
        rows={[]}
        hasArchive={false}
        onViewArchive={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('live-handoff-recap')).not.toBeInTheDocument()
  })

  it('falls back to Weekend when the context has nothing to offer', () => {
    render(
      <LiveHandoff
        phase="inactive"
        transport="error"
        context={{ temporal_state: 'no_season', championship_round: 0, total_championship_rounds: 0 }}
        rows={[]}
        hasArchive={false}
        onViewArchive={vi.fn()}
      />,
    )
    expect(screen.getByTestId('live-handoff-fallback')).toHaveTextContent('Weekend')
  })
})
