import { useCallback, useMemo, useRef, useState } from 'react'
import {
  computeCumulativeDeltas,
  deltaPolylineSegments,
  formatDeltaSeconds,
  type DeltaSeries,
  type DriverDeltaResult,
} from '../../lib/delta'
import '../../styles/delta-graph.css'

export type { DeltaSeries }

export interface DeltaTimeGraphProps {
  series: DeltaSeries[]
  referenceLabel?: string
}

const W = 640
const H = 220
const PL = 44
const PR = 16
const PT = 12
const PB = 28

function lapCount(series: ReadonlyArray<DeltaSeries>): number {
  return series.reduce((max, s) => Math.max(max, s.lapTimes.length), 0)
}

function yExtent(drivers: ReadonlyArray<DriverDeltaResult>): { min: number; max: number } {
  let min = 0
  let max = 0
  for (const driver of drivers) {
    for (const delta of driver.deltas) {
      if (delta === null) continue
      min = Math.min(min, delta)
      max = Math.max(max, delta)
    }
  }
  if (min === max) {
    const pad = 1
    return { min: min - pad, max: max + pad }
  }
  const span = max - min
  const pad = span * 0.08
  return { min: min - pad, max: max + pad }
}

function niceYTicks(min: number, max: number): number[] {
  const span = max - min
  if (span <= 0) return [0]
  const rough = span / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = Math.ceil(rough / magnitude) * magnitude
  const ticks: number[] = []
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }
  if (!ticks.some((t) => Math.abs(t) < step * 0.01)) {
    ticks.push(0)
    ticks.sort((a, b) => a - b)
  }
  return ticks
}

export function DeltaTimeGraph({ series, referenceLabel }: DeltaTimeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverLap, setHoverLap] = useState<number | null>(null)

  const drivers = useMemo(
    () => computeCumulativeDeltas(series, referenceLabel),
    [series, referenceLabel],
  )

  const laps = useMemo(() => lapCount(series), [series])
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const { min: yMin, max: yMax } = useMemo(() => yExtent(drivers), [drivers])
  const yTicks = useMemo(() => niceYTicks(yMin, yMax), [yMin, yMax])

  const toX = useCallback(
    (lapIndex: number) => {
      if (laps <= 1) return PL + plotW / 2
      return PL + (lapIndex / (laps - 1)) * plotW
    },
    [laps, plotW],
  )

  const toY = useCallback(
    (delta: number) => {
      const span = yMax - yMin || 1
      return PT + ((delta - yMin) / span) * plotH
    },
    [yMin, yMax, plotH],
  )

  const lapTickNumbers = useMemo(() => {
    const ticks: number[] = []
    for (let lap = 5; lap <= laps; lap += 5) {
      ticks.push(lap)
    }
    return ticks
  }, [laps])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      if (!svgRef.current || laps === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      if (rect.width <= 0) return
      const x = ((e.clientX - rect.left) / rect.width) * W
      const frac = Math.max(0, Math.min(1, (x - PL) / plotW))
      const lapIndex = laps <= 1 ? 0 : Math.round(frac * (laps - 1))
      if (!Number.isFinite(lapIndex)) return
      setHoverLap(Math.max(0, Math.min(laps - 1, lapIndex)))
    },
    [laps, plotW],
  )

  const handlePointerLeave = useCallback(() => setHoverLap(null), [])

  if (series.length === 0 || laps === 0) {
    return (
      <div className="delta-graph" data-testid="delta-time-graph-empty">
        <p className="delta-graph-empty">No lap data to compare.</p>
      </div>
    )
  }

  if (drivers.length === 0) {
    return (
      <div className="delta-graph" data-testid="delta-time-graph-empty">
        <p className="delta-graph-empty">Select at least two drivers to compare.</p>
      </div>
    )
  }

  const hoverX = hoverLap !== null ? toX(hoverLap) : null
  const tooltipRows = hoverLap !== null
    ? drivers
        .map((d) => {
          const delta = d.deltas[hoverLap]
          if (delta == null) return null
          return { label: d.label, color: d.color, delta }
        })
        .filter((row): row is { label: string; color: string; delta: number } => row !== null)
    : []

  const tooltipH = 18 + tooltipRows.length * 14
  const tooltipW = 120
  const tooltipX = hoverX !== null ? Math.min(Math.max(hoverX + 8, PL), W - PR - tooltipW) : 0
  const tooltipY = PT

  return (
    <div className="delta-graph" data-testid="delta-time-graph">
      <svg
        ref={svgRef}
        className="delta-graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Cumulative delta time chart"
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={PL}
              x2={W - PR}
              y1={toY(tick)}
              y2={toY(tick)}
              className={Math.abs(tick) < 1e-9 ? 'delta-graph-zero-line' : 'delta-graph-grid-line'}
              data-testid={Math.abs(tick) < 1e-9 ? 'delta-zero-line' : undefined}
            />
            <text
              x={PL - 6}
              y={toY(tick) + 3}
              textAnchor="end"
              className="delta-graph-axis-label"
            >
              {formatDeltaSeconds(tick)}
            </text>
          </g>
        ))}

        {lapTickNumbers.map((lap) => {
          const x = toX(lap - 1)
          return (
            <g key={`lap-${lap}`}>
              <line
                x1={x}
                x2={x}
                y1={H - PB}
                y2={H - PB + 4}
                className="delta-graph-grid-line"
              />
              <text
                x={x}
                y={H - PB + 16}
                textAnchor="middle"
                className="delta-graph-axis-label"
              >
                {lap}
              </text>
            </g>
          )
        })}

        {drivers.map((driver) => {
          const segments = deltaPolylineSegments(driver.deltas, (lapIndex, delta) =>
            `${toX(lapIndex).toFixed(1)},${toY(delta).toFixed(1)}`,
          )
          return (
            <g key={driver.label} data-testid={`delta-line-${driver.label}`}>
              {segments.map((points, i) => (
                <polyline
                  key={`${driver.label}-${i}`}
                  points={points}
                  className="delta-graph-driver-line"
                  stroke={driver.color}
                />
              ))}
            </g>
          )
        })}

        {hoverX !== null && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PT}
              y2={H - PB}
              className="delta-graph-crosshair"
              data-testid="delta-crosshair"
            />
            {tooltipRows.length > 0 && (
              <g className="delta-graph-tooltip" data-testid="delta-tooltip">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipW}
                  height={tooltipH}
                  rx={4}
                  className="delta-graph-tooltip-bg"
                />
                <text
                  x={tooltipX + 8}
                  y={tooltipY + 14}
                  className="delta-graph-tooltip-title"
                >
                  Lap {hoverLap! + 1}
                </text>
                {tooltipRows.map((row, i) => (
                  <text
                    key={row.label}
                    x={tooltipX + 8}
                    y={tooltipY + 28 + i * 14}
                    className="delta-graph-tooltip-row"
                    fill={row.color}
                  >
                    {row.label} {formatDeltaSeconds(row.delta)}
                  </text>
                ))}
              </g>
            )}
          </>
        )}

        <rect
          x={PL}
          y={PT}
          width={plotW}
          height={plotH}
          fill="transparent"
          className="delta-graph-hover-layer"
          onPointerMove={handlePointerMove}
          onMouseMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onMouseLeave={handlePointerLeave}
        />
      </svg>
    </div>
  )
}
