import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LapsView } from '../components/LapsView'
import type { Lap } from '../types'

const laps: Lap[] = [
  {
    session_key: 9472,
    driver_number: 44,
    meeting_key: 1229,
    lap_number: 1,
    date_start: '2025-05-25T13:04:00Z',
    lap_duration: 75.2,
    is_pit_out_lap: false,
  },
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    lap_number: 1,
    date_start: '2025-05-25T13:04:01Z',
    lap_duration: 72.1,
    is_pit_out_lap: false,
  },
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    lap_number: 2,
    date_start: '2025-05-25T13:05:14Z',
    lap_duration: 73.5,
    is_pit_out_lap: true,
  },
]

describe('LapsView', () => {
  it('renders compact best-lap rows by driver', () => {
    render(<LapsView laps={laps} />)

    expect(screen.getByTestId('laps-view')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#44')).toBeInTheDocument()
    expect(screen.getByText('1:12.100')).toBeInTheDocument()
    expect(screen.getByText('FASTEST')).toBeInTheDocument()
  })

  it('shows a missing-data state when no laps are present', () => {
    render(<LapsView laps={[]} />)

    expect(screen.getByText(/Laps not ingested/i)).toBeInTheDocument()
  })
})
