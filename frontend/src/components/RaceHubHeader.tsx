import type { Meeting, Session, RaceHub } from '../types'
import { formatDate } from '../utils'

interface Props {
  meeting?: Meeting
  session?: Session
  source: RaceHub['source']
}

function SourceBadge({ source }: { source: RaceHub['source'] }) {
  if (source === 'local') return <span className="badge badge-local">Local</span>
  if (source === 'partial') return <span className="badge badge-partial">Partial</span>
  return <span className="badge badge-none">No data</span>
}

export function RaceHubHeader({ meeting, session, source }: Props) {
  const meetingName = meeting?.meeting_name ?? 'Unknown Meeting'
  const sessionName = session?.session_name ?? 'Unknown Session'
  const dateStr = formatDate(session?.date_start ?? meeting?.date_start)
  const location = meeting ? `${meeting.location} · ${meeting.country_name}` : null

  return (
    <div className="rh-header">
      <div className="rh-title-group">
        <div className="rh-meeting">{meetingName}</div>
        <div className="rh-session">{sessionName}</div>
        <div className="rh-meta">
          {dateStr && <span className="rh-meta-item">{dateStr}</span>}
          {location && <span className="rh-meta-item" style={{ opacity: 0.6 }}>·</span>}
          {location && <span className="rh-meta-item">{location}</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <SourceBadge source={source} />
      </div>
    </div>
  )
}
