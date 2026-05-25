import type { EnrichedResult, Stint, PitStop } from '../types'

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#e8002d',
  MEDIUM: '#ffd600',
  HARD: '#e8e8e4',
  INTERMEDIATE: '#39b54a',
  WET: '#0067ff',
}

function compoundColor(c: string): string {
  return COMPOUND_COLORS[c.toUpperCase()] ?? '#666'
}

function compoundInitial(c: string): string {
  const abbr: Record<string, string> = {
    SOFT: 'S',
    MEDIUM: 'M',
    HARD: 'H',
    INTERMEDIATE: 'I',
    WET: 'W',
  }
  return abbr[c.toUpperCase()] ?? c[0] ?? '?'
}

interface Props {
  results: EnrichedResult[]
  stints: Stint[]
  pit_stops: PitStop[]
  hasStints: boolean
}

export function StrategyView({ results, stints, pit_stops, hasStints }: Props) {
  if (!hasStints) {
    return (
      <div>
        <div className="analysis-notice">
          <strong>Stints not available.</strong> This session does not have ingested
          tyre compound and stint ranges in <code>/api/v1/race-hub</code>. Strategy
          charts require per-driver stints: compound, lap_start, lap_end.
        </div>

        {results.length > 0 && (
          <>
            <div className="sec-header" style={{ marginTop: 'var(--s5)' }}>
              <span className="sec-title">Laps Completed</span>
              <span className="sec-meta">from results — hint at pit count</span>
            </div>
            <table className="data-table" style={{ maxWidth: 360 }}>
              <thead>
                <tr>
                  <th className="c" style={{ width: 28 }}>P</th>
                  <th>Driver</th>
                  <th className="r">Laps</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.driver_number}>
                    <td className="c mono" style={{ color: 'var(--text-3)' }}>
                      {r.position}
                    </td>
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
                    <td className="r mono" style={{ color: r.number_of_laps > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                      {r.number_of_laps > 0 ? r.number_of_laps : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }

  const sortedDrivers = [...results].sort((a, b) => a.position - b.position)
  const totalLaps = Math.max(
    ...stints.map((s) => s.lap_end),
    ...results.map((r) => r.number_of_laps),
    1
  )

  const SVG_W = 640
  const LEFT = 48
  const RIGHT = 12
  const ROW_H = 28
  const BAR_H = 14
  const BAR_Y = 7
  const BAR_W = SVG_W - LEFT - RIGHT
  const SVG_H = sortedDrivers.length * ROW_H + 8

  const lapX = (lap: number) => LEFT + ((lap - 1) / totalLaps) * BAR_W
  const stintW = (s: Stint) =>
    Math.max(2, ((s.lap_end - s.lap_start + 1) / totalLaps) * BAR_W)

  const usedCompounds = [...new Set(stints.map((s) => s.compound.toUpperCase()))].filter(
    (c) => c in COMPOUND_COLORS
  )

  return (
    <div data-testid="strategy-chart">
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', minWidth: 280, maxWidth: SVG_W, display: 'block' }}
          role="img"
          aria-label="Race strategy stint chart"
        >
          {sortedDrivers.map((driver, i) => {
            const rowY = i * ROW_H
            const color = driver.team_colour ? `#${driver.team_colour}` : '#888'
            const dStints = stints.filter((s) => s.driver_number === driver.driver_number)
            const dPits = pit_stops.filter((p) => p.driver_number === driver.driver_number)

            return (
              <g key={driver.driver_number} transform={`translate(0,${rowY})`}>
                <text
                  x={LEFT - 5}
                  y={BAR_Y + BAR_H / 2 + 4}
                  textAnchor="end"
                  fill={color}
                  fontFamily="var(--f-mono)"
                  fontWeight={700}
                  fontSize={10}
                >
                  {driver.name_acronym}
                </text>

                {dStints.map((stint, si) => {
                  const x = lapX(stint.lap_start)
                  const w = stintW(stint)
                  const fill = compoundColor(stint.compound)
                  return (
                    <g key={si}>
                      <rect x={x} y={BAR_Y} width={w} height={BAR_H} fill={fill} rx={1.5} />
                      {w > 18 && (
                        <text
                          x={x + w / 2}
                          y={BAR_Y + BAR_H / 2 + 4}
                          textAnchor="middle"
                          fill="#111"
                          fontFamily="var(--f-mono)"
                          fontWeight={700}
                          fontSize={8}
                        >
                          {compoundInitial(stint.compound)}
                        </text>
                      )}
                    </g>
                  )
                })}

                {dPits.map((pit, pi) => {
                  const x = lapX(pit.lap_number)
                  return (
                    <line
                      key={pi}
                      x1={x}
                      x2={x}
                      y1={BAR_Y - 3}
                      y2={BAR_Y + BAR_H + 3}
                      stroke="var(--text)"
                      strokeWidth={1.5}
                      opacity={0.7}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--s4)',
          flexWrap: 'wrap',
          marginTop: 'var(--s4)',
          fontSize: 11,
          color: 'var(--text-3)',
          alignItems: 'center',
        }}
      >
        {usedCompounds.map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                background: COMPOUND_COLORS[c],
                borderRadius: 2,
                display: 'inline-block',
                border: c === 'HARD' ? '1px solid #555' : undefined,
              }}
            />
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </span>
        ))}
        {pit_stops.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
            <span
              style={{
                width: 1,
                height: 12,
                background: 'var(--text)',
                display: 'inline-block',
                opacity: 0.7,
              }}
            />
            Pit stop
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 10 }}>
          {totalLaps} laps
        </span>
      </div>
    </div>
  )
}
