import type { LiveRCMessage } from '../../types'
import { latestRaceControl } from '../../lib/live'

interface Props {
  messages: LiveRCMessage[]
}

export function RaceControlFeed({ messages }: Props) {
  const latest = latestRaceControl(messages)

  return (
    <section className="live-rc">
      <div className="sec-header">
        <span className="sec-title">Race Control</span>
        {messages.length > 0 && <span className="sec-meta">{messages.length} messages</span>}
      </div>
      {latest.length === 0 ? (
        <div className="missing-notice">No race control messages in the current live snapshot.</div>
      ) : (
        <div className="live-rc-list">
          {latest.map((message, index) => (
            <div className="live-rc-row" key={`${message.Time}-${message.Message}-${index}`}>
              <span className="rc-time">{message.Time || '--:--'}</span>
              {message.Flag && <span className="rc-flag">{message.Flag}</span>}
              {message.Lap > 0 && <span className="rc-lap">L{message.Lap}</span>}
              <span>{message.Message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
