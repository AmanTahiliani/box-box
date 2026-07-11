import { useMemo, useState } from 'react'
import type { Driver, EnrichedResult, ReplayFramesResponse, TrackOutline } from '../types'
import { buildOutlinePath } from '../lib/trackmap'
import { interpolateReplayCars, replayCarToSvg } from '../lib/replay'
import '../styles/replay-map.css'

interface Props {
  outline?: TrackOutline | null
  replay?: ReplayFramesResponse | null
  tMs: number
  drivers: Driver[]
  results: EnrichedResult[]
  loading?: boolean
  error?: boolean
}

export function ReplayTrackMap({
  outline,
  replay,
  tMs,
  drivers,
  results,
  loading = false,
  error = false,
}: Props) {
  const [pinned, setPinned] = useState<string | null>(null)
  const outlinePath = useMemo(() => buildOutlinePath(outline?.points ?? []), [outline])
  const driverInfo = useMemo(() => {
    const info = new Map<string, { label: string; color: string }>()
    for (const driver of drivers) {
      info.set(String(driver.driver_number), {
        label: driver.name_acronym || String(driver.driver_number),
        color: normalizeColor(driver.team_colour),
      })
    }
    for (const result of results) {
      const key = String(result.driver_number)
      if (!info.has(key)) {
        info.set(key, {
          label: result.name_acronym || key,
          color: normalizeColor(result.team_colour),
        })
      }
    }
    return info
  }, [drivers, results])

  const cars = useMemo(() => {
    if (!outline?.bounds || !replay?.frames?.length) return []
    const positions = interpolateReplayCars(replay.frames, tMs)
    return Object.entries(positions)
      .map(([number, car]) => ({
        number,
        svg: replayCarToSvg(car, outline.bounds),
        info: driverInfo.get(number),
      }))
      .sort((a, b) => Number(a.number) - Number(b.number))
  }, [driverInfo, outline?.bounds, replay?.frames, tMs])

  if (loading) {
    return (
      <section className="replay-map-panel" data-testid="replay-track-map">
        <div className="replay-map-empty">loading replay GPS...</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="replay-map-panel" data-testid="replay-track-map">
        <div className="replay-map-empty">replay GPS unavailable for this session</div>
      </section>
    )
  }

  if (!outline || !outlinePath) {
    return (
      <section className="replay-map-panel" data-testid="replay-track-map">
        <div className="replay-map-empty">track outline unavailable for this session</div>
      </section>
    )
  }

  if (!replay?.frames?.length || cars.length === 0) {
    return (
      <section className="replay-map-panel" data-testid="replay-track-map">
        <div className="replay-map-empty">historical GPS unavailable for this session</div>
      </section>
    )
  }

  return (
    <section className="replay-map-panel" data-testid="replay-track-map">
      <div className="replay-map-stage">
        <svg className="replay-map-svg" viewBox="0 0 100 100" role="img" aria-label="Replay track map">
          <path className="replay-map-outline-shadow" d={outlinePath} />
          <path className="replay-map-outline" d={outlinePath} />
          {cars.map((car) => {
            const label = car.info?.label ?? car.number
            const selected = pinned === car.number
            return (
              <g
                key={car.number}
                role="button"
                tabIndex={0}
                aria-label={`${label} replay position`}
                className={`replay-car ${selected ? 'replay-car-pinned' : ''}`}
                transform={`translate(${car.svg.x.toFixed(2)} ${car.svg.y.toFixed(2)})`}
                onClick={() => setPinned(selected ? null : car.number)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setPinned(selected ? null : car.number)
                  }
                }}
              >
                <title>{label}</title>
                <circle r="2.7" fill={car.info?.color ?? '#777777'} />
                <text y="0.85">{label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}

function normalizeColor(color: string | undefined): string {
  const raw = color?.trim()
  if (!raw) return '#777777'
  return raw.startsWith('#') ? raw : `#${raw}`
}
