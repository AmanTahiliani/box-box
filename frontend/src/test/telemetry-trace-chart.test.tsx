import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  TelemetryTraceChart,
  type TelemetryTraceSeries,
} from '../components/charts/TelemetryTraceChart'

function makeSeries(label: string, color: string, speeds: number[]): TelemetryTraceSeries {
  return {
    label,
    color,
    samples: speeds.map((speed, i) => ({
      speed,
      throttle: (i * 25) % 101,
      brake: i % 2 === 0 ? 100 : 0,
    })),
  }
}

const VER = makeSeries('VER', '#2563eb', [280, 310, 190, 90, 240])
const LEC = makeSeries('LEC', '#dc2626', [275, 305, 200, 95, 235])

describe('TelemetryTraceChart', () => {
  it('renders one polyline per series per channel', () => {
    const { container } = render(<TelemetryTraceChart series={[VER, LEC]} />)
    const lines = container.querySelectorAll('polyline.telemetry-trace-line')
    expect(lines).toHaveLength(2 * 3)
    for (const channel of ['speed', 'throttle', 'brake']) {
      expect(
        container.querySelectorAll(`polyline.telemetry-trace-line[data-channel="${channel}"]`),
      ).toHaveLength(2)
    }
    expect(
      container.querySelectorAll('polyline.telemetry-trace-line[data-series="VER"]'),
    ).toHaveLength(3)
  })

  it('respects the channels prop', () => {
    const { container } = render(<TelemetryTraceChart series={[VER]} channels={['speed']} />)
    expect(container.querySelectorAll('polyline.telemetry-trace-line')).toHaveLength(1)
    expect(container.querySelectorAll('.telemetry-trace-panel')).toHaveLength(1)
  })

  it('renders an empty state for no series', () => {
    render(<TelemetryTraceChart series={[]} />)
    expect(screen.getByText('No telemetry data')).toBeInTheDocument()
  })

  it('renders an empty state when a series has no samples', () => {
    render(<TelemetryTraceChart series={[makeSeries('VER', '#2563eb', [])]} />)
    expect(screen.getByText('No telemetry data')).toBeInTheDocument()
  })

  it('survives a single sample and mismatched series lengths', () => {
    const short = makeSeries('VER', '#2563eb', [300])
    const long = makeSeries('LEC', '#dc2626', [280, 290, 300])
    const { container } = render(<TelemetryTraceChart series={[short, long]} />)
    // Clamped to the shortest series: every polyline has exactly one point.
    const lines = container.querySelectorAll('polyline.telemetry-trace-line')
    expect(lines).toHaveLength(6)
    for (const line of lines) {
      expect(line.getAttribute('points')!.trim().split(' ')).toHaveLength(1)
    }
  })

  it('clamps throttle values to 0-100 within the panel', () => {
    const wild: TelemetryTraceSeries = {
      label: 'VER',
      color: '#2563eb',
      samples: [
        { speed: 100, throttle: 150, brake: 0 },
        { speed: 100, throttle: -20, brake: 0 },
        { speed: 100, throttle: 50, brake: 0 },
      ],
    }
    const { container } = render(
      <TelemetryTraceChart series={[wild]} channels={['throttle']} height={110} />,
    )
    const line = container.querySelector('polyline.telemetry-trace-line[data-channel="throttle"]')!
    const ys = line
      .getAttribute('points')!
      .split(' ')
      .map((p) => Number(p.split(',')[1]))
    // Panel occupies y 0..110 with 6px padding; clamped values pin to the edges.
    expect(ys[0]).toBeCloseTo(6, 1) // 150% -> 100% -> panel top
    expect(ys[1]).toBeCloseTo(104, 1) // -20% -> 0% -> panel bottom
    expect(ys[2]).toBeCloseTo(55, 1) // 50% -> middle
  })

  it('shows the speed axis max in km/h', () => {
    render(<TelemetryTraceChart series={[VER]} channels={['speed']} />)
    expect(screen.getByText('310 km/h')).toBeInTheDocument()
  })

  it('lists every series in the legend with a color swatch', () => {
    const { container } = render(<TelemetryTraceChart series={[VER, LEC]} />)
    const legend = container.querySelector('.telemetry-trace-legend')!
    expect(legend.textContent).toContain('VER')
    expect(legend.textContent).toContain('LEC')
    expect(legend.querySelectorAll('.telemetry-trace-swatch')).toHaveLength(2)
  })

  it('shows a crosshair and per-driver readout on hover, hides on leave', () => {
    const { container } = render(<TelemetryTraceChart series={[VER, LEC]} />)
    const svg = container.querySelector('svg.telemetry-trace-svg')!
    expect(screen.queryByTestId('telemetry-trace-crosshair')).not.toBeInTheDocument()

    fireEvent.mouseMove(svg, { clientX: 0, clientY: 10 })
    expect(screen.getByTestId('telemetry-trace-crosshair')).toBeInTheDocument()
    const readout = screen.getByTestId('telemetry-trace-readout')
    expect(readout.textContent).toContain('VER')
    expect(readout.textContent).toContain('LEC')
    expect(readout.textContent).toContain('km/h')

    fireEvent.mouseLeave(svg)
    expect(screen.queryByTestId('telemetry-trace-crosshair')).not.toBeInTheDocument()
  })
})
