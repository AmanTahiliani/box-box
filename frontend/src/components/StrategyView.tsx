import type { EnrichedResult } from '../types'

interface Props {
  results: EnrichedResult[]
  hasStints: boolean
}

export function StrategyView({ results, hasStints }: Props) {
  if (!hasStints) {
    return (
      <div>
        <div className="analysis-notice">
          <strong>Stints not available.</strong> The backend does not yet expose
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

  // Placeholder for when stints data is available
  return (
    <div className="missing-notice">Strategy chart: not yet implemented.</div>
  )
}
