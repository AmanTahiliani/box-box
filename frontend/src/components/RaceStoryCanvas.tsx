import type { EnrichedResult, EnrichedGrid, PositionSample, Lap } from '../types'
import { gridDelta, gridDeltaClass, formatDuration, formatGap } from '../utils'

interface Props {
  data: {
    results: EnrichedResult[]
    starting_grid: EnrichedGrid[]
    positions: PositionSample[]
    laps: Lap[]
    datasets: Record<string, any>
  }
}

export function RaceStoryCanvas({ data }: Props) {
  const { results, starting_grid: grid, positions, datasets } = data
  const hasPositions = datasets['positions']?.status === 'available'

  // Position Evolution Chart Logic
  const allTimes = [...new Set(positions.map((p) => p.date))].sort()
  const hasChartData = hasPositions && allTimes.length > 0

  let chartContent = null
  if (hasChartData) {
    const tMin = new Date(allTimes[0]).getTime()
    const tMax = new Date(allTimes[allTimes.length - 1]).getTime()
    const tRange = Math.max(tMax - tMin, 1)

    const byDriver = new Map<number, Array<{ t: number; pos: number }>>()
    for (const p of positions) {
      if (!byDriver.has(p.driver_number)) byDriver.set(p.driver_number, [])
      byDriver.get(p.driver_number)!.push({
        t: (new Date(p.date).getTime() - tMin) / tRange,
        pos: p.position,
      })
    }
    for (const samples of byDriver.values()) {
      samples.sort((a, b) => a.t - b.t)
    }

    const maxPos = Math.max(...positions.map((p) => p.position), results.length, 2)
    const colorByDriver = new Map(results.map((r) => [r.driver_number, r.team_colour]))
    const acronymByDriver = new Map(results.map((r) => [r.driver_number, r.name_acronym]))

    const W = 640
    const H = 180
    const PL = 40
    const PR = 48
    const PT = 8
    const PB = 8
    const plotW = W - PL - PR
    const plotH = H - PT - PB

    const toX = (t: number) => PL + t * plotW
    const toY = (pos: number) => PT + ((pos - 1) / Math.max(maxPos - 1, 1)) * plotH

    chartContent = (
      <div className="rs-chart-container scroll-x" data-testid="position-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', minWidth: 280, maxWidth: W, display: 'block' }}
          role="img"
          aria-label="Position evolution chart"
        >
          {Array.from({ length: maxPos }, (_, i) => i + 1).map((pos) => (
            <g key={pos}>
              <line
                x1={PL}
                x2={W - PR}
                y1={toY(pos)}
                y2={toY(pos)}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
              <text
                x={PL - 4}
                y={toY(pos) + 4}
                textAnchor="end"
                fill="var(--text-3)"
                fontSize={8}
                fontFamily="var(--f-mono)"
              >
                P{pos}
              </text>
            </g>
          ))}

          {Array.from(byDriver.entries()).map(([dNum, samples]) => {
            const colour = colorByDriver.get(dNum)
            const color = colour ? `#${colour}` : '#888'
            const pts = samples.map((s) => `${toX(s.t)},${toY(s.pos)}`).join(' ')
            const last = samples[samples.length - 1]

            return (
              <g key={dNum}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {samples.map((s, i) => (
                  <circle key={i} cx={toX(s.t)} cy={toY(s.pos)} r={3} fill={color} />
                ))}
                {last && (
                  <text
                    x={toX(last.t) + 6}
                    y={toY(last.pos) + 4}
                    fill={color}
                    fontSize={9}
                    fontFamily="var(--f-mono)"
                    fontWeight={700}
                  >
                    {acronymByDriver.get(dNum) ?? dNum}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  return (
    <div className="race-story-canvas">
      {hasChartData ? (
        chartContent
      ) : (
        <div className="analysis-notice">
          <strong>Lap-by-lap positions not available.</strong> This session does not
          have ingested position samples in <code>/api/v1/race-hub</code>.
        </div>
      )}

      {results.length > 0 && (
        <div className="rs-field-list">
          {results.map((r, i) => {
            const gridPos = grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
            const isWinner = i === 0 && r.position === 1
            const pClass = r.position === 1 ? 'rs-pos-p1' : r.position === 2 ? 'rs-pos-p2' : r.position === 3 ? 'rs-pos-p3' : ''
            
            return (
              <div key={r.driver_number} className="rs-driver-row">
                <div className="rs-driver-left">
                  <div className={`rs-pos-col ${pClass}`}>{r.position}</div>
                  <div className="rs-driver-cell">
                    <div 
                      className="rs-driver-color" 
                      style={{ background: r.team_colour ? `#${r.team_colour}` : 'var(--border)' }} 
                    />
                    <div className="rs-driver-identity">
                      <span className="rs-driver-name">{r.name_acronym || r.driver_number}</span>
                      <span className="rs-driver-team">{r.team_name}</span>
                    </div>
                  </div>
                </div>

                <div className="rs-driver-right">
                  <div className="rs-metric">
                    <span>
                      <span className={gridDeltaClass(r.position, gridPos)}>
                        {gridDelta(r.position, gridPos)}
                      </span>
                    </span>
                    <span className="rs-metric-label">Grid</span>
                  </div>
                  
                  <div className="rs-metric" style={{ width: '80px' }}>
                    <span>{isWinner ? formatDuration(r.duration) : formatGap(r.gap_to_leader)}</span>
                    <span className="rs-metric-label">{isWinner ? 'Time' : 'Gap'}</span>
                  </div>
                  
                  <div className="rs-metric" style={{ width: '40px' }}>
                    <span style={{ color: r.points > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                      {r.points}
                    </span>
                    <span className="rs-metric-label">Pts</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
