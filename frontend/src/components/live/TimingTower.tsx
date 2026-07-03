import { teamColor } from '../../utils'
import type { LiveStintData } from '../../types'
import type { LiveTimingRow } from '../../lib/live'
import {
  driverCode,
  positionDelta,
  positionDeltaClass,
  tyreClass,
  tyreLabel,
} from '../../lib/live'
import type { GapHistoryMap } from '../../lib/gapHistory'
import { GapSparkline } from './GapSparkline'
import { StintHistory } from './StintHistory'

interface Props {
  rows: LiveTimingRow[]
  stints?: Record<string, LiveStintData[]>
  history?: GapHistoryMap
  battleNumbers?: Set<string>
  pinned?: string[]
  onTogglePin?: (racingNumber: string) => void
}

function posClass(pos: number): string {
  if (pos === 1) return 'pos-p1'
  if (pos === 2) return 'pos-p2'
  if (pos === 3) return 'pos-p3'
  return 'pos-n'
}

export function TimingTower({
  rows,
  stints,
  history,
  battleNumbers,
  pinned,
  onTogglePin,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="missing-notice">
        Live timing is connected, but no driver timing rows have arrived yet.
      </div>
    )
  }

  return (
    <div className="scroll-x">
      <table className="data-table live-tower" style={{ minWidth: 620 }}>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Δ</th>
            <th>Driver</th>
            <th>Tyre</th>
            <th>Last Lap</th>
            <th>Gap</th>
            <th>Trend</th>
            <th className="hide-mobile">Best</th>
            <th className="hide-mobile">Stints</th>
            <th className="hide-mobile r">Laps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const driver = row.Driver
            const delta = positionDelta(driver)
            const deltaClass = positionDeltaClass(driver)
            const isPinned = pinned?.includes(row.RacingNumber) ?? false
            const inBattle = battleNumbers?.has(row.RacingNumber) ?? false
            return (
              <tr
                key={row.RacingNumber}
                className={[
                  driver.InPit ? 'in-pit' : '',
                  driver.PitOut ? 'pit-out' : '',
                  driver.Retired ? 'retired' : '',
                  inBattle ? 'battle-row' : '',
                  isPinned ? 'pinned-row' : '',
                  onTogglePin ? 'pinnable' : '',
                ].filter(Boolean).join(' ')}
                onClick={onTogglePin ? () => onTogglePin(row.RacingNumber) : undefined}
                title={onTogglePin ? (isPinned ? 'Click to unpin' : 'Click to pin (max 3)') : undefined}
              >
                <td className={`mono ${posClass(row.Position)}`}>{row.Position}</td>
                <td className={`pos-delta${deltaClass ? ` ${deltaClass}` : ''}`}>{delta}</td>
                <td>
                  <div className="drv-cell">
                    <div className="drv-bar" style={{ background: teamColor(row.Info?.TeamColour) }} />
                    <span className="drv-code">{driverCode(row)}</span>
                    <span className="drv-num">{row.RacingNumber}</span>
                    {isPinned && <span className="pin-mark" title="Pinned">◈</span>}
                    {driver.InPit && <span className="badge badge-pit">PIT</span>}
                    {driver.PitOut && !driver.InPit && <span className="badge badge-pit">OUT</span>}
                    {driver.Retired && <span className="badge badge-out">RET</span>}
                    {driver.KnockedOut && <span className="badge badge-knocked">KO</span>}
                    {driver.Cutoff && !driver.KnockedOut && <span className="badge badge-cutoff">CUT</span>}
                    {driver.OnFlyingLap && <span className="badge badge-flying">FL</span>}
                  </div>
                </td>
                <td>
                  <span className={`tyre-badge ${tyreClass(row.Tyre)}`}>{tyreLabel(row.Tyre)}</span>
                </td>
                <td className={driver.LastLapOB ? 'mono lap-ob' : driver.LastLapPB ? 'mono lap-pb' : 'mono'}>
                  {driver.LastLapTime || '-'}
                </td>
                <td className="mono">{driver.GapToLeader || driver.Interval || '-'}</td>
                <td className="spark-cell">
                  <GapSparkline samples={history?.[row.RacingNumber]} />
                </td>
                <td className={`hide-mobile ${driver.BestLapOB ? 'mono lap-ob' : 'mono'}`}>
                  {driver.BestLapTime || '-'}
                </td>
                <td className="hide-mobile">
                  <StintHistory stints={stints?.[row.RacingNumber]} />
                </td>
                <td className="hide-mobile mono r">{driver.NumberOfLaps || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
