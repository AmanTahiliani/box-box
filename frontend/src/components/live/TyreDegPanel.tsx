import { useEffect, useMemo, useState } from 'react'
import { teamColor } from '../../utils'
import type { LiveTimingRow } from '../../lib/live'
import { compoundClass, driverCode, tyreLabel } from '../../lib/live'
import { sparklinePoints } from '../../lib/gapHistory'
import { isRaceSession } from '../../lib/battles'
import type { StintHistoryMap } from '../../lib/tyredeg'
import {
  PIT_LOSS_SECONDS,
  degradationModel,
  estimatePitRejoin,
  formatSlope,
  recordStintSamples,
  stintInputFromRow,
} from '../../lib/tyredeg'
import '../../styles/tyredeg.css'

const TOP_DRIVER_COUNT = 10
const SPARK_WIDTH = 64
const SPARK_HEIGHT = 16

interface Props {
  rows: LiveTimingRow[]
  sessionType: string | undefined
  pinned: string[]
}

function StintSparkline({ seconds }: { seconds: number[] }) {
  if (seconds.length < 2) return <span className="tyredeg-spark-empty">·</span>
  const points = sparklinePoints(seconds, SPARK_WIDTH, SPARK_HEIGHT)
  return (
    <svg
      className="tyredeg-spark"
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function TyreDegPanel({ rows, sessionType, pinned }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [stints, setStints] = useState<StintHistoryMap>({})

  // One lap-history update per received snapshot (rows is rebuilt per snapshot).
  useEffect(() => {
    if (rows.length === 0) return
    setStints((prev) => recordStintSamples(prev, rows.map(stintInputFromRow)))
  }, [rows])

  const isRace = isRaceSession(sessionType)

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.Position > 0 &&
          !row.Driver.Retired &&
          (row.Position <= TOP_DRIVER_COUNT || pinned.includes(row.RacingNumber)),
      ),
    [rows, pinned],
  )

  if (visible.length === 0) return null

  return (
    <section className="live-tyredeg-panel" data-testid="tyredeg-panel">
      <button
        type="button"
        className="sec-header tyredeg-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <span className="sec-title">Tyre Deg &amp; Pit Window</span>
        {isRace && <span className="sec-meta">rejoin assumes ~{PIT_LOSS_SECONDS}s pit loss</span>}
        <span className="tyredeg-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="tyredeg-rows">
          {visible.map((row) => {
            const model = degradationModel(stints[row.RacingNumber]?.samples ?? [])
            const rejoin = isRace ? estimatePitRejoin(rows, row.RacingNumber) : null
            return (
              <div className="tyredeg-row" key={row.RacingNumber} data-testid="tyredeg-row">
                <span className="tyredeg-pos mono">P{row.Position}</span>
                <span className="drv-bar" style={{ background: teamColor(row.Info?.TeamColour) }} />
                <span className="drv-code">{driverCode(row)}</span>
                <span className={`tyre-badge ${compoundClass(row.Tyre?.Compound)}`}>{tyreLabel(row.Tyre)}</span>
                {model ? (
                  <>
                    <span className={`tyredeg-trend tyredeg-trend-${model.trend}`}>
                      <StintSparkline seconds={model.samples.map((sample) => sample.seconds)} />
                    </span>
                    <span className={`tyredeg-slope mono tyredeg-trend-${model.trend}`}>
                      {formatSlope(model.slope)}
                    </span>
                  </>
                ) : (
                  <span className="tyredeg-warmup">warming up</span>
                )}
                {rejoin && (
                  <span className="tyredeg-rejoin mono" title={`Pits now: rejoins ~P${rejoin.rejoinPosition}`}>
                    → ~P{rejoin.rejoinPosition}
                    {rejoin.aheadCode && rejoin.behindCode && (
                      <span className="tyredeg-rejoin-between">
                        {rejoin.aheadCode} · {rejoin.behindCode}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
