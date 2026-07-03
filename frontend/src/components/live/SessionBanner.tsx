import type { LiveStreamData } from '../../types'
import { extrapolateClock } from '../../lib/live'
import { WeatherStrip } from './WeatherStrip'

interface Props {
  isLive: boolean
  snapshot: LiveStreamData
  connection: 'connected' | 'connecting' | 'disconnected' | 'error'
  now: number
}

export function SessionBanner({ isLive, snapshot, connection, now }: Props) {
  const session = snapshot.Session
  const clock = extrapolateClock(snapshot.Clock, snapshot.ClockRefTime, snapshot.ClockExtrapolating, now)

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
        <div className="live-banner-meta">
          <span className="mono">
            L<strong>{snapshot.CurrentLap || '-'}</strong>/<strong>{snapshot.TotalLaps || '-'}</strong>
          </span>
          {clock && <span className="mono">{clock}</span>}
          <span className={isLive ? 'live-state live-state-on' : 'live-state'}>{isLive ? 'live' : 'stale'}</span>
        </div>
      </div>
      <WeatherStrip weather={snapshot.Weather} />
    </section>
  )
}
