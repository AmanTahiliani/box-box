import { useEffect, useRef, useState } from 'react'
import type { LiveRCMessage, LiveDriverInfo } from '../../types'
import { latestRaceControl, rcFlagClass } from '../../lib/live'
import { teamColor } from '../../utils'
import { useAutoAnimate } from '@formkit/auto-animate/react'

interface Props {
  messages: LiveRCMessage[]
  driverInfo?: Record<string, LiveDriverInfo>
}

function FormattedMessage({ text, driverInfo }: { text: string, driverInfo?: Record<string, LiveDriverInfo> }) {
  if (!text) return null;
  const regex = /(CAR \d+(?: \([A-Z]{3}\))?|DELETED|TRACK LIMITS|INVESTIGATING|NO FURTHER INVESTIGATION|TIME PENALTY|DRIVE THROUGH PENALTY|STOP AND GO PENALTY|BLACK AND WHITE FLAG|DISQUALIFIED)/g;
  const parts = text.split(regex);
  
  return (
    <span className="rc-message">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('CAR ')) {
          let style = {}
          const match = part.match(/CAR (\d+)/)
          if (match && driverInfo && driverInfo[match[1]]) {
            const hex = teamColor(driverInfo[match[1]].TeamColour)
            style = { 
              backgroundColor: hex, 
              color: '#fff', 
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              border: 'none'
            }
          }
          return <span key={i} className="rc-hlt rc-hlt-car" style={style}>{part}</span>
        }
        if (part === 'DELETED' || part.includes('PENALTY') || part === 'DISQUALIFIED') return <span key={i} className="rc-hlt rc-hlt-bad">{part}</span>;
        if (part === 'TRACK LIMITS' || part === 'INVESTIGATING' || part === 'BLACK AND WHITE FLAG') return <span key={i} className="rc-hlt rc-hlt-warn">{part}</span>;
        if (part === 'NO FURTHER INVESTIGATION') return <span key={i} className="rc-hlt rc-hlt-ok">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  )
}

export function RaceControlFeed({ messages, driverInfo }: Props) {
  const latest = latestRaceControl(messages)
  const [listRef] = useAutoAnimate<HTMLDivElement>()
  const prevMessagesRef = useRef<LiveRCMessage[]>([])
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const prev = prevMessagesRef.current
    if (prev.length > 0 && messages.length > prev.length) {
      // Find new messages
      const newlyAdded = messages.filter(
        (m) => !prev.some((p) => p.Time === m.Time && p.Message === m.Message)
      )
      
      if (newlyAdded.length > 0) {
        const keys = newlyAdded.map((m) => `${m.Time}-${m.Message}`)
        setNewKeys((current) => {
          const updated = new Set(current)
          keys.forEach(k => updated.add(k))
          return updated
        })

        // Clear highlight after 3 seconds
        setTimeout(() => {
          setNewKeys((current) => {
            const updated = new Set(current)
            keys.forEach(k => updated.delete(k))
            return updated
          })
        }, 3000)
      }
    }
    prevMessagesRef.current = messages
  }, [messages])

  return (
    <section className="live-rc panel-glass">
      <div className="sec-header sticky-header">
        <span className="sec-title">Race Control</span>
        {messages.length > 0 && <span className="sec-meta">{messages.length} messages</span>}
      </div>
      {latest.length === 0 ? (
        <div className="missing-notice">No race control messages in the current live snapshot.</div>
      ) : (
        <div className="live-rc-list live-rc-scroll" ref={listRef}>
          {latest.map((message, index) => {
            const key = `${message.Time}-${message.Message}`
            const isNew = newKeys.has(key)
            let flashClass = ''
            if (isNew) {
              if (message.Flag === 'YELLOW' || message.Flag === 'DOUBLE YELLOW') {
                flashClass = ' rc-item-yellow'
              } else if (message.Flag === 'RED') {
                flashClass = ' rc-item-red'
              } else {
                flashClass = ' rc-item-new'
              }
            }

            return (
              <div className={`live-rc-row${flashClass}`} key={key}>
                <span className="rc-time">{message.Time || '--:--'}</span>
                {message.Lap > 0 && <span className="rc-lap">L{message.Lap}</span>}
                {message.Flag
                  ? <span className={`rc-flag ${rcFlagClass(message.Flag)}`}>{message.Flag}</span>
                  : message.Category && message.Category !== 'Other'
                    ? <span className="rc-category">{message.Category}</span>
                    : null
                }
                <FormattedMessage text={message.Message} driverInfo={driverInfo} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
