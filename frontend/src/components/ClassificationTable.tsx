import type { EnrichedResult, EnrichedGrid } from '../types'
import { DriverCell } from './DriverCell'
import { formatDuration, formatGap, positionClass, gridDelta, gridDeltaClass } from '../utils'

interface Props {
  results: EnrichedResult[]
  grid: EnrichedGrid[]
}

export function ClassificationTable({ results, grid }: Props) {
  if (results.length === 0) {
    return (
      <div className="missing-notice">
        Results not ingested. Run{' '}
        <code>box-box --ingest-session &lt;key&gt;</code> to load this dataset.
      </div>
    )
  }

  const gridByDriver = Object.fromEntries(grid.map((g) => [g.driver_number, g.position]))

  const isRace = results.some((r) => r.points > 0 || r.number_of_laps > 0)

  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 520 }}>
        <thead>
          <tr>
            <th className="c" style={{ width: 28 }}>P</th>
            <th>Driver</th>
            <th className="hide-mobile">Team</th>
            {isRace && <th className="c hide-mobile">Grid</th>}
            {isRace && <th className="c hide-mobile">Δ</th>}
            <th className="r">Time / Gap</th>
            {isRace && <th className="r hide-mobile">Pts</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const gridPos = gridByDriver[r.driver_number] ?? 0
            const timeStr = r.dnf
              ? null
              : r.dns
              ? null
              : r.dsq
              ? null
              : r.position === 1
              ? formatDuration(r.duration)
              : formatGap(r.gap_to_leader)

            return (
              <tr key={r.driver_number}>
                <td className="c">
                  <span className={positionClass(r.position)}>{r.position}</span>
                </td>
                <td>
                  <DriverCell
                    acronym={r.name_acronym || String(r.driver_number)}
                    number={r.driver_number}
                    colour={r.team_colour}
                  />
                </td>
                <td className="hide-mobile" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                  {r.team_name}
                </td>
                {isRace && (
                  <td className="c mono hide-mobile" style={{ color: 'var(--text-3)' }}>
                    {gridPos || '—'}
                  </td>
                )}
                {isRace && (
                  <td className="c hide-mobile">
                    <span className={gridDeltaClass(r.position, gridPos)}>
                      {gridDelta(r.position, gridPos)}
                    </span>
                  </td>
                )}
                <td className="r">
                  {r.dnf && <span className="status-dnf">DNF</span>}
                  {r.dns && <span className="status-dns">DNS</span>}
                  {r.dsq && <span className="status-dsq">DSQ</span>}
                  {!r.dnf && !r.dns && !r.dsq && (
                    <span style={{ fontFamily: 'var(--f-mono)' }}>{timeStr ?? '—'}</span>
                  )}
                </td>
                {isRace && (
                  <td className="r hide-mobile" style={{ fontWeight: r.points > 0 ? 700 : 400, color: r.points > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                    {r.points > 0 ? r.points : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
