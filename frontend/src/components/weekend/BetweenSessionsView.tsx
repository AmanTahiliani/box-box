import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { WeekendBriefingItem, WeekendContext, WeekendViewState } from '../../types'
import { BriefingStrip, CountdownDisplay, EventPodium, SessionRail, railNodes } from './shared'
import { analysisSessionKey, meetingIdentity } from '../../lib/weekendContext'
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

export function BetweenSessionsView({
  context,
  now,
  view,
  briefing,
}: {
  context: WeekendContext
  now: Date
  view: WeekendViewState
  briefing: WeekendBriefingItem[]
}) {
  const settling = view === 'session_settling'
  const focus = meetingIdentity(context.focus_meeting)
  const previous = context.previous_completed_session
  const previousName = previous?.session.session_name ?? 'Last session'
  const next = context.next_session?.session
  // Settling recap must open the just-finished session, not an older default.
  const previousKey = previous?.session.session_key
  const analysisKey =
    settling && previousKey && previousKey > 0 ? previousKey : analysisSessionKey(context)
  const nodes = railNodes(previous, context.active_session, context.next_session)

  return (
    <div className="wk-sessions" data-testid="weekend-between-sessions" data-state={view}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">
        {settling ? 'Session settling' : 'Between sessions'}
      </div>

      <header className="wk-sessions-head">
        <h1 className="wk-sessions-title">{focus?.meeting_name ?? 'Race weekend'}</h1>
        {focus?.circuit_short_name && <p className="wk-sessions-circuit mono">{focus.circuit_short_name}</p>}
      </header>

      <SessionRail nodes={nodes} />

      {previous && (
        <section className="wk-recap-card" data-testid="wk-last-session">
          <span className="wk-recap-eyebrow mono">
            {previousName} · {settling ? 'Settling' : 'Complete'}
          </span>
          <h2 className="wk-recap-title">What happened in {previousName}</h2>
          <EventPodium sessionKey={analysisKey} />
        </section>
      )}

      {next && (
        <section className="wk-upnext-card" data-testid="wk-next-session">
          <span className="wk-upnext-eyebrow mono">Up next</span>
          <h2 className="wk-upnext-title">{next.session_name}</h2>
          <CountdownDisplay target={next.date_start} now={now} compact />
          <p className="wk-upnext-when mono">{nextSessionWhen(next.date_start)}</p>
          {analysisKey && (
            <Link
              to="/race-hub"
              search={{ session_key: analysisKey }}
              className="wk-cta wk-cta-primary wk-cta-wide"
              data-testid="wk-view-recap"
            >
              View {previousName} recap <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {briefing.length > 0 && <BriefingStrip items={briefing} />}
    </div>
  )
}
