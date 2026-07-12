import { useWeekendContext } from '../hooks/useWeekendContext'
import { BetweenRacesView } from '../components/weekend/BetweenRacesView'
import { BetweenSessionsView } from '../components/weekend/BetweenSessionsView'
import { LiveHandoffView } from '../components/weekend/LiveHandoffView'
import { PreSessionView } from '../components/weekend/PreSessionView'
import { WeekendError, WeekendLimited, WeekendLoading } from '../components/weekend/StatusViews'
import type { WeekendContext } from '../types'
import '../styles/weekend.css'

function renderState(context: WeekendContext, now: Date) {
  switch (context.state) {
    case 'loading':
      return <WeekendLoading />
    case 'error':
      return <WeekendError message={context.message} />
    case 'limited_data':
      return <WeekendLimited message={context.message} season={context.season} />
    case 'between_races':
    case 'post_weekend':
    case 'season_complete':
      return <BetweenRacesView context={context} now={now} />
    case 'between_sessions':
    case 'session_settling':
      return <BetweenSessionsView context={context} now={now} />
    case 'session_live':
      return <LiveHandoffView context={context} />
    case 'pre_session':
      return <PreSessionView context={context} now={now} />
    default:
      return <WeekendLimited season={context.season} />
  }
}

export function WeekendPage() {
  const { context, now } = useWeekendContext()

  return (
    <main className="wk-page" data-testid="weekend-page" data-state={context.state}>
      {renderState(context, now)}
    </main>
  )
}
