import type { EnrichedResult, EnrichedGrid, PositionSample, Lap } from '../types'
import { gridDelta, gridDeltaClass } from '../utils'

interface Props {
  results: EnrichedResult[]
  grid: EnrichedGrid[]
  positions: PositionSample[]
  laps: Lap[]
  hasPositions: boolean
}

export function PositionEvolutionView({ results, grid, positions, laps: _laps, hasPositions }: Props) {
  if (!hasPositions) {
    return (
      <div>
        <div className="analysis-notice">
          <strong>Lap-by-lap positions not available.</strong> This session does not
          have ingested position samples in <code>/api/v1/race-hub</code>. Evolution
          charts require per-driver position samples over time.
        </div>

        {results.length > 0 && grid.length > 0 && (
          <>
            <div className="sec-header" style={{ marginTop: 'var(--s5)' }}>
              <span className="sec-title">Grid → Finish</span>
              <span className="sec-meta">net positions gained/lost</span>
            </div>
            <table className="data-table" style={{ maxWidth: 420 }}>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th className="hide-mobile">Team</th>
                  <th className="c">Grid</th>
                  <th className="c">Finish</th>
                  <th className="r">Δ</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const gridPos =
                    grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
                  return (
                    <tr key={r.driver_number}>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--f-mono)',
                            fontWeight: 700,
                            color: r.team_colour ? `#${r.team_colour}` : 'var(--text)',
                          }}
                        >
                          {r.name_acronym || r.driver_number}
                        </span>
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                        {r.team_name}
                      </td>
                      <td className="c mono" style={{ color: 'var(--text-3)' }}>
                        {gridPos || '—'}
                      </td>
                      <td className="c mono">{r.position}</td>
                      <td className="r">
                        <span className={gridDeltaClass(r.position, gridPos)}>
                          {gridDelta(r.position, gridPos)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }

  // Build time-indexed position series per driver
  const allTimes = [...new Set(positions.map((p) => p.date))].sort()

  if (allTimes.length === 0) {
    return <div className="missing-notice">No position samples in this dataset.</div>
  }

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
  const PR = 48 // right margin for driver labels
  const PT = 8
  const PB = 8
  const plotW = W - PL - PR
  const plotH = H - PT - PB

  const toX = (t: number) => PL + t * plotW
  const toY = (pos: number) => PT + ((pos - 1) / Math.max(maxPos - 1, 1)) * plotH

  return (
    <div data-testid="position-chart">
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', minWidth: 280, maxWidth: W, display: 'block' }}
          role="img"
          aria-label="Position evolution chart"
        >
          {/* Horizontal grid lines + P# labels */}
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

          {/* Driver lines */}
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

      {/* Grid → Finish table below chart for context */}
      {results.length > 0 && grid.length > 0 && (
        <>
          <div className="sec-header" style={{ marginTop: 'var(--s5)' }}>
            <span className="sec-title">Grid → Finish</span>
            <span className="sec-meta">net positions</span>
          </div>
          <table className="data-table" style={{ maxWidth: 360 }}>
            <thead>
              <tr>
                <th>Driver</th>
                <th className="c">Grid</th>
                <th className="c">Finish</th>
                <th className="r">Δ</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const gridPos =
                  grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
                return (
                  <tr key={r.driver_number}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--f-mono)',
                          fontWeight: 700,
                          color: r.team_colour ? `#${r.team_colour}` : 'var(--text)',
                        }}
                      >
                        {r.name_acronym || r.driver_number}
                      </span>
                    </td>
                    <td className="c mono" style={{ color: 'var(--text-3)' }}>
                      {gridPos || '—'}
                    </td>
                    <td className="c mono">{r.position}</td>
                    <td className="r">
                      <span className={gridDeltaClass(r.position, gridPos)}>
                        {gridDelta(r.position, gridPos)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
