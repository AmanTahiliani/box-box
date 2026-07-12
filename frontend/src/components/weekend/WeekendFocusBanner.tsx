import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { fetchWeekend } from '../../api'
import { meetingIdentity } from '../../lib/weekendContext'

/**
 * Restores Race Hub → Weekend meeting/session context from the URL search
 * contract. Deep-linkable and reload-safe — no hidden component memory.
 */
export function WeekendFocusBanner({
  meetingKey,
  sessionKey,
}: {
  meetingKey?: number
  sessionKey?: number
}) {
  const hasFocus = (meetingKey != null && meetingKey > 0) || (sessionKey != null && sessionKey > 0)
  const weekendQuery = useQuery({
    queryKey: ['weekend', meetingKey],
    queryFn: () => fetchWeekend(meetingKey!),
    enabled: meetingKey != null && meetingKey > 0,
    staleTime: 60_000,
  })

  if (!hasFocus) return null

  const weekend = weekendQuery.data
  const meeting = meetingIdentity(weekend?.meeting)
  const session = weekend?.sessions.find((s) => s.session.session_key === sessionKey)?.session
  const meetingLabel = meeting?.meeting_name ?? (meetingKey ? `Meeting ${meetingKey}` : 'Selected weekend')
  const sessionLabel = session?.session_name ?? (sessionKey ? `Session ${sessionKey}` : null)

  return (
    <section
      className="wk-focus"
      data-testid="wk-focus-context"
      data-meeting-key={meetingKey ?? undefined}
      data-session-key={sessionKey ?? undefined}
      aria-label="Selected weekend context"
    >
      <div className="wk-focus-copy">
        <span className="wk-focus-eyebrow mono">From Race Hub</span>
        <h2 className="wk-focus-title" data-testid="wk-focus-meeting">
          {meetingLabel}
        </h2>
        {sessionLabel && (
          <p className="wk-focus-session" data-testid="wk-focus-session">
            Selected session · {sessionLabel}
          </p>
        )}
      </div>
      {sessionKey != null && sessionKey > 0 && (
        <Link
          to="/race-hub"
          search={{ session_key: sessionKey }}
          className="wk-cta wk-cta-primary wk-focus-cta"
          data-testid="wk-return-analysis"
        >
          Continue analysis <ChevronRight size={15} aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}
