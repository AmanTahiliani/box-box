import type { EnrichedResult, EnrichedGrid } from '../types'
import { gridDelta, gridDeltaClass } from '../utils'

interface Props {
  results: EnrichedResult[]
  grid: EnrichedGrid[]
  hasPositions: boolean
}

export function PositionEvolutionView({ results, grid, hasPositions }: Props) {
  if (!hasPositions) {
    return (
      <div>
        <div className="analysis-notice">
          <strong>Lap-by-lap positions not available.</strong> The backend does not
          yet expose position samples in <code>/api/v1/race-hub</code>. Evolution
          charts require per-driver position per lap.
        </div>

        {results.length > 0 && grid.length > 0 && (
          <>
            <div className="sec-header" style={{ marginTop: 'var(--s5)' }}>
              <span className="sec-title">Grid → Finish</span>
              <span className="sec-meta">net positions gained/lost</span>
            </div>
            <table className="data-table" style={{ maxWidth: 420 }}>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th className="hide-mobile">Team</th>
                  <th className="c">Grid</th>
                  <th className="c">Finish</th>
                  <th className="r">Δ</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const gridPos =
                    grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
                  return (
                    <tr key={r.driver_number}>
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
                      <td className="hide-mobile" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                        {r.team_name}
                      </td>
                      <td className="c mono" style={{ color: 'var(--text-3)' }}>
                        {gridPos || '—'}
                      </td>
                      <td className="c mono">{r.position}</td>
                      <td className="r">
                        <span className={gridDeltaClass(r.position, gridPos)}>
                          {gridDelta(r.position, gridPos)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }

  // Placeholder for when position samples are available
  return (
    <div className="missing-notice">Position evolution chart: not yet implemented.</div>
  )
}
