import { teamColor } from '../../utils'
import type { LiveTimingRow } from '../../lib/live'
import { driverCode, tyreClass, tyreLabel } from '../../lib/live'
import type { GapHistoryMap } from '../../lib/gapHistory'
import { GapSparkline } from './GapSparkline'

interface Props {
  rows: LiveTimingRow[]
  history: GapHistoryMap
  pinned: string[]
  onToggle: (racingNumber: string) => void
}

export function PinnedDrivers({ rows, history, pinned, onToggle }: Props) {
  if (pinned.length === 0) return null

  const rowsByNumber = new Map(rows.map((row) => [row.RacingNumber, row]))

  return (
    <div className="pinned-strip" data-testid="pinned-strip">
      {pinned.map((number) => {
        const row = rowsByNumber.get(number)
        if (!row) {
          return (
            <button
              type="button"
              className="pinned-card pinned-card-missing"
              key={number}
              onClick={() => onToggle(number)}
              title="Unpin driver"
            >
              <span className="drv-code">#{number}</span>
              <span className="pinned-nodata">no data</span>
              <span className="pinned-unpin" aria-hidden="true">×</span>
            </button>
          )
        }

        const driver = row.Driver
        const gap = driver.Interval || driver.GapToLeader || '-'
        return (
          <button
            type="button"
            className="pinned-card"
            key={number}
            onClick={() => onToggle(number)}
            title="Unpin driver"
          >
            <span className="pinned-pos mono">P{row.Position}</span>
            <span className="drv-bar" style={{ background: teamColor(row.Info?.TeamColour) }} />
            <span className="drv-code">{driverCode(row)}</span>
            <span className={`tyre-badge ${tyreClass(row.Tyre)}`}>{tyreLabel(row.Tyre)}</span>
            <span className="pinned-gap mono">{gap}</span>
            <GapSparkline samples={history[number]} />
            {driver.InPit && <span className="badge badge-pit">PIT</span>}
            {driver.Retired && <span className="badge badge-out">RET</span>}
            <span className="pinned-unpin" aria-hidden="true">×</span>
          </button>
        )
      })}
    </div>
  )
}
