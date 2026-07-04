import type { EnrichedResult, Stint, PitStop } from '../types'
import { compareFinishPosition } from '../utils'
import {
  TyreStintTimeline,
  type StintTimelineRow,
} from './charts/TyreStintTimeline'

interface Props {
  results: EnrichedResult[]
  stints: Stint[]
  pit_stops: PitStop[]
  hasStints: boolean
}

export function StrategyView({ results, stints, pit_stops, hasStints }: Props) {
  if (!hasStints) {
    return (
      <div>
        <div className="analysis-notice">
          <strong>Stints not available.</strong> This session does not have ingested
          tyre compound and stint ranges in <code>/api/v1/race-hub</code>. Strategy
          charts require per-driver stints: compound, lap_start, lap_end.
        </div>

        {results.length > 0 && (
          <>
            <div className="sec-header" style={{ marginTop: 'var(--s5)' }}>
              <span className="sec-title">Laps Completed</span>
              <span className="sec-meta">from results — hint at pit count</span>
            </div>
            <table className="data-table" style={{ maxWidth: 360 }}>
              <thead>
                <tr>
                  <th className="c" style={{ width: 28 }}>P</th>
                  <th>Driver</th>
                  <th className="r">Laps</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.driver_number}>
                    <td className="c mono" style={{ color: 'var(--text-3)' }}>
                      {r.position}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--f-mono)',
                          fontWeight: 700,
                          color: r.team_colour ? `#${r.team_colour}` : 'var(--text)',
                        }}
                      >
                        {r.name_acronym || r.driver_number}
                      </span>
                    </td>
                    <td className="r mono" style={{ color: r.number_of_laps > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                      {r.number_of_laps > 0 ? r.number_of_laps : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }

  const sortedDrivers = [...results].sort((a, b) => {
    const cmp = compareFinishPosition(a.position, b.position)
    return cmp !== 0 ? cmp : a.driver_number - b.driver_number
  })

  const totalLaps = Math.max(
    ...stints.map((s) => s.lap_end),
    ...results.map((r) => r.number_of_laps),
    1,
  )

  const timelineRows: StintTimelineRow[] = sortedDrivers.map((driver) => ({
    label: driver.name_acronym || String(driver.driver_number),
    color: driver.team_colour ? `#${driver.team_colour}` : '#888',
    stints: stints
      .filter((s) => s.driver_number === driver.driver_number)
      .map((s) => ({
        compound: s.compound,
        lapStart: s.lap_start,
        lapEnd: s.lap_end,
        isNew: s.tyre_age_at_start === 0,
      })),
    pitStops: pit_stops
      .filter((p) => p.driver_number === driver.driver_number)
      .map((p) => p.lap_number)
      .sort((a, b) => a - b),
  }))

  return (
    <div data-testid="strategy-chart">
      <TyreStintTimeline rows={timelineRows} totalLaps={totalLaps} />
    </div>
  )
}
