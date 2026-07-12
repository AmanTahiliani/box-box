import type { Session } from '../types'
import { RACE_HUB_DATASETS } from '../lib/coverage'
import { formatCountdown, formatSessionScheduleTime, sessionStartTime } from '../lib/schedule'
import {
  sessionStateDescription,
  type SessionState,
} from '../lib/sessionState'

const EXPECTED_LABELS: Record<string, string> = {
  results: 'Final results',
  starting_grid: 'Starting grid',
  stints: 'Tyre strategy',
  pit_stops: 'Pit stops',
  positions: 'Position changes',
  laps: 'Lap times',
  race_control: 'Race control',
  weather: 'Track conditions',
}

interface PreSessionProps {
  session: Session
  sessionName: string
  now: Date
}

/**
 * Purpose-built view for a session that has not run yet. Instead of rendering
 * empty Winner / Podium / Pole / Strategy / Compare cards, it explains that the
 * session is upcoming and previews the analysis that will appear once the data
 * is ingested.
 */
export function PreSessionView({ session, sessionName, now }: PreSessionProps) {
  const start = sessionStartTime(session)
  const expected = RACE_HUB_DATASETS.filter((key) => EXPECTED_LABELS[key])

  return (
    <div className="rh-presession" data-testid="rh-presession">
      <section className="rh-presession-band">
        <span className="rh-presession-eyebrow mono">Upcoming session</span>
        <h2 className="rh-presession-title">{sessionName}</h2>
        <p className="rh-presession-sub">
          This session hasn’t run yet, so there’s no result to analyse. Winner,
          podium, pole, strategy and comparison views will appear here once the
          session completes and its data is ingested.
        </p>
        <div className="rh-presession-countdown mono" data-testid="rh-presession-countdown">
          {start
            ? `Starts ${formatSessionScheduleTime(session.date_start)} · in ${formatCountdown(start, now)}`
            : 'Start time to be confirmed.'}
        </div>
      </section>

      <div className="data-section">
        <div className="sec-header">
          <span className="sec-title">Expected once complete</span>
        </div>
        <div className="rh-expected-grid">
          {expected.map((key) => (
            <div key={key} className="rh-expected-card">
              <span className="rh-expected-dot" aria-hidden="true" />
              <span>{EXPECTED_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PhaseProps {
  state: Extract<SessionState, 'preparing' | 'unavailable' | 'cancelled'>
  sessionName: string
  onOpenDiagnostics?: () => void
}

/**
 * Distinct fan-facing surfaces for settling/preparing and unavailable sessions.
 * Genuine request failures stay on the page-level error recovery path.
 */
export function SessionPhaseView({ state, sessionName, onOpenDiagnostics }: PhaseProps) {
  const title =
    state === 'preparing'
      ? 'Analysis preparing'
      : state === 'cancelled'
        ? 'Session cancelled'
        : 'Analysis unavailable'

  const testId =
    state === 'preparing'
      ? 'rh-preparing'
      : state === 'cancelled'
        ? 'rh-cancelled'
        : 'rh-unavailable'

  return (
    <div className="rh-presession" data-testid={testId}>
      <section className="rh-presession-band">
        <span className="rh-presession-eyebrow mono">{sessionStateLabelEyebrow(state)}</span>
        <h2 className="rh-presession-title">{title}</h2>
        <p className="rh-presession-sub">
          {sessionName}: {sessionStateDescription(state)}
        </p>
        {state === 'preparing' && (
          <p className="rh-presession-sub">
            Check back shortly, or open Diagnostics if you need raw dataset coverage.
          </p>
        )}
        {onOpenDiagnostics && (state === 'preparing' || state === 'unavailable') && (
          <div className="rh-empty-actions" style={{ marginTop: 'var(--s4)' }}>
            <button type="button" className="rh-empty-action" onClick={onOpenDiagnostics}>
              Open Diagnostics
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function sessionStateLabelEyebrow(state: PhaseProps['state']): string {
  if (state === 'preparing') return 'Settling'
  if (state === 'cancelled') return 'Cancelled'
  return 'Unavailable'
}

interface PartialBannerProps {
  onOpenDiagnostics?: () => void
}

export function PartialAnalysisBanner({ onOpenDiagnostics }: PartialBannerProps) {
  return (
    <div className="rh-partial-banner" data-testid="rh-partial-banner" role="status">
      <span>Partial analysis — some datasets are still missing.</span>
      {onOpenDiagnostics && (
        <button type="button" className="rh-partial-banner-link" onClick={onOpenDiagnostics}>
          Diagnostics
        </button>
      )}
    </div>
  )
}
