import { Link } from '@tanstack/react-router'
import { ChevronRight, Flag as FlagIcon } from 'lucide-react'
import type { WeekendContext } from '../../types'
import {
  BriefingStrip,
  ChampionshipImpactCard,
  CountdownDisplay,
  EventPodium,
  Flag,
  SeasonNavStrip,
} from './shared'
import { parseScheduleTime } from '../../lib/schedule'

const EYEBROW: Record<string, string> = {
  between_races: 'Between races',
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

export function BetweenRacesView({ context, now }: { context: WeekendContext; now: Date }) {
  const { last_event, next_event, championship_impact, season_rounds, briefing } = context
  const eyebrow = EYEBROW[context.state] ?? 'Between races'

  return (
    <div className="wk-between" data-testid="weekend-between-races" data-state={context.state}>
      <div className="wk-eyebrow mono" data-testid="wk-eyebrow">{eyebrow}</div>

      <div className="wk-top-grid">
        {last_event && (
          <section className="wk-event-card wk-event-last" data-testid="wk-last-event">
            <header className="wk-event-head">
              <div className="wk-event-id">
                <Flag code={last_event.country_code} flag={last_event.country_flag} />
                <h2 className="wk-event-name">{last_event.meeting_name}</h2>
              </div>
              <span className="wk-event-tag wk-tag-done mono">
                <FlagIcon size={13} aria-hidden="true" /> Completed
              </span>
            </header>
            <div className="wk-event-body">
              <EventPodium event={last_event} />
              <div className="wk-story-card">
                <span className="wk-story-label">What decided it?</span>
                {last_event.story && <p className="wk-story-text">{last_event.story}</p>}
                <Link
                  to="/race-hub"
                  search={{ session_key: last_event.analysis_session_key }}
                  className="wk-cta wk-cta-primary"
                  data-testid="wk-explore-race-story"
                >
                  Explore Race Story <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {next_event ? (
          <section className="wk-event-card wk-event-next" data-testid="wk-next-event">
            <header className="wk-event-head">
              <div className="wk-event-id">
                <Flag code={next_event.country_code} flag={next_event.country_flag} />
                <h2 className="wk-event-name">{next_event.meeting_name}</h2>
              </div>
              <span className="wk-event-tag wk-tag-next mono">Next event</span>
            </header>
            <div className="wk-next-body">
              <CountdownDisplay target={next_event.next_session_start ?? next_event.date_start} now={now} />
              <div className="wk-next-session">
                <span className="wk-next-label mono">Next session</span>
                <span className="wk-next-value">
                  {formatSessionLine(next_event.next_session_name, next_event.next_session_start)}
                </span>
              </div>
              <Link to="/preview" className="wk-cta wk-cta-primary wk-cta-wide" data-testid="wk-prepare">
                Prepare for {next_event.meeting_name.replace(/ Grand Prix$/i, '')}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="wk-event-card wk-event-next" data-testid="wk-season-complete-card">
            <header className="wk-event-head">
              <h2 className="wk-event-name">That's a wrap</h2>
              <span className="wk-event-tag wk-tag-next mono">Off-season</span>
            </header>
            <div className="wk-next-body">
              <p className="wk-season-complete-copy">
                The {context.season} calendar is complete. Explore the season's races or revisit the championship
                battle while the next schedule is confirmed.
              </p>
              <Link to="/explore" className="wk-cta wk-cta-primary wk-cta-wide">
                Explore the season <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>

      <div className="wk-mid-grid">
        {championship_impact && <ChampionshipImpactCard impact={championship_impact} />}
        {season_rounds && season_rounds.length > 0 && <SeasonNavStrip rounds={season_rounds} />}
      </div>

      {briefing && briefing.length > 0 && <BriefingStrip items={briefing} />}
    </div>
  )
}
