import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { WeekendContext } from '../../types'
import { RacePreviewPage } from '../../pages/RacePreviewPage'
import { ChampionshipRoundStrip, CountdownDisplay, Flag, SessionRail, railNodes } from './shared'
import { meetingIdentity } from '../../lib/weekendContext'

/**
 * PreSessionView folds the race preview surface into the Weekend home so there is
 * no separate Preview destination. It reuses the existing preview page content and
 * frames it with the next-session countdown and compact season navigation. It also
 * backs the /preview alias, so saved preview links resolve here instead of looping.
 */
export function PreSessionView({ context, now }: { context: WeekendContext; now: Date }) {
  const meeting = meetingIdentity(context.next_meeting ?? context.focus_meeting)
  const next = context.next_session?.session
  const nextStart = next?.date_start ?? meeting?.date_start
  const nodes = railNodes(
    context.previous_completed_session,
    context.active_session,
    context.next_session,
  )

  return (
    <div className="wk-pre" data-testid="weekend-pre-session" data-state="pre_session">
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">Pre-session</div>

      {meeting && (
        <header className="wk-pre-head" data-testid="wk-pre-head">
          <div className="wk-event-id">
            <Flag code={meeting.country_code} flag={meeting.country_flag} />
            <h1 className="wk-sessions-title">{meeting.meeting_name}</h1>
          </div>
          <div className="wk-pre-countdown">
            <span className="wk-next-label mono">{next?.session_name ?? 'Next session'}</span>
            <CountdownDisplay target={nextStart} now={now} />
          </div>
          <Link to="/live" className="wk-cta wk-cta-ghost" data-testid="wk-pre-live">
            Live timing <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </header>
      )}

      {nodes.length > 0 && <SessionRail nodes={nodes} />}

      <div className="wk-pre-preview" data-testid="wk-pre-preview">
        <RacePreviewPage />
      </div>

      <ChampionshipRoundStrip
        round={context.championship_round}
        total={context.total_championship_rounds}
      />
    </div>
  )
}
