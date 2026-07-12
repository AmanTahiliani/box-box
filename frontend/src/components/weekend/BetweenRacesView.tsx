import { Link } from '@tanstack/react-router'
import { ChevronRight, Flag as FlagIcon } from 'lucide-react'
import type {
  WeekendBriefingItem,
  WeekendChampionshipImpact,
  WeekendContext,
  WeekendViewState,
} from '../../types'
import {
  BriefingStrip,
  ChampionshipImpactCard,
  ChampionshipRoundStrip,
  CountdownDisplay,
  EventPodium,
  Flag,
} from './shared'
import { analysisSessionKey, meetingIdentity } from '../../lib/weekendContext'
import { parseScheduleTime } from '../../lib/schedule'

const EYEBROW: Record<string, string> = {
  between_weekends: 'Between races',
  post_weekend: 'Post-weekend',
  season_complete: 'Season complete',
}

function formatSessionLine(name: string | undefined, start: string | undefined): string {
  if (!name) return 'Schedule to be confirmed'
  const date = start ? parseScheduleTime(start) : null
  if (!date) return name
  const when = date.toLocaleString('en-GB', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${name} · ${when}`
}

export function BetweenRacesView({
  context,
  now,
  view,
  championship,
  briefing,
}: {
  context: WeekendContext
  now: Date
  view: WeekendViewState
  championship?: WeekendChampionshipImpact
  briefing: WeekendBriefingItem[]
}) {
  const eyebrow = EYEBROW[view] ?? 'Between races'

  const previous = context.previous_completed_session
  const previousMeeting = meetingIdentity(previous?.meeting ?? context.previous_meeting)
  const nextMeeting = meetingIdentity(context.next_meeting)
  const nextSession = context.next_session?.session
  const analysisKey = analysisSessionKey(context)

  return (
    <div className="wk-between" data-testid="weekend-between-races" data-state={view}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">{eyebrow}</div>

      <div className="wk-top-grid">
        {previousMeeting && (
          <section className="wk-event-card wk-event-last" data-testid="wk-last-event">
            <header className="wk-event-head">
              <div className="wk-event-id">
                <Flag code={previousMeeting.country_code} flag={previousMeeting.country_flag} />
                <h2 className="wk-event-name">{previousMeeting.meeting_name}</h2>
              </div>
              <span className="wk-event-tag wk-tag-done mono">
                <FlagIcon size={13} aria-hidden="true" /> Completed
              </span>
            </header>
            <div className="wk-event-body">
              <EventPodium sessionKey={analysisKey} />
              <div className="wk-story-card">
                <span className="wk-story-label">What decided it?</span>
                {analysisKey ? (
                  <Link
                    to="/race-hub"
                    search={{ session_key: analysisKey }}
                    className="wk-cta wk-cta-primary"
                    data-testid="wk-explore-race-story"
                  >
                    Explore Race Story <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="wk-story-text" data-testid="wk-no-analysis">
                    Analysis for this session is not available locally yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {nextMeeting ? (
          <section className="wk-event-card wk-event-next" data-testid="wk-next-event">
            <header className="wk-event-head">
              <div className="wk-event-id">
                <Flag code={nextMeeting.country_code} flag={nextMeeting.country_flag} />
                <h2 className="wk-event-name">{nextMeeting.meeting_name}</h2>
              </div>
              <span className="wk-event-tag wk-tag-next mono">Next event</span>
            </header>
            <div className="wk-next-body">
              <CountdownDisplay target={nextSession?.date_start ?? nextMeeting.date_start} now={now} />
              <div className="wk-next-session">
                <span className="wk-next-label mono">Next session</span>
                <span className="wk-next-value">
                  {formatSessionLine(nextSession?.session_name, nextSession?.date_start)}
                </span>
              </div>
              <Link to="/preview" className="wk-cta wk-cta-primary wk-cta-wide" data-testid="wk-prepare">
                Prepare for {nextMeeting.short_name}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="wk-event-card wk-event-next" data-testid="wk-season-complete-card">
            <header className="wk-event-head">
              <h2 className="wk-event-name">That&apos;s a wrap</h2>
              <span className="wk-event-tag wk-tag-next mono">Off-season</span>
            </header>
            <div className="wk-next-body">
              <p className="wk-season-complete-copy">
                The {context.season} calendar is complete. Explore the season&apos;s races or revisit the championship
                battle while the next schedule is confirmed.
              </p>
              <Link to="/explore" className="wk-cta wk-cta-primary wk-cta-wide" data-testid="wk-season-complete-explore">
                Explore the season <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>

      <div className="wk-mid-grid">
        {championship && <ChampionshipImpactCard impact={championship} />}
        <ChampionshipRoundStrip
          round={context.championship_round}
          total={context.total_championship_rounds}
        />
      </div>

      {briefing.length > 0 && <BriefingStrip items={briefing} />}
    </div>
  )
}
