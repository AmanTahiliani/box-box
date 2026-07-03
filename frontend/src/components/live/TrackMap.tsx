import { useMemo, useState } from 'react'
import type {
  LiveDriverData,
  LiveDriverInfo,
  LivePosition,
  LiveTelemetry,
  TrackOutline,
} from '../../types'
import {
  buildOutlinePath,
  canvasToSvg,
  isOnTrack,
  normalizeRawPoint,
} from '../../lib/trackmap'

interface Props {
  outline?: TrackOutline | null
  positions: Record<string, LivePosition>
  telemetry?: Record<string, LiveTelemetry>
  drivers?: Record<string, LiveDriverData>
  driverInfo?: Record<string, LiveDriverInfo>
  loading?: boolean
}

export function TrackMap({
  outline,
  positions,
  telemetry = {},
  drivers = {},
  driverInfo = {},
  loading = false,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const outlinePath = useMemo(() => buildOutlinePath(outline?.points ?? []), [outline])
  const cars = useMemo(() => {
    if (!outline?.bounds) return []
    return Object.entries(positions)
      .map(([number, position]) => {
        const canvas = normalizeRawPoint(position, outline.bounds)
        return {
          number,
          position,
          svg: canvasToSvg(canvas),
          info: driverInfo[number],
          driver: drivers[number],
          telemetry: telemetry[number],
          active: isOnTrack(position.status) && !drivers[number]?.Retired,
        }
      })
      .sort((a, b) => Number(a.number) - Number(b.number))
  }, [driverInfo, drivers, outline?.bounds, positions, telemetry])

  const selectedCar = selected ? cars.find((car) => car.number === selected) : null

  if (loading) {
    return (
      <section className="live-track-panel" data-testid="track-map">
        <div className="sec-header">
          <span className="sec-title">Track Map</span>
        </div>
        <div className="track-map-empty">loading cached circuit outline...</div>
      </section>
    )
  }

  if (!outline || !outlinePath) {
    return (
      <section className="live-track-panel" data-testid="track-map">
        <div className="sec-header">
          <span className="sec-title">Track Map</span>
        </div>
        <div className="track-map-empty">track outline unavailable for this live session</div>
      </section>
    )
  }

  return (
    <section className="live-track-panel" data-testid="track-map">
      <div className="sec-header">
        <span className="sec-title">Track Map</span>
        <span className="sec-meta">{cars.length ? `${cars.length} cars` : 'waiting for GPS'}</span>
      </div>
      <div className="track-map-stage">
        <svg className="track-map-svg" viewBox="0 0 100 100" role="img" aria-label="Live track map">
          <path className="track-map-outline-shadow" d={outlinePath} />
          <path className="track-map-outline" d={outlinePath} />
          {cars.map((car) => {
            const label = car.info?.Tla || car.number
            return (
              <g
                key={car.number}
                role="button"
                tabIndex={0}
                aria-label={`${label} telemetry`}
                className={`track-car ${car.active ? 'track-car-active' : 'track-car-inactive'} ${selected === car.number ? 'track-car-selected' : ''}`}
                transform={`translate(${car.svg.x.toFixed(2)} ${car.svg.y.toFixed(2)})`}
                onClick={() => setSelected(car.number)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelected(car.number)
                  }
                }}
              >
                <circle r="2.8" fill={teamColor(car.info)} />
                <text y="0.85">{label}</text>
              </g>
            )
          })}
        </svg>
        {cars.length === 0 && <div className="track-map-empty track-map-overlay">waiting for live GPS</div>}
        {selectedCar && (
          <div className="track-telemetry" data-testid="track-telemetry">
            <div className="track-telemetry-head">
              <span className="track-driver-code">{selectedCar.info?.Tla || selectedCar.number}</span>
              <span>{selectedCar.position.status || 'OnTrack'}</span>
            </div>
            <dl>
              <Metric label="SPD" value={selectedCar.telemetry?.Speed} suffix="km/h" />
              <Metric label="THR" value={selectedCar.telemetry?.Throttle} suffix="%" />
              <Metric label="BRK" value={selectedCar.telemetry?.Brake} suffix="%" />
              <Metric label="DRS" value={selectedCar.telemetry?.DRS} />
              <Metric label="GEAR" value={selectedCar.telemetry?.NGear} />
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value, suffix = '' }: { label: string; value: number | undefined; suffix?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value === undefined ? '-' : `${value}${suffix}`}</dd>
    </>
  )
}

function teamColor(info: LiveDriverInfo | undefined): string {
  const raw = info?.TeamColour?.trim()
  if (!raw) return '#777777'
  return raw.startsWith('#') ? raw : `#${raw}`
}
