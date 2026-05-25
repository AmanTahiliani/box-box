import type { Lap } from '../types'
import { formatLapTime } from '../utils'

interface Props {
  laps: Lap[]
}

interface DriverLapSummary {
  driver_number: number
  total: number
  best: Lap | null
  lastLap: number
  pitOuts: number
}

export function LapsView({ laps }: Props) {
  if (laps.length === 0) {
    return (
      <div className="missing-notice">
        Laps not ingested. Run <code>box-box --ingest-session &lt;key&gt;</code> to
        load this dataset.
      </div>
    )
  }

  const byDriver = new Map<number, DriverLapSummary>()
  for (const lap of laps) {
    const summary =
      byDriver.get(lap.driver_number) ??
      {
        driver_number: lap.driver_number,
        total: 0,
        best: null,
        lastLap: 0,
        pitOuts: 0,
      }

    summary.total += 1
    summary.lastLap = Math.max(summary.lastLap, lap.lap_number)
    if (lap.is_pit_out_lap) summary.pitOuts += 1
    if (
      lap.lap_duration != null &&
      lap.lap_duration > 0 &&
      (!summary.best ||
        summary.best.lap_duration == null ||
        lap.lap_duration < summary.best.lap_duration)
    ) {
      summary.best = lap
    }

    byDriver.set(lap.driver_number, summary)
  }

  const rows = [...byDriver.values()].sort((a, b) => {
    const aBest = a.best?.lap_duration ?? Number.POSITIVE_INFINITY
    const bBest = b.best?.lap_duration ?? Number.POSITIVE_INFINITY
    if (aBest !== bBest) return aBest - bBest
    return a.driver_number - b.driver_number
  })

  const fastest = rows.find((row) => row.best?.lap_duration != null)?.best

  return (
    <div className="scroll-x" data-testid="laps-view">
      <table className="data-table" style={{ minWidth: 460, maxWidth: 620 }}>
        <thead>
          <tr>
            <th>Driver</th>
            <th className="c">Best Lap</th>
            <th className="r">Best Time</th>
            <th className="r hide-mobile">Laps</th>
            <th className="r hide-mobile">Pit Outs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isFastest =
              fastest &&
              row.best?.driver_number === fastest.driver_number &&
              row.best?.lap_number === fastest.lap_number

            return (
              <tr key={row.driver_number}>
                <td className="mono" style={{ fontWeight: 700 }}>
                  #{row.driver_number}
                </td>
                <td className="c mono">
                  {row.best ? (
                    <>
                      {row.best.lap_number}
                      {isFastest && (
                        <span style={{ color: 'var(--red)', marginLeft: 6 }}>FASTEST</span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="r">{formatLapTime(row.best?.lap_duration)}</td>
                <td className="r hide-mobile">{row.lastLap || row.total}</td>
                <td className="r hide-mobile" style={{ color: 'var(--text-3)' }}>
                  {row.pitOuts || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
