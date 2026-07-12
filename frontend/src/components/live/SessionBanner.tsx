import type { LiveStreamData } from '../../types'
import type { LiveTimingRow } from '../../lib/live'
import { extrapolateClock, liveSessionDisplay } from '../../lib/live'
import type { LivePhase, TransportHealth } from '../../lib/liveState'
import { feedHealthLabel } from '../../lib/liveState'
import { WeatherStrip } from './WeatherStrip'

interface Props {
  /** Which of the live phases we are rendering: 'live' | 'disconnected' | 'archive'. */
  phase: LivePhase
  snapshot: LiveStreamData
  rows: LiveTimingRow[]
  transport: TransportHealth
  now: number
  /** ISO capture time — required for archive, shown as the timestamp of record. */
  capturedAt?: string | null
}

function formatCapturedAt(capturedAt: string | null | undefined): string {
  if (!capturedAt) return ''
  const date = new Date(capturedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

export function SessionBanner({ phase, snapshot, rows, transport, now, capturedAt }: Props) {
  const session = snapshot.Session
  const isArchive = phase === 'archive'
  const isLiveSession = phase === 'live' || phase === 'disconnected'
  // Archive is a frozen single frame: never extrapolate a running clock for it.
  const clock = isArchive
    ? ''
    : extrapolateClock(snapshot.Clock, snapshot.ClockRefTime, snapshot.ClockExtrapolating, now)
  const display = liveSessionDisplay(session, rows)
  const atRiskLabel =
    display.atRiskStart && display.atRiskEnd ? `P${display.atRiskStart}-P${display.atRiskEnd} at risk` : ''
  const capturedLabel = formatCapturedAt(capturedAt)

  return (
    <section className={`live-banner${isArchive ? ' live-banner-archive' : ''}`} data-testid="live-banner">
      <div className="live-banner-row">
        <div className="live-banner-main">
          {isArchive ? (
            <span className="live-session-flag live-session-flag-archive" data-testid="live-archive-flag">
              ARCHIVE
            </span>
          ) : (
            <span
              className={`live-session-flag live-session-flag-live${
                phase === 'disconnected' ? ' is-stale' : ''
              }`}
              data-testid="live-session-flag"
            >
              <span className="live-session-dot" aria-hidden="true" />
              LIVE SESSION
            </span>
          )}
          <div>
            <h1>{session?.MeetingName || 'Live Timing'}</h1>
            <p>
              {[session?.SessionName, session?.CircuitName].filter(Boolean).join(' · ') || 'F1 live feed'}
            </p>
          </div>
        </div>
        <div className="live-session-board">
          {/* Feed health is strictly secondary and only present for a live session. */}
          {isLiveSession && (
            <span
              className={`live-feed-health live-feed-${transport}`}
              data-testid="live-feed-health"
              title="Transport health — independent of session state"
            >
              <span className="live-feed-dot" aria-hidden="true" />
              {feedHealthLabel(transport)}
            </span>
          )}
          {isArchive ? (
            <div className="live-archive-stamp" data-testid="live-archive-stamp">
              <span className="live-archive-readonly mono">READ-ONLY</span>
              {capturedLabel && <span className="live-archive-captured mono">captured {capturedLabel}</span>}
            </div>
          ) : (
            <>
              {display.phaseLabel && <span className="live-phase-pill mono">{display.phaseLabel}</span>}
              <div className="live-clock mono" data-testid="live-clock">{clock || '--:--:--'}</div>
            </>
          )}
          <div className="live-banner-meta">
            {!isArchive && display.advanceCount && <span>{display.advanceCount} advance</span>}
            {!isArchive && atRiskLabel && <span>{atRiskLabel}</span>}
            <span>
              L<strong>{snapshot.CurrentLap || '-'}</strong>/<strong>{snapshot.TotalLaps || '-'}</strong>
            </span>
            {!isArchive && (
              <span className={phase === 'live' ? 'live-state live-state-on' : 'live-state'}>
                {phase === 'live' ? 'live' : 'stale'}
              </span>
            )}
            {isArchive && <span className="live-state live-state-archive">archive</span>}
          </div>
        </div>
      </div>
      <WeatherStrip weather={snapshot.Weather} />
    </section>
  )
}
