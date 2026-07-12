import { Archive, ChevronRight, Flag, Radio } from 'lucide-react'
import type { LiveTimingRow } from '../../lib/live'
import { driverCode } from '../../lib/live'
import type { LiveWeekendContext } from '../../lib/weekendContext'
import type { TransportHealth } from '../../lib/liveState'
import { feedHealthLabel } from '../../lib/liveState'
import { formatSessionScheduleTime } from '../../lib/schedule'

interface Props {
  /** 'settling' immediately after a session; 'inactive' when nothing is retained. */
  phase: 'settling' | 'inactive'
  transport: TransportHealth
  context: LiveWeekendContext
  /** Top rows of the final snapshot (settling only), already position-sorted. */
  rows: LiveTimingRow[]
  capturedAt?: string | null
  hasArchive: boolean
  onViewArchive: () => void
}

function formatCapturedAt(capturedAt: string | null | undefined): string {
  if (!capturedAt) return ''
  const date = new Date(capturedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

export function LiveHandoff({
  phase,
  transport,
  context,
  rows,
  capturedAt,
  hasArchive,
  onViewArchive,
}: Props) {
  const isSettling = phase === 'settling'
  const testid = isSettling ? 'live-settling' : 'live-inactive'
  const capturedLabel = formatCapturedAt(capturedAt)
  const title = context.meetingName || 'Live Timing'
  const topRows = rows.slice(0, 3)

  const analysisKey = context.analysisSessionKey
  const analysisName = context.analysisSessionName || 'session'
  const analysisReady = context.analysisReady

  return (
    <section className={`live-handoff live-handoff-${phase}`} data-testid={testid}>
      <header className="live-handoff-head">
        <span className="live-handoff-eyebrow mono">
          {isSettling ? (
            <>
              <Flag size={13} /> SESSION SETTLING
            </>
          ) : (
            <>
              <Radio size={13} /> NO LIVE SESSION
            </>
          )}
        </span>
        <h1 className="live-handoff-title">{title}</h1>
        {isSettling && capturedLabel && (
          <p className="live-handoff-captured mono" data-testid="live-handoff-captured">
            Final feed snapshot captured {capturedLabel}
          </p>
        )}
        {!isSettling && (
          <p className="live-handoff-sub">
            The timing feed is quiet between sessions. Here&apos;s where the weekend stands.
          </p>
        )}
        <span className={`live-feed-health live-feed-${transport} live-handoff-feed`}>
          <span className="live-feed-dot" aria-hidden="true" />
          {feedHealthLabel(transport)}
        </span>
      </header>

      {isSettling && topRows.length > 0 && (
        <div className="live-handoff-snapshot" data-testid="live-handoff-snapshot">
          <span className="live-handoff-snapshot-label mono">Provisional order at chequered</span>
          <ol className="live-handoff-order">
            {topRows.map((row) => (
              <li key={row.RacingNumber}>
                <span className="mono">P{row.Position}</span>
                <span className="live-handoff-code">{driverCode(row)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="live-handoff-actions">
        {analysisKey ? (
          <a
            className="live-handoff-action live-handoff-primary"
            href={`/race-hub?session_key=${analysisKey}`}
            data-testid="live-handoff-analysis"
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">
                {isSettling ? `Open ${analysisName} analysis` : `Open ${analysisName} in Race Hub`}
              </span>
              <span className="live-handoff-action-meta mono">
                {analysisReady
                  ? 'Full timing, strategy & story ready'
                  : 'Settling — analysis will fill in as data ingests'}
              </span>
            </span>
            <ChevronRight size={18} />
          </a>
        ) : (
          <div className="live-handoff-action live-handoff-pending" data-testid="live-handoff-analysis-pending">
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">Analysis not ready yet</span>
              <span className="live-handoff-action-meta mono">
                The completed session will appear in Race Hub once it is ingested.
              </span>
            </span>
          </div>
        )}

        {context.nextSession && (
          <div className="live-handoff-action live-handoff-next" data-testid="live-handoff-next">
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">Up next · {context.nextSession.name}</span>
              <span className="live-handoff-action-meta mono">
                {formatSessionScheduleTime(context.nextSession.startsAt)}
              </span>
            </span>
          </div>
        )}

        {context.previousSession && context.previousSession.sessionKey !== analysisKey && (
          <a
            className="live-handoff-action"
            href={`/race-hub?session_key=${context.previousSession.sessionKey}`}
            data-testid="live-handoff-recap"
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">Recap · {context.previousSession.name}</span>
              <span className="live-handoff-action-meta mono">Review the last completed session</span>
            </span>
            <ChevronRight size={18} />
          </a>
        )}

        {hasArchive && (
          <button
            type="button"
            className="live-handoff-action live-handoff-archive-btn"
            onClick={onViewArchive}
            data-testid="live-handoff-archive"
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">
                <Archive size={14} /> View full timing (read-only)
              </span>
              <span className="live-handoff-action-meta mono">Frozen final snapshot — no live updates</span>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        {!analysisKey && !context.nextSession && !context.previousSession && !hasArchive && (
          <div className="live-handoff-fallback" data-testid="live-handoff-fallback">
            <a href="/" className="live-handoff-action">
              <span className="live-handoff-action-body">
                <span className="live-handoff-action-label">Command Center</span>
                <span className="live-handoff-action-meta mono">Weekend schedule &amp; standings</span>
              </span>
              <ChevronRight size={18} />
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
