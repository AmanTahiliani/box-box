import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeltaTimeGraph } from '../components/charts/DeltaTimeGraph'
import {
  computeCumulativeDeltas,
  deltaPolylineSegments,
  formatDeltaSeconds,
  type DeltaSeries,
} from '../lib/delta'

const reference: DeltaSeries = {
  label: 'VER',
  color: '#3671C6',
  lapTimes: [90, 91, 92],
}

const challenger: DeltaSeries = {
  label: 'HAM',
  color: '#E8002D',
  lapTimes: [89, 92, 90],
}

describe('formatDeltaSeconds', () => {
  it('formats signed deltas with one decimal and s suffix', () => {
    expect(formatDeltaSeconds(2.5)).toBe('+2.5s')
    expect(formatDeltaSeconds(-1.2)).toBe('-1.2s')
    expect(formatDeltaSeconds(0)).toBe('+0.0s')
  })
})

describe('computeCumulativeDeltas', () => {
  it('computes cumulative delta vs the first series by default', () => {
    const result = computeCumulativeDeltas([reference, challenger])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('HAM')
    // Lap 1: 89-90=-1, Lap 2: (89+92)-(90+91)=0, Lap 3: (89+92+90)-(90+91+92)=-2
    expect(result[0].deltas[0]).toBeCloseTo(-1)
    expect(result[0].deltas[1]).toBeCloseTo(0)
    expect(result[0].deltas[2]).toBeCloseTo(-2)
  })

  it('respects an explicit reference label', () => {
    const result = computeCumulativeDeltas([reference, challenger], 'HAM')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('VER')
    expect(result[0].deltas[0]).toBeCloseTo(1)
    expect(result[0].deltas[2]).toBeCloseTo(2)
  })

  it('emits null for missing lap times while carrying cumulative forward', () => {
    const withNull: DeltaSeries = {
      label: 'NOR',
      color: '#FF8000',
      lapTimes: [88, null, 93],
    }
    const result = computeCumulativeDeltas([reference, withNull])
    expect(result[0].deltas[0]).toBeCloseTo(-2)
    expect(result[0].deltas[1]).toBeNull()
    // After null: NOR cum=181, VER cum=273 → delta -92
    expect(result[0].deltas[2]).toBeCloseTo(-92)
  })

  it('returns an empty array when only one series is provided', () => {
    expect(computeCumulativeDeltas([reference])).toEqual([])
  })
})

describe('deltaPolylineSegments', () => {
  it('splits polylines at null laps', () => {
    const segments = deltaPolylineSegments(
      [1, null, 2],
      (lap, delta) => `${lap},${delta}`,
    )
    expect(segments).toEqual(['0,1', '2,2'])
  })
})

describe('DeltaTimeGraph', () => {
  it('renders an empty state with no series', () => {
    render(<DeltaTimeGraph series={[]} />)
    expect(screen.getByTestId('delta-time-graph-empty')).toBeInTheDocument()
    expect(screen.getByText(/No lap data/i)).toBeInTheDocument()
  })

  it('renders an empty state with only the reference driver', () => {
    render(<DeltaTimeGraph series={[reference]} />)
    expect(screen.getByTestId('delta-time-graph-empty')).toBeInTheDocument()
    expect(screen.getByText(/at least two drivers/i)).toBeInTheDocument()
  })

  it('renders a zero line and one polyline per non-reference driver', () => {
    const { container } = render(<DeltaTimeGraph series={[reference, challenger]} />)
    expect(screen.getByTestId('delta-time-graph')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="delta-zero-line"]')).toBeInTheDocument()
    expect(screen.getByTestId('delta-line-HAM')).toBeInTheDocument()
    expect(container.querySelectorAll('.delta-graph-driver-line')).toHaveLength(1)
    expect(screen.queryByTestId('delta-line-VER')).not.toBeInTheDocument()
  })

  it('shows a crosshair tooltip on hover', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 640,
      height: 220,
      right: 640,
      bottom: 220,
      toJSON: () => ({}),
    })
    const { container } = render(<DeltaTimeGraph series={[reference, challenger]} />)
    const hoverLayer = container.querySelector('.delta-graph-hover-layer')
    expect(hoverLayer).toBeTruthy()
    fireEvent.mouseMove(hoverLayer!, { clientX: 44, clientY: 100 })
    expect(screen.getByTestId('delta-crosshair')).toBeInTheDocument()
    expect(screen.getByTestId('delta-tooltip')).toBeInTheDocument()
    expect(screen.getByText(/Lap 1/)).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
