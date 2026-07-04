import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TyreDegPanel } from '../components/live/TyreDegPanel'
import type { LiveTimingRow } from '../lib/live'
import type { LiveDriverData, LiveTyreData } from '../types'

function makeRow(
  number: string,
  position: number,
  tla: string,
  driver: Partial<LiveDriverData> = {},
  tyre: Partial<LiveTyreData> = {},
): LiveTimingRow {
  return {
    RacingNumber: number,
    Position: position,
    Driver: {
      RacingNumber: number,
      Position: position,
      Interval: position === 1 ? '' : '+5.0',
      GapToLeader: '',
      LastLapTime: '1:30.000',
      NumberOfLaps: 10,
      InPit: false,
      PitOut: false,
      Retired: false,
      ...driver,
    } as LiveDriverData,
    Info: {
      RacingNumber: number,
      BroadcastName: '',
      Tla: tla,
      TeamName: '',
      TeamColour: '3671c6',
      FirstName: '',
      LastName: '',
    },
    Tyre: { Compound: 'MEDIUM', New: false, Age: 5, ...tyre } as LiveTyreData,
  }
}

function snapshotRows(lap: number, lastLapTime: string): LiveTimingRow[] {
  return [
    makeRow('1', 1, 'VER', { NumberOfLaps: lap, LastLapTime: lastLapTime }),
    makeRow('4', 2, 'NOR', { NumberOfLaps: lap, LastLapTime: lastLapTime }),
  ]
}

describe('TyreDegPanel', () => {
  it('shows a warming-up placeholder until enough clean laps accumulate', () => {
    render(<TyreDegPanel rows={snapshotRows(3, '1:30.000')} sessionType="Race" pinned={[]} />)
    const panel = screen.getByTestId('tyredeg-panel')
    expect(panel).toHaveTextContent('VER')
    expect(panel).toHaveTextContent('M +5')
    expect(panel).toHaveTextContent('fresh')
    expect(panel).toHaveTextContent('warming up')
  })

  it('annotates tyre age meaning on stint rows', () => {
    const rows = [
      makeRow('1', 1, 'VER', { NumberOfLaps: 10, LastLapTime: '1:30.000' }, { Compound: 'MEDIUM', Age: 12 }),
    ]
    render(<TyreDegPanel rows={rows} sessionType="Race" pinned={[]} />)
    expect(screen.getByText('mid-life')).toBeInTheDocument()
  })

  it('renders slope and rejoin estimate once laps accumulate across snapshots', () => {
    const { rerender } = render(
      <TyreDegPanel rows={snapshotRows(1, '1:30.000')} sessionType="Race" pinned={[]} />,
    )
    // Five completed laps at +0.1s/lap after the first observed snapshot.
    for (let lap = 2; lap <= 6; lap++) {
      const time = `1:30.${String((lap - 1) * 100).padStart(3, '0')}`
      rerender(<TyreDegPanel rows={snapshotRows(lap, time)} sessionType="Race" pinned={[]} />)
    }

    const panel = screen.getByTestId('tyredeg-panel')
    expect(panel).toHaveTextContent('+0.10s/lap')
    expect(panel).not.toHaveTextContent('warming up')
    // VER pits from P1 with NOR +5.0 behind: NOR gets past -> rejoin ~P2.
    expect(panel).toHaveTextContent('→ ~P2')
  })

  it('hides the rejoin estimate outside race sessions and collapses on toggle', () => {
    render(<TyreDegPanel rows={snapshotRows(3, '1:30.000')} sessionType="Qualifying" pinned={[]} />)
    const panel = screen.getByTestId('tyredeg-panel')
    expect(panel).not.toHaveTextContent('~P')

    expect(screen.getAllByTestId('tyredeg-row')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /tyre deg/i }))
    expect(screen.queryAllByTestId('tyredeg-row')).toHaveLength(0)
  })

  it('limits rows to the top ten plus pinned drivers', () => {
    const rows = Array.from({ length: 15 }, (_, index) =>
      makeRow(String(index + 1), index + 1, `D${index + 1}`),
    )
    render(<TyreDegPanel rows={rows} sessionType="Race" pinned={['14']} />)
    expect(screen.getAllByTestId('tyredeg-row')).toHaveLength(11)
    expect(screen.getByText('D14')).toBeInTheDocument()
    expect(screen.queryByText('D12')).not.toBeInTheDocument()
  })

  it('renders nothing without rows', () => {
    render(<TyreDegPanel rows={[]} sessionType="Race" pinned={[]} />)
    expect(screen.queryByTestId('tyredeg-panel')).not.toBeInTheDocument()
  })
})
