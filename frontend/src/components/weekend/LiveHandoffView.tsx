import { Link } from '@tanstack/react-router'
import { ChevronRight, Radio } from 'lucide-react'
import type { WeekendContext } from '../../types'
import { EventPodium, Flag, SessionRail, railNodes } from './shared'
import { analysisSessionKey, meetingIdentity } from '../../lib/weekendContext'

export function LiveHandoffView({ context }: { context: WeekendContext }) {
  const focus = meetingIdentity(context.focus_meeting ?? context.active_session?.meeting)
  const active = context.active_session?.session
  const previous = context.previous_completed_session
  const previousName = previous?.session.session_name ?? 'Last session'
  const analysisKey = analysisSessionKey(context)
  const nodes = railNodes(previous, context.active_session, context.next_session)

  return (
    <div className="wk-live" data-testid="weekend-live" data-state="session_live">
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">Session live</div>

      <section className="wk-live-card" data-testid="wk-live-card">
        <div className="wk-live-head">
          <div className="wk-event-id">
            <Flag code={focus?.country_code} flag={focus?.country_flag} />
            <h1 className="wk-sessions-title">{focus?.meeting_name ?? 'Live session'}</h1>
          </div>
          <span className="wk-live-pulse" aria-hidden="true" />
        </div>
        {focus?.circuit_short_name && <p className="wk-sessions-circuit mono">{focus.circuit_short_name}</p>}
        <p className="wk-live-lead">
          {active?.session_name ? `${active.session_name} is on track now.` : 'A session is running now.'}
        </p>
        <Link to="/live" className="wk-cta wk-cta-primary wk-cta-wide" data-testid="wk-watch-live">
          <Radio size={15} aria-hidden="true" /> Watch live timing <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </section>

      <SessionRail nodes={nodes} />

      {previous && (
        <section className="wk-recap-card" data-testid="wk-last-session">
          <span className="wk-recap-eyebrow mono">{previousName} · Complete</span>
          <h2 className="wk-recap-title">What happened in {previousName}</h2>
          <EventPodium sessionKey={analysisKey} />
        </section>
      )}
    </div>
  )
}
