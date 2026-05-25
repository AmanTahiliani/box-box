import { teamColor } from '../../utils'
import type { LiveStreamData } from '../../types'
import { driverCode, positionDelta, sortLiveTimingRows, tyreClass, tyreLabel } from '../../lib/live'

interface Props {
  snapshot: LiveStreamData
}

export function TimingTower({ snapshot }: Props) {
  const rows = sortLiveTimingRows(snapshot)

  if (rows.length === 0) {
    return (
      <div className="missing-notice">
        Live timing is connected, but no driver timing rows have arrived yet.
      </div>
    )
  }

  return (
    <div className="scroll-x">
      <table className="data-table live-tower" style={{ minWidth: 520 }}>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Δ</th>
            <th>Driver</th>
            <th>Tyre</th>
            <th>Last Lap</th>
            <th>Gap</th>
            <th>Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const driver = row.Driver
            return (
              <tr
                key={row.RacingNumber}
                className={[
                  driver.InPit ? 'in-pit' : '',
                  driver.PitOut ? 'pit-out' : '',
                  driver.Retired ? 'retired' : '',
                ].filter(Boolean).join(' ')}
              >
                <td className="mono pos-n">{row.Position}</td>
                <td className="pos-delta">{positionDelta(driver)}</td>
                <td>
                  <div className="drv-cell">
                    <div className="drv-bar" style={{ background: teamColor(row.Info?.TeamColour) }} />
                    <span className="drv-code">{driverCode(row)}</span>
                    <span className="drv-num">{row.RacingNumber}</span>
                    {driver.InPit && <span className="badge badge-pit">PIT</span>}
                    {driver.Retired && <span className="badge badge-out">OUT</span>}
                  </div>
                </td>
                <td>
                  <span className={`tyre-badge ${tyreClass(row.Tyre)}`}>{tyreLabel(row.Tyre)}</span>
                </td>
                <td className={driver.LastLapOB ? 'mono lap-ob' : driver.LastLapPB ? 'mono lap-pb' : 'mono'}>
                  {driver.LastLapTime || '-'}
                </td>
                <td className="mono">{driver.GapToLeader || driver.Interval || '-'}</td>
                <td className={driver.BestLapOB ? 'mono lap-ob' : 'mono'}>{driver.BestLapTime || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
