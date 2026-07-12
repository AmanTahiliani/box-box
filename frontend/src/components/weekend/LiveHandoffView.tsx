import { Link } from '@tanstack/react-router'
import { ChevronRight, Radio } from 'lucide-react'
import type { WeekendContext } from '../../types'
import { EventPodium, Flag, SessionTimeline } from './shared'

export function LiveHandoffView({ context }: { context: WeekendContext }) {
  const { active_meeting_name, active_circuit_short_name, sessions, last_session } = context
  const liveSession = sessions?.find((s) => s.status === 'live')

  return (
    <div className="wk-live" data-testid="weekend-live" data-state={context.state}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">Session live</div>

      <section className="wk-live-card" data-testid="wk-live-card">
        <div className="wk-live-head">
          <div className="wk-event-id">
            <Flag code={context.last_event?.country_code} flag={context.last_event?.country_flag} />
            <h1 className="wk-sessions-title">{active_meeting_name ?? 'Live session'}</h1>
          </div>
          <span className="wk-live-pulse" aria-hidden="true" />
        </div>
        {active_circuit_short_name && <p className="wk-sessions-circuit mono">{active_circuit_short_name}</p>}
        <p className="wk-live-lead">
          {liveSession ? `${liveSession.session_name} is on track now.` : 'A session is running now.'}
        </p>
        <Link to="/live" className="wk-cta wk-cta-primary wk-cta-wide" data-testid="wk-watch-live">
          <Radio size={15} aria-hidden="true" /> Watch live timing <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </section>

      {sessions && <SessionTimeline sessions={sessions} />}

      {last_session && (
        <section className="wk-recap-card" data-testid="wk-last-session">
          <span className="wk-recap-eyebrow mono">{last_session.label} · Complete</span>
          <h2 className="wk-recap-title">What happened in {last_session.label}</h2>
          <EventPodium event={last_session} />
        </section>
      )}
    </div>
  )
}
