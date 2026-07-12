import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { WeekendContext } from '../../types'
import { BriefingStrip, CountdownDisplay, EventPodium, SessionTimeline } from './shared'
import { parseScheduleTime } from '../../lib/schedule'

function nextSessionWhen(start: string | undefined): string {
  const date = start ? parseScheduleTime(start) : null
  if (!date) return 'Time to be confirmed'
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function BetweenSessionsView({ context, now }: { context: WeekendContext; now: Date }) {
  const settling = context.state === 'session_settling'
  const { active_meeting_name, active_circuit_short_name, sessions, last_session, next_session } = context

  return (
    <div className="wk-sessions" data-testid="weekend-between-sessions" data-state={context.state}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">
        {settling ? 'Session settling' : 'Between sessions'}
      </div>

      <header className="wk-sessions-head">
        <h1 className="wk-sessions-title">{active_meeting_name ?? 'Race weekend'}</h1>
        {active_circuit_short_name && <p className="wk-sessions-circuit mono">{active_circuit_short_name}</p>}
      </header>

      {sessions && <SessionTimeline sessions={sessions} />}

      {last_session && (
        <section className="wk-recap-card" data-testid="wk-last-session">
          <span className="wk-recap-eyebrow mono">
            {last_session.label} · {settling ? 'Settling' : 'Complete'}
          </span>
          <h2 className="wk-recap-title">What happened in {last_session.label}</h2>
          <EventPodium event={last_session} />
        </section>
      )}

      {next_session && (
        <section className="wk-upnext-card" data-testid="wk-next-session">
          <span className="wk-upnext-eyebrow mono">Up next</span>
          <h2 className="wk-upnext-title">{next_session.session_name}</h2>
          <CountdownDisplay target={next_session.date_start} now={now} compact />
          <p className="wk-upnext-when mono">{nextSessionWhen(next_session.date_start)}</p>
          {last_session && (
            <Link
              to="/race-hub"
              search={{ session_key: last_session.analysis_session_key }}
              className="wk-cta wk-cta-primary wk-cta-wide"
              data-testid="wk-view-recap"
            >
              View {last_session.label} recap <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {context.briefing && context.briefing.length > 0 && <BriefingStrip items={context.briefing} />}
    </div>
  )
}
