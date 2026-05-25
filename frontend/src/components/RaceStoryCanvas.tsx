import { useState, useMemo, useRef, useCallback } from 'react'
import type { EnrichedResult, EnrichedGrid, PositionSample, Lap } from '../types'
import { gridDelta, gridDeltaClass, formatDuration, formatGap } from '../utils'

interface Props {
  data: {
    results: EnrichedResult[]
    starting_grid: EnrichedGrid[]
    positions: PositionSample[]
    laps: Lap[]
    datasets: Record<string, any>
    race_control?: any[]
    pit_stops?: any[]
  }
}

export function RaceStoryCanvas({ data }: Props) {
  const { results, starting_grid: grid, positions, datasets, race_control = [], pit_stops = [] } = data
  const hasPositions = datasets['positions']?.status === 'available'

  const [scrubTime, setScrubTime] = useState<number | null>(null)
  const [hoverDriver, setHoverDriver] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Position Evolution Chart Logic
  const allTimes = useMemo(() => [...new Set(positions.map((p) => p.date))].sort(), [positions])
  const hasChartData = hasPositions && allTimes.length > 0

  let chartContent = null
  let displayResults = results

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

    const getInterpPos = (samples: {t: number, pos: number}[], t: number) => {
      if (!samples || samples.length === 0) return null
      if (t <= samples[0].t) return samples[0].pos
      if (t >= samples[samples.length - 1].t) return samples[samples.length - 1].pos
      for (let i = 0; i < samples.length - 1; i++) {
        if (samples[i].t <= t && samples[i+1].t >= t) {
          const dt = samples[i+1].t - samples[i].t
          if (dt === 0) return samples[i].pos
          const frac = (t - samples[i].t) / dt
          return samples[i].pos + (samples[i+1].pos - samples[i].pos) * frac
        }
      }
      return null
    }

    if (scrubTime !== null) {
      const currentPos = new Map<number, number>()
      for (const [dNum, samples] of byDriver.entries()) {
        const pos = getInterpPos(samples, scrubTime)
        if (pos !== null) {
          currentPos.set(dNum, pos)
        }
      }
      displayResults = [...results].sort((a, b) => {
        const posA = currentPos.get(a.driver_number) ?? 999
        const posB = currentPos.get(b.driver_number) ?? 999
        return posA - posB
      })
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

    // Safety Car / VSC periods
    const scPeriods: { start: number; end: number | null; type: 'SC' | 'VSC' }[] = []
    let activeSC: { start: number; type: 'SC' | 'VSC' } | null = null
    const rc = [...race_control].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    for (const msg of rc) {
      const t = new Date(msg.date).getTime()
      const m = msg.message?.toUpperCase() || ''
      const cat = msg.category?.toUpperCase() || ''
      
      if (m.includes('VIRTUAL SAFETY CAR DEPLOYED') || cat === 'VIRTUALSAFETYCAR') {
        if (!activeSC) activeSC = { start: t, type: 'VSC' }
      } else if (m.includes('SAFETY CAR DEPLOYED') || cat === 'SAFETYCAR') {
        if (!activeSC) activeSC = { start: t, type: 'SC' }
      } else if (m.includes('TRACK CLEAR') || m.includes('CLEAR')) {
        if (activeSC) {
          scPeriods.push({ start: activeSC.start, end: t, type: activeSC.type })
          activeSC = null
        }
      }
    }
    if (activeSC) {
      scPeriods.push({ start: activeSC.start, end: null, type: activeSC.type })
    }

    const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const t = Math.max(0, Math.min(1, (x - PL) / plotW))
      setScrubTime(t)
    }

    chartContent = (
      <div className="rs-chart-container scroll-x" data-testid="position-chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', minWidth: 280, maxWidth: W, display: 'block' }}
          role="img"
          aria-label="Position evolution chart"
        >
          {scPeriods.map((sc, i) => {
            const startT = (sc.start - tMin) / tRange
            const endT = sc.end ? (sc.end - tMin) / tRange : 1
            const x1 = toX(Math.max(0, startT))
            const x2 = toX(Math.min(1, endT))
            if (x2 <= PL || x1 >= W - PR) return null
            return (
              <rect
                key={`sc-${i}`}
                x={x1}
                y={PT}
                width={Math.max(0, x2 - x1)}
                height={plotH}
                fill={sc.type === 'SC' ? 'rgba(255, 153, 0, 0.15)' : 'rgba(255, 204, 0, 0.1)'}
              />
            )
          })}

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
            const isHovered = hoverDriver === dNum
            const isFaded = hoverDriver !== null && !isHovered

            const driverPits = pit_stops.filter(p => p.driver_number === dNum)

            return (
              <g 
                key={dNum}
                style={{ opacity: isFaded ? 0.2 : 1, transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHoverDriver(dNum)}
                onMouseLeave={() => setHoverDriver(null)}
              >
                <polyline
                  points={pts}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="rs-driver-line"
                />
                
                {driverPits.map((p, i) => {
                  const t = (new Date(p.date).getTime() - tMin) / tRange
                  if (t < 0 || t > 1) return null
                  const pos = getInterpPos(samples, t)
                  if (pos === null) return null
                  return (
                    <circle 
                      key={`pit-${i}`} 
                      cx={toX(t)} 
                      cy={toY(pos)} 
                      r={3} 
                      fill="var(--bg)" 
                      stroke={color} 
                      strokeWidth={2}
                      className="rs-pit-dot"
                    />
                  )
                })}
                
                {last && (
                  <text
                    x={toX(last.t) + 6}
                    y={toY(last.pos) + 4}
                    fill={color}
                    fontSize={isHovered ? 11 : 9}
                    fontFamily="var(--f-mono)"
                    fontWeight={700}
                    style={{ cursor: 'default' }}
                  >
                    {acronymByDriver.get(dNum) ?? dNum}
                  </text>
                )}
              </g>
            )
          })}

          {scrubTime !== null && (
            <line
              x1={toX(scrubTime)}
              x2={toX(scrubTime)}
              y1={PT}
              y2={H - PB}
              stroke="var(--text)"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="rs-playhead"
              style={{ pointerEvents: 'none' }}
            />
          )}

          <rect
            x={PL}
            y={PT}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setScrubTime(null)}
            style={{ cursor: 'crosshair', touchAction: 'none' }}
          />
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

      {displayResults.length > 0 && (
        <div className="rs-field-list">
          {displayResults.map((r, i) => {
            const gridPos = grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
            const isWinner = i === 0 && r.position === 1
            const pClass = r.position === 1 ? 'rs-pos-p1' : r.position === 2 ? 'rs-pos-p2' : r.position === 3 ? 'rs-pos-p3' : ''
            
            return (
              <div 
                key={r.driver_number} 
                className={`rs-driver-row ${hoverDriver === r.driver_number ? 'rs-driver-row-hover' : ''}`}
                onMouseEnter={() => setHoverDriver(r.driver_number)}
                onMouseLeave={() => setHoverDriver(null)}
              >
                <div className="rs-driver-left">
                  <div className={`rs-pos-col ${pClass}`}>
                    {scrubTime !== null ? i + 1 : r.position}
                  </div>
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
