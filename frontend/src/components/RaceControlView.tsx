import type { RaceControlMessage } from '../types'

interface Props {
  messages: RaceControlMessage[]
}

function formatEventTime(date: string): string {
  if (!date) return '—'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function eventLabel(message: RaceControlMessage): string {
  return message.flag || message.category || 'Message'
}

export function RaceControlView({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="missing-notice">
        Race control messages not ingested. Run{' '}
        <code>box-box --ingest-session &lt;key&gt;</code> to load this dataset.
      </div>
    )
  }

  const rows = [...messages].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="scroll-x" data-testid="race-control-view">
      <table className="data-table" style={{ minWidth: 620 }}>
        <thead>
          <tr>
            <th>Time</th>
            <th className="c">Lap</th>
            <th>Event</th>
            <th className="c hide-mobile">Driver</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((message, index) => (
            <tr key={`${message.date}-${index}`}>
              <td className="mono" style={{ color: 'var(--text-3)' }}>
                {formatEventTime(message.date)}
              </td>
              <td className="c mono">{message.lap_number ?? '—'}</td>
              <td>
                <span style={{ fontWeight: 700 }}>{eventLabel(message)}</span>
                {message.scope && (
                  <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>
                    {message.scope.toLowerCase()}
                  </span>
                )}
              </td>
              <td className="c mono hide-mobile">{message.driver_number ?? '—'}</td>
              <td style={{ whiteSpace: 'normal' }}>{message.message || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
