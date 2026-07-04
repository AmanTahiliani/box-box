import type { LiveStreamData } from '../../types'
import type { LiveTimingRow } from '../../lib/live'
import { extrapolateClock, liveSessionDisplay } from '../../lib/live'
import { WeatherStrip } from './WeatherStrip'

interface Props {
  isLive: boolean
  isArchive?: boolean
  snapshot: LiveStreamData
  rows: LiveTimingRow[]
  connection: 'connected' | 'connecting' | 'disconnected' | 'error'
  now: number
}

export function SessionBanner({ isLive, isArchive = false, snapshot, rows, connection, now }: Props) {
  const session = snapshot.Session
  const clock = extrapolateClock(snapshot.Clock, snapshot.ClockRefTime, snapshot.ClockExtrapolating, now)
  const display = liveSessionDisplay(session, rows)
  const atRiskLabel =
    display.atRiskStart && display.atRiskEnd ? `P${display.atRiskStart}-P${display.atRiskEnd} at risk` : ''
  const stateLabel = isLive ? 'live' : isArchive ? 'archive' : 'stale'

  return (
    <section className="live-banner">
      <div className="live-banner-row">
        <div className="live-banner-main">
          <span className={`live-conn live-conn-${connection}`}>{connection}</span>
          <div>
            <h1>{session?.MeetingName || 'Live Timing'}</h1>
            <p>
              {[session?.SessionName, session?.CircuitName].filter(Boolean).join(' · ') || 'F1 live feed'}
            </p>
          </div>
        </div>
        <div className="live-session-board">
          {display.phaseLabel && <span className="live-phase-pill mono">{display.phaseLabel}</span>}
          <div className="live-clock mono" data-testid="live-clock">{clock || '--:--:--'}</div>
          <div className="live-banner-meta">
            {display.advanceCount && <span>{display.advanceCount} advance</span>}
            {atRiskLabel && <span>{atRiskLabel}</span>}
            <span>
              L<strong>{snapshot.CurrentLap || '-'}</strong>/<strong>{snapshot.TotalLaps || '-'}</strong>
            </span>
            <span className={isLive ? 'live-state live-state-on' : 'live-state'}>{stateLabel}</span>
          </div>
        </div>
      </div>
      <WeatherStrip weather={snapshot.Weather} />
    </section>
  )
}
