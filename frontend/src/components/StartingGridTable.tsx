import type { EnrichedGrid } from '../types'
import { DriverCell } from './DriverCell'
import { formatLapTime } from '../utils'

interface Props {
  grid: EnrichedGrid[]
}

export function StartingGridTable({ grid }: Props) {
  if (grid.length === 0) {
    return (
      <div className="missing-notice">
        Starting grid not ingested. Run{' '}
        <code>box-box --ingest-session &lt;key&gt;</code> to load this dataset.
      </div>
    )
  }

  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 380 }}>
        <thead>
          <tr>
            <th className="c" style={{ width: 28 }}>P</th>
            <th>Driver</th>
            <th className="hide-mobile">Team</th>
            <th className="r">Lap Time</th>
          </tr>
        </thead>
        <tbody>
          {grid.map((g) => (
            <tr key={g.driver_number}>
              <td className="c">
                <span style={{ fontFamily: 'var(--f-mono)', color: 'var(--text-2)' }}>
                  {g.position}
                </span>
              </td>
              <td>
                <DriverCell
                  acronym={g.name_acronym || String(g.driver_number)}
                  number={g.driver_number}
                  colour={g.team_colour}
                />
              </td>
              <td className="hide-mobile" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                {g.team_name}
              </td>
              <td className="r" style={{ fontFamily: 'var(--f-mono)' }}>
                {g.lap_duration != null ? formatLapTime(g.lap_duration) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
