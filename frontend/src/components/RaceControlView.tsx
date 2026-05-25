import type { RaceControlMessage } from '../types'
import { rcFlagClass } from '../lib/live'

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

function eventClass(message: RaceControlMessage): string {
  const flagClass = rcFlagClass(message.flag ?? '')
  if (flagClass) return flagClass

  const category = (message.category ?? '').toLowerCase()
  const text = `${message.message ?? ''} ${message.category ?? ''}`.toLowerCase()

  if (category.includes('safety') || text.includes('safety car')) return 'rc-flag-sc'
  if (category === 'drs' || text.includes('drs')) return 'rc-flag-drs'
  if (text.includes('virtual safety car')) return 'rc-flag-vsc'
  if (text.includes('red flag')) return 'rc-flag-red'
  if (text.includes('yellow')) return 'rc-flag-yellow'
  if (text.includes('green light') || text.includes('green flag')) return 'rc-flag-green'
  if (text.includes('chequered') || text.includes('checkered')) return 'rc-flag-chequered'

  return 'rc-flag-other'
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
          {rows.map((message, index) => {
            const visualClass = eventClass(message)
            return (
              <tr className={`race-control-row ${visualClass}`} key={`${message.date}-${index}`}>
                <td className="mono rc-time-cell">
                  {formatEventTime(message.date)}
                </td>
                <td className="c mono">{message.lap_number ?? '—'}</td>
                <td>
                  <span className={`rc-event-pill rc-flag ${visualClass}`}>{eventLabel(message)}</span>
                  {message.scope && (
                    <span className="rc-scope">
                      {message.scope.toLowerCase()}
                    </span>
                  )}
                </td>
                <td className="c mono hide-mobile">{message.driver_number ?? '—'}</td>
                <td className="rc-message-cell">{message.message || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
