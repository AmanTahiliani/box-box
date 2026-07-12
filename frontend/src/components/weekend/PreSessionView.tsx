import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { WeekendContext } from '../../types'
import { RacePreviewPage } from '../../pages/RacePreviewPage'
import { CountdownDisplay, Flag, SeasonNavStrip, SessionTimeline } from './shared'

/**
 * PreSessionView folds the race preview surface into the Weekend home so there is
 * no separate Preview destination. It reuses the existing preview page content and
 * frames it with the next-session countdown and compact season navigation.
 */
export function PreSessionView({ context, now }: { context: WeekendContext; now: Date }) {
  const next = context.next_event
  const nextStart = context.next_session?.date_start ?? next?.next_session_start ?? next?.date_start

  return (
    <div className="wk-pre" data-testid="weekend-pre-session" data-state={context.state}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">Pre-session</div>

      {next && (
        <header className="wk-pre-head" data-testid="wk-pre-head">
          <div className="wk-event-id">
            <Flag code={next.country_code} flag={next.country_flag} />
            <h1 className="wk-sessions-title">{next.meeting_name}</h1>
          </div>
          <div className="wk-pre-countdown">
            <span className="wk-next-label mono">
              {context.next_session?.session_name ?? next.next_session_name ?? 'Next session'}
            </span>
            <CountdownDisplay target={nextStart} now={now} />
          </div>
          <Link to="/live" className="wk-cta wk-cta-ghost" data-testid="wk-pre-live">
            Live timing <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </header>
      )}

      {context.sessions && context.sessions.length > 0 && <SessionTimeline sessions={context.sessions} />}

      <div className="wk-pre-preview" data-testid="wk-pre-preview">
        <RacePreviewPage />
      </div>

      {context.season_rounds && context.season_rounds.length > 0 && (
        <SeasonNavStrip rounds={context.season_rounds} />
      )}
    </div>
  )
}
