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
  const weather = snapshot.Weather
  const hasWeather = weather && (weather.AirTemp > 0 || weather.TrackTemp > 0)

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
          {status && <span className={`track-status ${trackStatusClass(snapshot.TrackStatus)}`}>{status}</span>}
          <span className="mono">
            L<strong>{snapshot.CurrentLap || '-'}</strong>/<strong>{snapshot.TotalLaps || '-'}</strong>
          </span>
          {clock && <span className="mono">{clock}</span>}
          <span className={isLive ? 'live-state live-state-on' : 'live-state'}>{isLive ? 'live' : 'stale'}</span>
        </div>
      </div>
      {hasWeather && (
        <div className="live-weather-strip">
          <span>{weather.AirTemp.toFixed(0)}° air</span>
          <span>{weather.TrackTemp.toFixed(0)}° track</span>
          {weather.Humidity > 0 && <span>{weather.Humidity.toFixed(0)}% humidity</span>}
          {weather.WindSpeed > 0 && <span>{weather.WindSpeed.toFixed(1)} m/s</span>}
          {weather.Rainfall && <span className="badge badge-wet">WET</span>}
        </div>
      )}
    </section>
  )
}
