import { useMemo, useRef, useState } from 'react'
import '../../styles/telemetry-trace.css'

export interface TelemetryTraceSample {
  speed: number
  throttle: number
  brake: number
}

export interface TelemetryTraceSeries {
  label: string
  color: string
  samples: TelemetryTraceSample[]
}

export type TelemetryTraceChannel = 'speed' | 'throttle' | 'brake'

export interface TelemetryTraceChartProps {
  series: TelemetryTraceSeries[]
  channels?: TelemetryTraceChannel[]
  /** Height of each channel panel in SVG units (viewBox space). */
  height?: number
}

const VIEW_WIDTH = 800
const PANEL_GAP = 18
const PAD_TOP = 6
const PAD_BOTTOM = 6

const CHANNEL_LABELS: Record<TelemetryTraceChannel, string> = {
  speed: 'Speed',
  throttle: 'Throttle',
  brake: 'Brake',
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function channelValue(sample: TelemetryTraceSample, channel: TelemetryTraceChannel): number {
  const raw = sample[channel]
  // Throttle/brake are percentages; clamp so out-of-range API values can't
  // draw outside the panel. Speed is clamped to >= 0.
  if (channel === 'speed') return Math.max(0, raw)
  return clamp(raw, 0, 100)
}

function formatValue(value: number, channel: TelemetryTraceChannel): string {
  if (channel === 'speed') return `${Math.round(value)} km/h`
  return `${Math.round(value)}%`
}

export function TelemetryTraceChart({
  series,
  channels = ['speed', 'throttle', 'brake'],
  height = 110,
}: TelemetryTraceChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Series are index-aligned; mismatched lengths are clamped to the shortest
  // series so every drawn x has a value for every driver.
  const sampleCount = useMemo(
    () => (series.length === 0 ? 0 : Math.min(...series.map((s) => s.samples.length))),
    [series],
  )

  const speedMax = useMemo(() => {
    let max = 0
    for (const s of series) {
      for (let i = 0; i < sampleCount; i++) {
        max = Math.max(max, channelValue(s.samples[i], 'speed'))
      }
    }
    return max > 0 ? max : 1
  }, [series, sampleCount])

  if (series.length === 0 || sampleCount === 0 || channels.length === 0) {
    return <div className="telemetry-trace-empty">No telemetry data</div>
  }

  // Clamp a stale hover index in case the series prop shrank between renders.
  const hover = hoverIndex === null ? null : Math.min(hoverIndex, sampleCount - 1)

  const panelHeight = height
  const totalHeight = channels.length * panelHeight + (channels.length - 1) * PANEL_GAP
  const xAt = (i: number) => (i / Math.max(1, sampleCount - 1)) * VIEW_WIDTH

  const channelMax = (channel: TelemetryTraceChannel) => (channel === 'speed' ? speedMax : 100)

  const yAt = (value: number, channel: TelemetryTraceChannel, panelTop: number) => {
    const usable = panelHeight - PAD_TOP - PAD_BOTTOM
    const frac = channelValue({ speed: value, throttle: value, brake: value }, channel) / channelMax(channel)
    return panelTop + PAD_TOP + (1 - frac) * usable
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) {
      setHoverIndex(0)
      return
    }
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    setHoverIndex(clamp(Math.round(frac * (sampleCount - 1)), 0, sampleCount - 1))
  }

  return (
    <div className="telemetry-trace" data-testid="telemetry-trace">
      <div className="telemetry-trace-legend">
        {series.map((s) => (
          <span key={s.label} className="telemetry-trace-legend-item">
            <span className="telemetry-trace-swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        ref={svgRef}
        className="telemetry-trace-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${totalHeight}`}
        role="img"
        aria-label="Telemetry trace chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {channels.map((channel, panelIdx) => {
          const panelTop = panelIdx * (panelHeight + PANEL_GAP)
          return (
            <g key={channel} className="telemetry-trace-panel" data-channel={channel}>
              <rect
                className="telemetry-trace-panel-bg"
                x={0}
                y={panelTop}
                width={VIEW_WIDTH}
                height={panelHeight}
              />
              <text className="telemetry-trace-panel-title" x={6} y={panelTop + 13}>
                {CHANNEL_LABELS[channel]}
              </text>
              <text className="telemetry-trace-axis-max" x={VIEW_WIDTH - 6} y={panelTop + 13} textAnchor="end">
                {channel === 'speed' ? `${Math.round(speedMax)} km/h` : '100%'}
              </text>
              {series.map((s) => {
                const points = Array.from({ length: sampleCount }, (_, i) => {
                  const x = xAt(i)
                  const y = yAt(s.samples[i][channel], channel, panelTop)
                  return `${x.toFixed(2)},${y.toFixed(2)}`
                }).join(' ')
                return (
                  <polyline
                    key={s.label}
                    className="telemetry-trace-line"
                    data-channel={channel}
                    data-series={s.label}
                    points={points}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )
        })}
        {hover !== null && (
          <line
            className="telemetry-trace-crosshair"
            data-testid="telemetry-trace-crosshair"
            x1={xAt(hover)}
            y1={0}
            x2={xAt(hover)}
            y2={totalHeight}
          />
        )}
      </svg>
      {hover !== null && (
        <div className="telemetry-trace-readout" data-testid="telemetry-trace-readout">
          <span className="telemetry-trace-readout-index">Sample {hover}</span>
          {series.map((s) => (
            <span key={s.label} className="telemetry-trace-readout-driver">
              <span className="telemetry-trace-swatch" style={{ background: s.color }} aria-hidden="true" />
              <span className="telemetry-trace-readout-label">{s.label}</span>
              {channels.map((channel) => (
                <span key={channel} className="telemetry-trace-readout-value">
                  {formatValue(channelValue(s.samples[hover], channel), channel)}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
