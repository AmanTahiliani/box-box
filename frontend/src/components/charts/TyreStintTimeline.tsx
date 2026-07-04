import { compoundClass } from '../../lib/live'
import '../../styles/stint-timeline.css'

export interface StintTimelineStint {
  compound: string
  lapStart: number
  lapEnd: number
  isNew?: boolean
}

export interface StintTimelineRow {
  label: string
  color: string
  stints: StintTimelineStint[]
}

interface TyreStintTimelineProps {
  rows: StintTimelineRow[]
  totalLaps: number
}

const SVG_W = 640
const LEFT = 48
const RIGHT = 12
const ROW_H = 28
const BAR_H = 14
const BAR_Y = 7
const AXIS_H = 20
const BAR_W = SVG_W - LEFT - RIGHT

const COMPOUND_ORDER = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const

function compoundLabel(compound: string): string {
  const upper = compound.toUpperCase()
  if (upper === 'INTERMEDIATE') return 'Intermediate'
  return upper.charAt(0) + upper.slice(1).toLowerCase()
}

function stintLength(stint: StintTimelineStint): number {
  return stint.lapEnd - stint.lapStart + 1
}

function stintTitle(stint: StintTimelineStint): string {
  const length = stintLength(stint)
  return `${compoundLabel(stint.compound)} · L${stint.lapStart}–${stint.lapEnd} · ${length} lap${length === 1 ? '' : 's'}`
}

function lapX(lap: number, totalLaps: number): number {
  return LEFT + (lap / totalLaps) * BAR_W
}

function stintBarX(stint: StintTimelineStint, totalLaps: number): number {
  return LEFT + ((stint.lapStart - 1) / totalLaps) * BAR_W
}

function stintBarW(stint: StintTimelineStint, totalLaps: number): number {
  return Math.max(2, (stintLength(stint) / totalLaps) * BAR_W)
}

function axisTicks(totalLaps: number): number[] {
  const ticks: number[] = []
  for (let lap = 0; lap <= totalLaps; lap += 10) {
    ticks.push(lap)
  }
  return ticks
}

function collectUsedCompounds(rows: StintTimelineRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    for (const stint of row.stints) {
      seen.add(stint.compound.toUpperCase())
    }
  }
  const ordered = COMPOUND_ORDER.filter((c) => seen.has(c))
  const extras = [...seen]
    .filter((c) => !COMPOUND_ORDER.includes(c as (typeof COMPOUND_ORDER)[number]))
    .sort()
  return [...ordered, ...extras]
}

export function TyreStintTimeline({ rows, totalLaps }: TyreStintTimelineProps) {
  const safeTotal = Math.max(totalLaps, 1)
  const usedCompounds = collectUsedCompounds(rows)
  const ticks = axisTicks(safeTotal)
  const chartH = rows.length * ROW_H
  const svgH = chartH + AXIS_H + 4

  if (rows.length === 0) {
    return (
      <div className="stint-timeline" data-testid="stint-timeline-empty">
        <div className="stint-timeline__empty">No stint data to display.</div>
      </div>
    )
  }

  return (
    <div className="stint-timeline" data-testid="stint-timeline">
      <div className="stint-timeline__scroll">
        <svg
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          className="stint-timeline__svg"
          role="img"
          aria-label="Tyre stint timeline"
        >
          {rows.map((row, i) => {
            const rowY = i * ROW_H
            return (
              <g key={`${row.label}-${i}`} transform={`translate(0,${rowY})`}>
                <text
                  x={LEFT - 5}
                  y={BAR_Y + BAR_H / 2 + 4}
                  textAnchor="end"
                  fill={row.color}
                  className="stint-timeline__label"
                >
                  {row.label}
                </text>

                {row.stints.map((stint, si) => (
                  <rect
                    key={si}
                    x={stintBarX(stint, safeTotal)}
                    y={BAR_Y}
                    width={stintBarW(stint, safeTotal)}
                    height={BAR_H}
                    rx={3}
                    className={`stint-timeline__bar ${compoundClass(stint.compound)}${stint.isNew ? ' stint-timeline__bar--new' : ''}`}
                  >
                    <title>{stintTitle(stint)}</title>
                  </rect>
                ))}
              </g>
            )
          })}

          <g transform={`translate(0,${chartH})`}>
            <line
              x1={LEFT}
              x2={LEFT + BAR_W}
              y1={0}
              y2={0}
              className="stint-timeline__axis-line"
            />
            {ticks.map((lap) => (
              <g key={lap}>
                <line
                  x1={lapX(lap, safeTotal)}
                  x2={lapX(lap, safeTotal)}
                  y1={0}
                  y2={4}
                  className="stint-timeline__axis-line"
                />
                <text
                  x={lapX(lap, safeTotal)}
                  y={14}
                  textAnchor="middle"
                  className="stint-timeline__axis-tick"
                >
                  {lap}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="stint-timeline__legend">
        {usedCompounds.map((compound) => (
          <span key={compound} className="stint-timeline__legend-item">
            <span
              className={`stint-timeline__legend-swatch ${compoundClass(compound)}`}
              data-testid={`legend-${compound.toLowerCase()}`}
            />
            {compoundLabel(compound)}
          </span>
        ))}
        <span className="stint-timeline__meta">{safeTotal} laps</span>
      </div>
    </div>
  )
}
