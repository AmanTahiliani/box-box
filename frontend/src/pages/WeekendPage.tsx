import { useWeekendContext } from '../hooks/useWeekendContext'
import { BetweenRacesView } from '../components/weekend/BetweenRacesView'
import { BetweenSessionsView } from '../components/weekend/BetweenSessionsView'
import { LiveHandoffView } from '../components/weekend/LiveHandoffView'
import { PreSessionView } from '../components/weekend/PreSessionView'
import { WeekendError, WeekendLimited, WeekendLoading } from '../components/weekend/StatusViews'
import { WeekendFocusBanner } from '../components/weekend/WeekendFocusBanner'
import { DataNotice } from '../components/RouteState'
import { noticeMessage, type DataAvailability } from '../lib/availability'
import { resolveViewState } from '../lib/weekendContext'
import type {
  WeekendBriefingItem,
  WeekendChampionshipImpact,
  WeekendContext,
  WeekendViewState,
} from '../types'
import '../styles/weekend.css'

interface RenderArgs {
  context: WeekendContext
  now: Date
  championship?: WeekendChampionshipImpact
  briefing: WeekendBriefingItem[]
  /** When true (the /preview alias), foreground the preparation surface. */
  preview: boolean
}

function renderState(view: WeekendViewState, args: RenderArgs) {
  const { context, now, championship, briefing, preview } = args
  // The /preview alias always resolves to the preparation surface as long as
  // there is a next event to prepare for, regardless of the temporal state. This
  // keeps saved /preview links and the "Prepare for …" CTA meaningful instead of
  // redirecting straight back to the same between-races screen.
  if (preview && context.next_meeting) {
    return <PreSessionView context={context} now={now} />
  }

  switch (view) {
    case 'no_season':
      return <WeekendLimited season={context.season} />
    case 'between_weekends':
    case 'post_weekend':
    case 'season_complete':
      return (
        <BetweenRacesView
          context={context}
          now={now}
          view={view}
          championship={championship}
          briefing={briefing}
        />
      )
    case 'between_sessions':
    case 'session_settling':
      return <BetweenSessionsView context={context} now={now} view={view} briefing={briefing} />
    case 'session_live':
      return <LiveHandoffView context={context} />
    case 'pre_session':
      return <PreSessionView context={context} now={now} />
    default:
      return <WeekendLimited season={context.season} />
  }
}

function WeekendAvailabilityNotices({
  availabilityNotice,
  supplementsLimited,
  onRetry,
  retrying,
}: {
  availabilityNotice: DataAvailability | null
  supplementsLimited: boolean
  onRetry: () => void
  retrying: boolean
}) {
  // Prefer a single reported freshness notice; Limited for failed supplements
  // only when freshness itself is not already disclosing a stronger state.
  if (availabilityNotice) {
    return (
      <DataNotice
        availability={availabilityNotice}
        message={noticeMessage(availabilityNotice)}
        onRetry={onRetry}
        retrying={retrying}
        testId="weekend-data-notice"
      />
    )
  }
  if (supplementsLimited) {
    return (
      <DataNotice
        availability="limited"
        message="Championship or briefing supplements are unavailable. Weekend schedule context is still shown."
        onRetry={onRetry}
        retrying={retrying}
        testId="weekend-data-notice"
      />
    )
  }
  return null
}

export function WeekendPage({
  preview = false,
  focusMeetingKey,
  focusSessionKey,
}: {
  preview?: boolean
  /** Restored from `/?meeting_key=` when returning from Race Hub analysis. */
  focusMeetingKey?: number
  /** Restored from `/?session_key=` when returning from Race Hub analysis. */
  focusSessionKey?: number
}) {
  const {
    context,
    loadState,
    error,
    championship,
    briefing,
    availabilityNotice,
    supplementsLimited,
    now,
    refetch,
    isFetching,
  } = useWeekendContext()
  const hasFocus =
    (focusMeetingKey != null && focusMeetingKey > 0) ||
    (focusSessionKey != null && focusSessionKey > 0)

  if (loadState === 'loading') {
    return (
      <main className="wk-page" data-testid="weekend-page" data-state="loading">
        <WeekendLoading />
      </main>
    )
  }

  if (loadState === 'error' || context == null) {
    return (
      <main className="wk-page" data-testid="weekend-page" data-state="error">
        <WeekendError error={error} onRetry={refetch} retrying={isFetching} />
      </main>
    )
  }

  const view = resolveViewState(context)

  return (
    <main
      className="wk-page"
      data-testid="weekend-page"
      data-state={view}
      data-temporal-state={context.temporal_state}
      data-preview={preview ? 'true' : undefined}
      data-meeting-key={focusMeetingKey ?? undefined}
      data-session-key={focusSessionKey ?? undefined}
    >
      {hasFocus && (
        <WeekendFocusBanner meetingKey={focusMeetingKey} sessionKey={focusSessionKey} />
      )}
      <WeekendAvailabilityNotices
        availabilityNotice={availabilityNotice}
        supplementsLimited={supplementsLimited}
        onRetry={refetch}
        retrying={isFetching}
      />
      {renderState(view, { context, now, championship, briefing, preview })}
    </main>
  )
}
