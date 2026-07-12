import { useEffect, useState } from 'react'
import type { Session } from '../types'
import { RACE_HUB_DATASETS } from '../lib/coverage'
import { formatCountdown, formatSessionScheduleTime, sessionStartTime } from '../lib/schedule'

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

interface Props {
  session: Session
  sessionName: string
}

/**
 * Purpose-built view for a session that has not run yet. Instead of rendering
 * empty Winner / Podium / Pole / Strategy / Compare cards, it explains that the
 * session is upcoming and previews the analysis that will appear once the data
 * is ingested.
 */
export function PreSessionView({ session, sessionName }: Props) {
  const start = sessionStartTime(session)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!start) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [start])

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
