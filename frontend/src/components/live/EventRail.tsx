import { useAutoAnimate } from '@formkit/auto-animate/react'
import {
  Flag,
  LogOut,
  Megaphone,
  OctagonX,
  Swords,
  Timer,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LiveDriverInfo } from '../../types'
import type { LiveEvent, LiveEventKind } from '../../lib/events'
import { teamColor } from '../../utils'
import '../../styles/event-rail.css'

interface Props {
  events: LiveEvent[]
  driverInfo?: Record<string, LiveDriverInfo>
}

const KIND_ICONS: Record<LiveEventKind, LucideIcon> = {
  overtake: Swords,
  'position-gain': TrendingUp,
  'position-loss': TrendingDown,
  'pit-in': Wrench,
  'pit-out': LogOut,
  'personal-best': Timer,
  'fastest-lap': Zap,
  retirement: OctagonX,
  'track-status': Flag,
  'race-control': Megaphone,
}

export function EventRail({ events, driverInfo }: Props) {
  const [listRef] = useAutoAnimate<HTMLDivElement>()

  return (
    <section className="event-rail panel-glass" data-testid="event-rail">
      <div className="sec-header sticky-header">
        <span className="sec-title">What Just Happened</span>
        {events.length > 0 && <span className="sec-meta">{events.length} events</span>}
      </div>
      {events.length === 0 ? (
        <div className="missing-notice">Events will appear here as the session unfolds.</div>
      ) : (
        <div className="event-rail-list" ref={listRef}>
          {events.map((event) => {
            const Icon = KIND_ICONS[event.kind] ?? Megaphone
            const colour = driverInfo?.[event.racingNumbers[0]]?.TeamColour
            const accent = event.racingNumbers.length > 0 ? teamColor(colour) : 'var(--border-2)'
            return (
              <div className={`event-rail-row event-kind-${event.kind}`} key={event.id} style={{ borderLeftColor: accent }}>
                <span className="event-rail-icon" aria-hidden="true">
                  <Icon size={14} />
                </span>
                <div className="event-rail-body">
                  <span className="event-rail-headline">{event.headline}</span>
                  {event.detail && <span className="event-rail-detail">{event.detail}</span>}
                </div>
                {event.lap > 0 && <span className="event-rail-lap">L{event.lap}</span>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
