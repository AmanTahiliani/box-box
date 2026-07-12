import { Archive, ChevronRight, Flag, Radio } from 'lucide-react'
import type { LiveTimingRow } from '../../lib/live'
import { driverCode } from '../../lib/live'
import type { TransportHealth } from '../../lib/liveState'
import { feedHealthLabel } from '../../lib/liveState'
import type { ContextSession, WeekendContext } from '../../types'
import { analysisSessionKey } from '../../lib/weekendContext'
import { formatSessionScheduleTime } from '../../lib/schedule'

interface Props {
  /** 'settling' immediately after a session; 'inactive' when nothing is live. */
  phase: 'settling' | 'inactive'
  transport: TransportHealth
  /** Canonical weekend context (issue #72). May be undefined before it loads. */
  context: WeekendContext | undefined
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

function sessionKeyOf(session: ContextSession | undefined): number | undefined {
  const key = session?.session.session_key
  return key && key > 0 ? key : undefined
}

/**
 * Fully ingested analysis (local_analysis === complete). Stricter than
 * hasLocalAnalysis, which also treats partial as link-worthy — Live polling
 * and "ready" chrome wait for the complete state.
 */
export function analysisIsReady(session: ContextSession | undefined): boolean {
  return session?.availability?.local_analysis === 'complete'
}

/**
 * Analysis target for the Live handoff surface.
 *
 * Settling must follow the just-finished session (`previous_completed_session`).
 * The canonical backend can mark that session archive-complete while leaving
 * `default_analysis_session` on an older already-ingested practice/qualifying —
 * preferring default here would link/poll/label the wrong race.
 *
 * Inactive keeps the shared default-first preference via analysisSessionKey.
 */
export function handoffAnalysisSession(
  context: WeekendContext | undefined,
  phase: 'settling' | 'inactive',
): ContextSession | undefined {
  if (!context) return undefined
  if (phase === 'settling') {
    if (sessionKeyOf(context.previous_completed_session)) {
      return context.previous_completed_session
    }
    return sessionKeyOf(context.default_analysis_session)
      ? context.default_analysis_session
      : undefined
  }
  const key = analysisSessionKey(context)
  if (!key) return undefined
  if (context.default_analysis_session?.session.session_key === key) {
    return context.default_analysis_session
  }
  return context.previous_completed_session
}

/**
 * Keep polling weekend-context while the just-finished session (or, absent
 * that, the default analysis session) is still ingesting. An older ready
 * default must not stop the settle→ready transition.
 */
export function shouldPollHandoffAnalysis(context: WeekendContext | undefined): boolean {
  if (!context) return true
  const previous = context.previous_completed_session
  if (sessionKeyOf(previous) && !analysisIsReady(previous)) return true
  const fallback = context.default_analysis_session
  if (sessionKeyOf(fallback) && !analysisIsReady(fallback)) return true
  return !sessionKeyOf(previous) && !sessionKeyOf(fallback)
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

  const focusName = context?.focus_meeting?.meeting_name
  const activeName = context?.active_session?.meeting?.meeting_name
  const title = focusName || activeName || 'Live Timing'
  const topRows = rows.slice(0, 3)

  const analysis = handoffAnalysisSession(context, phase)
  const analysisKey = sessionKeyOf(analysis)
  const analysisName = analysis?.session.session_name || 'session'
  const analysisReady = analysisIsReady(analysis)

  const next = context?.next_session
  const previous = context?.previous_completed_session
  // Avoid a duplicate recap card when previous == the analysis target.
  const showRecap =
    previous && previous.session.session_key !== analysisKey && previous.session.session_key !== 0

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
            data-ready={analysisReady ? 'true' : 'false'}
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">
                {isSettling ? `Open ${analysisName} analysis` : `Open ${analysisName} in Race Hub`}
              </span>
              <span className="live-handoff-action-meta mono">
                {analysisReady
                  ? 'Full timing, strategy & story ready'
                  : isSettling
                    ? 'Settling — analysis will fill in as data ingests'
                    : 'Analysis will fill in as data ingests'}
              </span>
            </span>
            <ChevronRight size={18} />
          </a>
        ) : (
          <div
            className="live-handoff-action live-handoff-pending"
            data-testid="live-handoff-analysis-pending"
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">Analysis not ready yet</span>
              <span className="live-handoff-action-meta mono">
                The completed session will appear in Race Hub once it is ingested.
              </span>
            </span>
          </div>
        )}

        {next && (
          <div className="live-handoff-action live-handoff-next" data-testid="live-handoff-next">
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">
                Up next · {next.session.session_name}
              </span>
              <span className="live-handoff-action-meta mono">
                {formatSessionScheduleTime(next.session.date_start)}
              </span>
            </span>
          </div>
        )}

        {showRecap && (
          <a
            className="live-handoff-action"
            href={`/race-hub?session_key=${previous!.session.session_key}`}
            data-testid="live-handoff-recap"
          >
            <span className="live-handoff-action-body">
              <span className="live-handoff-action-label">
                Recap · {previous!.session.session_name}
              </span>
              <span className="live-handoff-action-meta mono">
                Review the last completed session
              </span>
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
              <span className="live-handoff-action-meta mono">
                Frozen final snapshot — no live updates
              </span>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        {!analysisKey && !next && !showRecap && !hasArchive && (
          <div className="live-handoff-fallback" data-testid="live-handoff-fallback">
            <a href="/" className="live-handoff-action">
              <span className="live-handoff-action-body">
                <span className="live-handoff-action-label">Weekend</span>
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
