import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Driver, EnrichedResult, EnrichedGrid, PositionSample, Lap, Meeting, Session } from '../types'
import { fetchReplayFrames, fetchTrackOutline } from '../api'
import { ReplayTrackMap } from './ReplayTrackMap'
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
    session?: Session
    meeting?: Meeting
    drivers?: Driver[]
  }
}

export function RaceStoryCanvas({ data }: Props) {
  const {
    results,
    starting_grid: grid,
    positions,
    datasets,
    race_control = [],
    pit_stops = [],
    laps = [],
    session,
    meeting,
    drivers = [],
  } = data
  const hasPositions = datasets['positions']?.status === 'available'

  const [scrubTime, setScrubTime] = useState<number | null>(null)
  const [hoverDriver, setHoverDriver] = useState<number | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(10)
  const svgRef = useRef<SVGSVGElement>(null)

  // Position Evolution Chart Logic
  const allTimes = useMemo(() => [...new Set(positions.map((p) => p.date))].sort(), [positions])
  const hasChartData = hasPositions && allTimes.length > 0
  const chartTiming = useMemo(() => {
    if (!hasChartData) return null
    const tMin = new Date(allTimes[0]).getTime()
    const tMax = new Date(allTimes[allTimes.length - 1]).getTime()
    return { tMin, tMax, tRange: Math.max(tMax - tMin, 1) }
  }, [allTimes, hasChartData])
  const circuitKey = session?.circuit_key ?? meeting?.circuit_key ?? 0
  const outlineYear = meeting?.year ?? (session?.date_start ? new Date(session.date_start).getFullYear() : 0)

  const replayQuery = useQuery({
    queryKey: ['replay-frames', session?.session_key, 5000],
    queryFn: () => fetchReplayFrames(session!.session_key, 5000),
    enabled: mapOpen && Boolean(session?.session_key),
  })
  const outlineQuery = useQuery({
    queryKey: ['track-outline', circuitKey, outlineYear],
    queryFn: () => fetchTrackOutline(circuitKey, outlineYear),
    enabled: mapOpen && circuitKey > 0 && outlineYear > 0,
  })

  useEffect(() => {
    if (!isPlaying || !chartTiming) return

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = now - last
      last = now
      setScrubTime((current) => {
        const next = Math.min(1, (current ?? 0) + (delta * playbackSpeed) / chartTiming.tRange)
        if (next >= 1) {
          setIsPlaying(false)
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [chartTiming, isPlaying, playbackSpeed])

  const replayTMs = useMemo(() => {
    const replay = replayQuery.data
    const frames = replay?.frames ?? []
    if (frames.length === 0) return 0
    const lastFrameT = frames[frames.length - 1].t
    const progress = scrubTime ?? 0
    if (!chartTiming || !replay?.start_time) {
      return Math.max(0, Math.min(lastFrameT, Math.round(progress * lastFrameT)))
    }
    const replayStart = new Date(replay.start_time).getTime()
    const chartTime = chartTiming.tMin + progress * chartTiming.tRange
    return Math.max(0, Math.min(lastFrameT, Math.round(chartTime - replayStart)))
  }, [chartTiming, replayQuery.data, scrubTime])

  let chartContent = null
  let displayResults = results

  if (hasChartData && chartTiming) {
    const { tMin, tRange } = chartTiming

    const byDriver = new Map<number, Array<{ t: number; pos: number }>>()
    for (const p of positions) {
      if (!byDriver.has(p.driver_number)) byDriver.set(p.driver_number, [])
      byDriver.get(p.driver_number)!.push({
        t: (new Date(p.date).getTime() - tMin) / tRange,
        pos: p.position,
      })
    }
    const dnfSet = new Set(results.filter(r => r.dnf || r.dns || r.dsq).map(r => r.driver_number))
    for (const [dNum, samples] of byDriver.entries()) {
      samples.sort((a, b) => a.t - b.t)
      if (samples.length > 0 && !dnfSet.has(dNum)) {
        samples.push({ t: 1, pos: samples[samples.length - 1].pos })
      }
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
    const PB = 20
    const plotW = W - PL - PR
    const plotH = H - PT - PB

    const toX = (t: number) => PL + t * plotW
    const toY = (pos: number) => PT + ((pos - 1) / Math.max(maxPos - 1, 1)) * plotH

    const winner = results.find(r => r.position === 1)
    const winnerLaps = winner ? laps.filter(l => l.driver_number === winner.driver_number) : []
    const lapTicks: { lap: number, t: number }[] = []
    const lapInterval = winnerLaps.length < 30 ? 5 : 10
    
    for (const lap of winnerLaps) {
      if (lap.lap_number > 0 && lap.lap_number % lapInterval === 0) {
        const t = (new Date(lap.date_start).getTime() - tMin) / tRange
        if (t >= 0 && t <= 1) {
          lapTicks.push({ lap: lap.lap_number, t })
        }
      }
    }

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
      setIsPlaying(false)
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

          {lapTicks.map(tick => (
            <g key={`lap-${tick.lap}`}>
              <line x1={toX(tick.t)} x2={toX(tick.t)} y1={H - PB} y2={H - PB + 4} stroke="var(--border)" strokeWidth={1} />
              <text x={toX(tick.t)} y={H - PB + 14} textAnchor="middle" fill="var(--text-3)" fontSize={9} fontFamily="var(--f-mono)">
                L{tick.lap}
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
                  pathLength={1}
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
            onPointerLeave={() => {
              if (!isPlaying) setScrubTime(null)
            }}
            style={{ cursor: 'crosshair', touchAction: 'none' }}
          />
        </svg>
        <div className="rs-replay-tools" aria-label="Race replay controls">
          <button
            type="button"
            className={`rs-tool-btn ${isPlaying ? 'active' : ''}`}
            onClick={() => {
              setScrubTime((current) => current ?? 0)
              setIsPlaying((current) => !current)
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="rs-speed-group" aria-label="Playback speed">
            {[1, 10, 30].map((speed) => (
              <button
                key={speed}
                type="button"
                className={`rs-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`rs-tool-btn ${mapOpen ? 'active' : ''}`}
            onClick={() => setMapOpen((current) => !current)}
          >
            Map
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="race-story-canvas">
      <div className="rs-replay-shell">
        <div className="rs-replay-main">
          {hasChartData ? (
            chartContent
          ) : (
            <div className="analysis-notice">
              <strong>Lap-by-lap positions not available.</strong> This session does not
              have ingested position samples in <code>/api/v1/race-hub</code>.
            </div>
          )}
        </div>
        {mapOpen && (
          <div className="rs-replay-map-slot">
            {circuitKey > 0 && outlineYear > 0 ? (
              <ReplayTrackMap
                outline={outlineQuery.data}
                replay={replayQuery.data}
                tMs={replayTMs}
                drivers={drivers}
                results={results}
                loading={outlineQuery.isLoading || replayQuery.isLoading}
                error={outlineQuery.isError || replayQuery.isError}
              />
            ) : (
              <div className="rs-replay-map-placeholder">track identity unavailable for replay map</div>
            )}
          </div>
        )}
      </div>

      {displayResults.length > 0 && (
        <div className="rs-field-list">
          {displayResults.map((r, i) => {
            const gridPos = grid.find((g) => g.driver_number === r.driver_number)?.position ?? 0
            const currentPos = scrubTime !== null ? i + 1 : r.position
            const isWinner = i === 0 && r.position === 1
            const pClass = currentPos === 1 ? 'rs-pos-p1' : currentPos === 2 ? 'rs-pos-p2' : currentPos === 3 ? 'rs-pos-p3' : ''
            
            let currentPoints: number | string = r.points
            if (scrubTime !== null) {
              const isSprint = data.session?.session_type?.toLowerCase().includes('sprint')
              const ptsArray = isSprint ? [8, 7, 6, 5, 4, 3, 2, 1] : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
              currentPoints = currentPos <= ptsArray.length ? ptsArray[currentPos - 1] : 0
            }
            
            return (
              <div 
                key={r.driver_number} 
                className={`rs-driver-row ${hoverDriver === r.driver_number ? 'rs-driver-row-hover' : ''}`}
                onMouseEnter={() => setHoverDriver(r.driver_number)}
                onMouseLeave={() => setHoverDriver(null)}
              >
                <div className="rs-driver-left">
                  <div className={`rs-pos-col ${pClass}`}>
                    {currentPos}
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
                      <span className={gridDeltaClass(currentPos, gridPos)}>
                        {gridDelta(currentPos, gridPos)}
                      </span>
                    </span>
                    <span className="rs-metric-label">Grid</span>
                  </div>
                  
                  <div className="rs-metric" style={{ width: '80px', opacity: scrubTime !== null ? 0.3 : 1 }}>
                    <span>{isWinner ? formatDuration(r.duration) : formatGap(r.gap_to_leader)}</span>
                    <span className="rs-metric-label">{isWinner ? 'Time' : 'Gap'}</span>
                  </div>
                  
                  <div className="rs-metric" style={{ width: '40px' }}>
                    <span style={{ color: Number(currentPoints) > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                      {currentPoints}
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
