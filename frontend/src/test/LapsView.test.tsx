import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LapsView } from '../components/LapsView'
import type { Driver, Lap } from '../types'

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

const drivers: Driver[] = [
  {
    driver_number: 44,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    first_name: 'Lewis',
    last_name: 'Hamilton',
    team_name: 'Ferrari',
    team_colour: 'E80020',
    headshot_url: '',
    broadcast_name: 'L HAMILTON',
    session_key: 9472,
    meeting_key: 1229,
  },
  {
    driver_number: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    first_name: 'Max',
    last_name: 'Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671C6',
    headshot_url: '',
    broadcast_name: 'M VERSTAPPEN',
    session_key: 9472,
    meeting_key: 1229,
  },
]

describe('LapsView', () => {
  it('renders compact best-lap rows by driver', () => {
    render(<LapsView laps={laps} drivers={drivers} />)

    expect(screen.getByTestId('laps-view')).toBeInTheDocument()
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument()
    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument()
    expect(screen.getByText('1:12.100')).toBeInTheDocument()
    expect(screen.getByText('+3.100')).toBeInTheDocument()
    expect(screen.queryByText('FASTEST')).not.toBeInTheDocument()
    expect(screen.getByText('Max Verstappen').closest('tr')).toHaveClass('lap-fastest-row')
  })

  it('shows a missing-data state when no laps are present', () => {
    render(<LapsView laps={[]} />)

    expect(screen.getByText(/Laps not ingested/i)).toBeInTheDocument()
  })
})
