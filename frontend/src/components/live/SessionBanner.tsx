import type { LiveStreamData } from '../../types'
import { extrapolateClock, trackStatusClass, trackStatusLabel } from '../../lib/live'

interface Props {
  isLive: boolean
  snapshot: LiveStreamData
  connection: 'connected' | 'connecting' | 'disconnected' | 'error'
  now: number
}

export function SessionBanner({ isLive, snapshot, connection, now }: Props) {
  const session = snapshot.Session
  const clock = extrapolateClock(snapshot.Clock, snapshot.ClockRefTime, snapshot.ClockExtrapolating, now)
  const status = snapshot.TrackStatus ? trackStatusLabel(snapshot.TrackStatus) : ''

  return (
    <section className="live-banner">
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
          Lap <strong>{snapshot.CurrentLap || '-'}</strong>/<strong>{snapshot.TotalLaps || '-'}</strong>
        </span>
        {status && <span className={`track-status ${trackStatusClass(snapshot.TrackStatus)}`}>{status}</span>}
        {clock && <span className="mono">{clock}</span>}
        <span className={isLive ? 'live-state live-state-on' : 'live-state'}>{isLive ? 'live' : 'stale'}</span>
      </div>
    </section>
  )
}
